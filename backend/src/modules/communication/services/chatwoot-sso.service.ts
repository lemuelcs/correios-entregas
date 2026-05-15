/**
 * chatwoot-sso.service.ts
 *
 * Resolve URL de SSO no Chatwoot para o usuario Correios logado.
 * Faz lazy provisioning: garante user + account_user + team membership.
 *
 * Mapeamento de role Correios -> Chatwoot:
 *   GESTAO       -> administrator  + team `admin`
 *   UNIDADE      -> agent          + team `dispatcher`
 *   CARTEIRO     -> agent          + team `dispatcher`
 *   DESTINATARIO -> agent (sem team — fallback)
 *
 * Teams ja provisionados em chatwoot.delivyodev.com (account 7):
 *   13=dispatcher, 14=financeiro, 15=admin
 */
import { randomBytes } from 'crypto';

import { Role } from '@prisma/client';

import logger from '../../../shared/utils/logger';
import { AppError } from '../../../shared/middleware/error-handler.middleware';
import { chatwootHttp } from './chatwoot/chatwoot-http.client';

export type ChatwootRole = 'administrator' | 'agent';

export interface ChatwootSsoResult {
  url: string;
  accountId: number;
  userId: number;
}

interface ChatwootUser {
  id: number;
  name: string;
  email: string;
}

interface CachedUser {
  userId: number;
  expiresAt: number;
}

const SSO_USER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const userIdCache = new Map<string, CachedUser>();

const LOG_PREFIX = '[CHATWOOT-SSO]';

function mapRole(role: Role): { chatwootRole: ChatwootRole; team?: 'dispatcher' | 'financeiro' | 'admin' } {
  switch (role) {
    case 'GESTAO':
      return { chatwootRole: 'administrator', team: 'admin' };
    case 'UNIDADE':
      return { chatwootRole: 'agent', team: 'dispatcher' };
    case 'CARTEIRO':
      return { chatwootRole: 'agent', team: 'dispatcher' };
    case 'DESTINATARIO':
    default:
      return { chatwootRole: 'agent' };
  }
}

function randomPassword(): string {
  // Politica do Chatwoot: >=1 upper, >=1 lower, >=1 digit, >=1 especial.
  const random = randomBytes(24).toString('hex');
  return `D@${random.toUpperCase().slice(0, 4)}${random}`;
}

async function findUserByEmailInAccount(
  accountId: number,
  apiToken: string,
  email: string,
): Promise<ChatwootUser | null> {
  const agents = await chatwootHttp.request<ChatwootUser[]>(
    {
      method: 'GET',
      url: `/api/v1/accounts/${accountId}/agents`,
      headers: chatwootHttp.accountHeaders(apiToken),
    },
    `list-agents account=${accountId}`,
  );
  const lowerEmail = email.toLowerCase();
  return agents.find((u) => u.email?.toLowerCase() === lowerEmail) || null;
}

async function createUserViaPlatform(input: {
  email: string;
  name: string;
  correiosUserId?: string;
}): Promise<ChatwootUser> {
  const body = {
    name: input.name,
    email: input.email,
    password: randomPassword(),
    custom_attributes: {
      provisioned_by: 'correios-entregas-backend',
      correios_user_id: input.correiosUserId || null,
      locale: 'pt_BR',
    },
  };
  return chatwootHttp.request<ChatwootUser>(
    {
      method: 'POST',
      url: '/platform/api/v1/users',
      headers: chatwootHttp.platformHeaders(),
      data: body,
    },
    `platform-create-user email=${input.email}`,
  );
}

async function ensureAccountUser(params: {
  accountId: number;
  userId: number;
  role: ChatwootRole;
}): Promise<void> {
  try {
    await chatwootHttp.request(
      {
        method: 'POST',
        url: `/platform/api/v1/accounts/${params.accountId}/account_users`,
        headers: chatwootHttp.platformHeaders(),
        data: { user_id: params.userId, role: params.role },
      },
      `platform-account-user account=${params.accountId} user=${params.userId}`,
    );
  } catch (err) {
    if (err instanceof AppError && err.statusCode >= 400 && err.statusCode < 500) {
      logger.debug(
        { err: err.message, accountId: params.accountId, userId: params.userId },
        `${LOG_PREFIX} account_user ja existe (esperado)`,
      );
      return;
    }
    throw err;
  }
}

async function findOrCreateTeam(params: {
  accountId: number;
  apiToken: string;
  teamSlug: string;
}): Promise<number | null> {
  const teams = await chatwootHttp.request<Array<{ id: number; name: string }>>(
    {
      method: 'GET',
      url: `/api/v1/accounts/${params.accountId}/teams`,
      headers: chatwootHttp.accountHeaders(params.apiToken),
    },
    `list-teams account=${params.accountId}`,
  );
  const lower = params.teamSlug.toLowerCase();
  const found = teams.find((t) => t.name?.toLowerCase() === lower);
  if (found) return found.id;

  try {
    const created = await chatwootHttp.request<{ id: number }>(
      {
        method: 'POST',
        url: `/api/v1/accounts/${params.accountId}/teams`,
        headers: chatwootHttp.accountHeaders(params.apiToken),
        data: { name: params.teamSlug, description: `Team Correios ${params.teamSlug}` },
      },
      `create-team ${params.teamSlug}`,
    );
    return created.id;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, `${LOG_PREFIX} Falha ao criar team (seguindo sem team)`);
    return null;
  }
}

async function ensureTeamMember(params: {
  accountId: number;
  apiToken: string;
  teamId: number;
  userId: number;
}): Promise<void> {
  try {
    await chatwootHttp.request(
      {
        method: 'POST',
        url: `/api/v1/accounts/${params.accountId}/teams/${params.teamId}/team_members`,
        headers: chatwootHttp.accountHeaders(params.apiToken),
        data: { user_ids: [params.userId] },
      },
      `add-team-member team=${params.teamId} user=${params.userId}`,
    );
  } catch (err) {
    if (err instanceof AppError && err.statusCode >= 400 && err.statusCode < 500) {
      return;
    }
    throw err;
  }
}

async function loginSsoForUser(userId: number): Promise<string> {
  // GET /platform/api/v1/users/:id/login (Chatwoot 4.13 expoe como GET).
  const data = await chatwootHttp.request<{ url: string }>(
    {
      method: 'GET',
      url: `/platform/api/v1/users/${userId}/login`,
      headers: chatwootHttp.platformHeaders(),
    },
    `platform-sso-login user=${userId}`,
  );
  if (!data?.url) {
    throw new AppError(503, '[Chatwoot] Resposta SSO sem URL');
  }
  return data.url;
}

export async function getChatwootSsoUrlForCorreiosUser(params: {
  email: string;
  fullName: string;
  role: Role;
  correiosUserId?: string;
}): Promise<ChatwootSsoResult> {
  const routing = chatwootHttp.resolveCorreiosRouting();
  const { chatwootRole, team } = mapRole(params.role);

  // 1) Resolve userId (com cache)
  const cacheKey = `${routing.accountId}:${params.email.toLowerCase()}`;
  let userId: number;
  const cached = userIdCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    userId = cached.userId;
  } else {
    const existing = await findUserByEmailInAccount(routing.accountId, routing.apiToken, params.email);
    if (existing) {
      userId = existing.id;
    } else {
      const created = await createUserViaPlatform({
        email: params.email,
        name: params.fullName,
        correiosUserId: params.correiosUserId,
      });
      userId = created.id;
      logger.info(
        { accountId: routing.accountId, userId, email: params.email },
        `${LOG_PREFIX} Usuario Chatwoot provisionado`,
      );
    }
    userIdCache.set(cacheKey, { userId, expiresAt: Date.now() + SSO_USER_CACHE_TTL_MS });
  }

  // 2) Garante account_user
  await ensureAccountUser({ accountId: routing.accountId, userId, role: chatwootRole });

  // 3) Team association
  if (team) {
    const teamId = await findOrCreateTeam({
      accountId: routing.accountId,
      apiToken: routing.apiToken,
      teamSlug: team,
    });
    if (teamId) {
      await ensureTeamMember({
        accountId: routing.accountId,
        apiToken: routing.apiToken,
        teamId,
        userId,
      });
    }
  }

  // 4) Gera SSO URL
  const url = await loginSsoForUser(userId);

  return { url, accountId: routing.accountId, userId };
}

export function clearChatwootSsoCache(): void {
  userIdCache.clear();
}
