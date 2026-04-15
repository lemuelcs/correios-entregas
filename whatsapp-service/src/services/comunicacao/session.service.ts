/**
 * session.service.ts
 * Sessões Redis para o módulo WPP-PILOT
 * Reutiliza o cliente Redis já existente no projeto (config/redis.ts)
 */
import { getRedis, isRedisAvailable } from '../../shared/utils/redis';
import { db } from '../../types/prisma-extended';
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from '../../utils/locale';
import { phoneMatchSuffixes } from '../../utils/phone';
import logger from '../../shared/utils/logger';

export interface WppPilotSession {
  instanceName: string;
  phone: string;
  participantType: 'CARTEIRO' | 'DESTINATARIO' | 'GESTAO' | 'UNIDADE' | 'UNKNOWN';
  unidadeId?: string;
  objetoId?: string;
  motoristaId?: string;
  sessionId?: string;        // ID do WppPilotSession no banco
  proxySessionId?: string;   // ID do WppProxyPilotSession ativo
  insucessoFluxoId?: string; // Fluxo de insucesso ativo para este destinatário
  botSilenciado?: boolean;   // true quando dispatcher está ativo
  state: 'BOT_ACTIVE' | 'PROXY_ACTIVE' | 'OPTED_OUT' | 'DISPATCHER_ACTIVE' | 'CLOSED';
  locale: string;            // ex: "pt_BR", "en_US"
  timezone: string;          // ex: "America/Sao_Paulo"
  lastActivityAt: number;
  // Sub-estado para fluxos conversacionais (CPF, lead capture)
  subState?: 'AWAITING_CPF' | 'AWAITING_LEAD_CONFIRM' | 'AWAITING_LEAD_NAME' | null;
  tempData?: string;         // Dados temporários (ex: CPF para vincular ao lead)
}

const DRIVER_TTL = 86_400;     // 24h
const RECIPIENT_TTL = 14_400;  // 4h
const INTERNAL_TTL = 86_400;
const UNKNOWN_TTL = 3_600;

function key(instanceName: string, phone: string): string {
  return `wpp_pilot:${instanceName}:session:${phone}`;
}

export const wppSessionService = {
  async get(instanceName: string, phone: string): Promise<WppPilotSession | null> {
    const redis = getRedis();
    if (!redis || !isRedisAvailable()) return null;
    try {
      const raw = await redis.get(key(instanceName, phone));
      return raw ? (JSON.parse(raw) as WppPilotSession) : null;
    } catch (err) {
      logger.error(err, '[WPP-SESSION] Erro ao ler sessão');
      return null;
    }
  },

  async set(session: WppPilotSession): Promise<void> {
    const redis = getRedis();
    if (!redis || !isRedisAvailable()) return;
    const hydrated = await hydrateSessionContext(session);
    const ttl =
      hydrated.participantType === 'CARTEIRO'
        ? DRIVER_TTL
        : hydrated.participantType === 'DESTINATARIO'
          ? RECIPIENT_TTL
          : hydrated.participantType === 'GESTAO' || hydrated.participantType === 'UNIDADE'
            ? INTERNAL_TTL
            : UNKNOWN_TTL;
    hydrated.lastActivityAt = Date.now();
    try {
      await redis.setex(key(hydrated.instanceName, hydrated.phone), ttl, JSON.stringify(hydrated));
    } catch (err) {
      logger.error(err, '[WPP-SESSION] Erro ao salvar sessão');
    }
  },

  async update(
    instanceName: string,
    phone: string,
    patch: Partial<WppPilotSession>,
  ): Promise<WppPilotSession | null> {
    let current = await wppSessionService.get(instanceName, phone);

    // Se não está no Redis, reconstruir a partir do banco
    if (!current) {
      const dbSession = await db.wppPilotSession
        .findUnique({ where: { instanceName_phone: { instanceName, phone } } })
        .catch(() => null);
      if (!dbSession) return null;
      current = {
        instanceName,
        phone,
        participantType: dbSession.participantType as WppPilotSession['participantType'],
        unidadeId: dbSession.unidadeId ?? undefined,
        objetoId: dbSession.objetoId ?? undefined,
        motoristaId: dbSession.carteiroId ?? undefined,
        state: dbSession.state,
        botSilenciado: dbSession.botSilenciado,
        locale: DEFAULT_LOCALE,
        timezone: DEFAULT_TIMEZONE,
        lastActivityAt: Date.now(),
      };
    }

    const updated = await hydrateSessionContext({ ...current, ...patch } as WppPilotSession);
    await wppSessionService.set(updated);
    return updated;
  },

  async delete(instanceName: string, phone: string): Promise<void> {
    const redis = getRedis();
    if (!redis || !isRedisAvailable()) return;
    try {
      await redis.del(key(instanceName, phone));
    } catch (err) {
      logger.error(err, '[WPP-SESSION] Erro ao deletar sessão');
    }
  },
};

async function hydrateSessionContext(session: WppPilotSession): Promise<WppPilotSession> {
  const hydrated = { ...session };

  if (!hydrated.unidadeId && hydrated.motoristaId) {
    const carteiro = await db.carteiro.findUnique({
      where: { id: hydrated.motoristaId },
      select: { unidadeId: true },
    }).catch(() => null);
    if (carteiro?.unidadeId) hydrated.unidadeId = carteiro.unidadeId;
  }

  if (!hydrated.unidadeId && hydrated.objetoId) {
    const objeto = await db.objeto.findUnique({
      where: { id: hydrated.objetoId },
      select: { unidadeId: true },
    }).catch(() => null);
    if (objeto?.unidadeId) hydrated.unidadeId = objeto.unidadeId;
  }

  if (!hydrated.objetoId && hydrated.participantType === 'DESTINATARIO') {
    const objeto = await resolveLatestObjetoByPhone(hydrated.phone);
    if (objeto) {
      hydrated.objetoId = objeto.id;
      hydrated.unidadeId = hydrated.unidadeId ?? objeto.unidadeId;
    }
  }

  return hydrated;
}

async function resolveLatestObjetoByPhone(phone: string): Promise<{ id: string; unidadeId: string } | null> {
  const { last8, last9 } = phoneMatchSuffixes(phone);
  return db.objeto.findFirst({
    where: {
      OR: [
        { destinatarioTelefone: { endsWith: last9 } },
        { destinatarioTelefone: { endsWith: last8 } },
      ],
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, unidadeId: true },
  }).catch(() => null);
}
