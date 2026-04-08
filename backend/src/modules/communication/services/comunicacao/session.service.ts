/**
 * session.service.ts
 * Sessões Redis para o módulo WPP-PILOT
 * Reutiliza o cliente Redis já existente no projeto (config/redis.ts)
 */
import { getRedis, isRedisAvailable } from '../../../../shared/utils/redis';
import { db } from '../../types/prisma-extended';
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from '../../utils/locale';
import logger from '../../../../shared/utils/logger';

export interface WppPilotSession {
  instanceName: string;
  phone: string;
  participantType: 'CARTEIRO' | 'DESTINATARIO' | 'UNKNOWN';
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
    const ttl = session.participantType === 'CARTEIRO' ? DRIVER_TTL : RECIPIENT_TTL;
    session.lastActivityAt = Date.now();
    try {
      await redis.setex(key(session.instanceName, session.phone), ttl, JSON.stringify(session));
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
        motoristaId: dbSession.carteiroId ?? undefined,
        state: dbSession.state,
        botSilenciado: dbSession.botSilenciado,
        locale: DEFAULT_LOCALE,
        timezone: DEFAULT_TIMEZONE,
        lastActivityAt: Date.now(),
      };
    }

    const updated = { ...current, ...patch } as WppPilotSession;
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
