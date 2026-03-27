import Redis from 'ioredis';

export interface WaPilotSession {
  instanceName: string;
  phone: string;
  participantType: 'CARTEIRO' | 'DESTINATARIO' | 'UNKNOWN';
  carteiroId?: string;
  sessionId?: string;        // PilotWaSession.id no banco
  proxySessionId?: string;   // PilotProxySession.id ativo, se houver
  state: 'BOT_ACTIVE' | 'PROXY_ACTIVE' | 'OPTED_OUT';
  lastActivityAt: number;
}

export class PilotSessionService {
  private redis: Redis;

  // Carteiro dura 24h (dia de trabalho); destinatário é pontual (4h)
  private readonly CARTEIRO_TTL = 86_400;
  private readonly DESTINATARIO_TTL = 14_400;
  private readonly UNKNOWN_TTL = 3_600;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (err) => {
      console.error('[pilot-session] Redis error:', err.message);
    });
  }

  private key(instanceName: string, phone: string): string {
    return `pilot:${instanceName}:session:${phone}`;
  }

  async get(instanceName: string, phone: string): Promise<WaPilotSession | null> {
    const raw = await this.redis.get(this.key(instanceName, phone));
    return raw ? (JSON.parse(raw) as WaPilotSession) : null;
  }

  async set(session: WaPilotSession): Promise<void> {
    const ttl =
      session.participantType === 'CARTEIRO'
        ? this.CARTEIRO_TTL
        : session.participantType === 'DESTINATARIO'
          ? this.DESTINATARIO_TTL
          : this.UNKNOWN_TTL;
    session.lastActivityAt = Date.now();
    await this.redis.setex(
      this.key(session.instanceName, session.phone),
      ttl,
      JSON.stringify(session),
    );
  }

  async update(
    instanceName: string,
    phone: string,
    patch: Partial<WaPilotSession>,
  ): Promise<WaPilotSession | null> {
    const current = await this.get(instanceName, phone);
    if (!current) return null;
    const updated = { ...current, ...patch };
    await this.set(updated);
    return updated;
  }

  async delete(instanceName: string, phone: string): Promise<void> {
    await this.redis.del(this.key(instanceName, phone));
  }
}

export const pilotSessionService = new PilotSessionService();
