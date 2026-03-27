import crypto from 'crypto';
import { prisma } from '../../shared/utils/prisma';
import { evolutionClient } from './evolution.client';
import { pilotSessionService } from './session.service';

function getEncKey(): Buffer {
  const key = process.env.PROXY_ENCRYPTION_KEY;
  if (!key || key.length !== 64) throw new Error('PROXY_ENCRYPTION_KEY deve ter 64 chars hex (32 bytes)');
  return Buffer.from(key, 'hex');
}

export class PilotProxyService {
  // ── Iniciar sessão proxy ──────────────────────────────────────────────────

  async startSession(opts: {
    instanceName: string;
    carteiroId: string;
    carteiroPhone: string;
    destinatarioPhone: string;
    rotaId?: string;
    objetoId?: string;
  }): Promise<string> {
    const { instanceName, carteiroId, carteiroPhone, destinatarioPhone, rotaId, objetoId } = opts;

    // Impedir sessão duplicada
    const existing = await prisma.pilotProxySession.findFirst({
      where: { instanceName, carteiroPhone, status: 'ACTIVE' },
    });
    if (existing) return existing.id;

    const config = await prisma.pilotWaConfig.findUnique({ where: { instanceName } });
    if (!config?.proxyEnabled) throw new Error('Proxy desabilitado para esta instância');

    const expiresAt = new Date(Date.now() + (config.maxProxyHours ?? 4) * 3_600_000);

    const session = await prisma.pilotProxySession.create({
      data: {
        instanceName,
        carteiroPhone,
        carteiroId,
        destinatarioPhoneEnc: this.encrypt(destinatarioPhone),
        rotaId,
        objetoId,
        expiresAt,
      },
    });

    // Atualizar Redis
    await pilotSessionService.update(instanceName, carteiroPhone, {
      state: 'PROXY_ACTIVE',
      proxySessionId: session.id,
    });
    await pilotSessionService.update(instanceName, destinatarioPhone, {
      state: 'PROXY_ACTIVE',
      proxySessionId: session.id,
    });

    // Notificar participantes
    await evolutionClient
      .sendText(instanceName, {
        number: destinatarioPhone,
        text: 'Um carteiro dos Correios está tentando contato sobre sua encomenda.\nAs mensagens são anônimas para proteger sua privacidade.',
        delay: 500,
      })
      .catch((e: Error) => console.error('[proxy] Erro ao notificar destinatário:', e.message));

    await evolutionClient
      .sendText(instanceName, {
        number: carteiroPhone,
        text: 'Canal aberto com o destinatário.\nSuas mensagens serão repassadas de forma anônima.\nPara encerrar, envie *ENCERRAR*.',
        delay: 500,
      })
      .catch((e: Error) => console.error('[proxy] Erro ao notificar carteiro:', e.message));

    console.log(`[proxy] Sessão iniciada: ${session.id}`);
    return session.id;
  }

  // ── Relay de mensagem ─────────────────────────────────────────────────────

  async relayMessage(
    instanceName: string,
    fromPhone: string,
    content: string,
    proxySessionId: string,
  ): Promise<void> {
    const session = await prisma.pilotProxySession.findUnique({ where: { id: proxySessionId } });
    if (!session || session.status !== 'ACTIVE') return;

    // Verificar expiração e limite
    const config = await prisma.pilotWaConfig.findUnique({ where: { instanceName } });
    if (new Date() > session.expiresAt) {
      await this.endSession(proxySessionId, 'TIMEOUT');
      return;
    }
    if (session.messageCount >= (config?.maxProxyMessages ?? 50)) {
      await this.endSession(proxySessionId, 'MAX_MESSAGES');
      return;
    }

    const isFromCarteiro = session.carteiroPhone === fromPhone;
    const targetPhone = isFromCarteiro ? this.decrypt(session.destinatarioPhoneEnc) : session.carteiroPhone;
    const prefix = isFromCarteiro ? '*Carteiro:*\n' : '*Destinatário:*\n';

    await evolutionClient.sendText(instanceName, {
      number: targetPhone,
      text: `${prefix}${content}`,
      delay: 800,
    });

    // Audit log (somente hash – LGPD)
    await prisma.pilotProxyAudit.create({
      data: {
        proxySessionId: session.id,
        direction: isFromCarteiro ? 'CARTEIRO_TO_DEST' : 'DEST_TO_CARTEIRO',
        messageHash: crypto.createHash('sha256').update(content).digest('hex'),
        charCount: content.length,
      },
    });

    await prisma.pilotProxySession.update({
      where: { id: session.id },
      data: { messageCount: { increment: 1 } },
    });
  }

  // ── Encerrar sessão ───────────────────────────────────────────────────────

  async endSession(proxySessionId: string, reason: string): Promise<void> {
    const session = await prisma.pilotProxySession.findUnique({ where: { id: proxySessionId } });
    if (!session || session.status !== 'ACTIVE') return;

    await prisma.pilotProxySession.update({
      where: { id: proxySessionId },
      data: { status: 'ENDED', endedAt: new Date(), endReason: reason },
    });

    const messages: Record<string, string> = {
      TIMEOUT: 'Canal encerrado por tempo limite.',
      MAX_MESSAGES: 'Limite de mensagens atingido. Canal encerrado.',
      CARTEIRO_ENDED: 'Canal encerrado pelo carteiro.',
      MANAGER_ENDED: 'Canal encerrado pelo gestor.',
      DELIVERED: 'Entrega confirmada. Canal encerrado.',
    };
    const msg = messages[reason] ?? 'Canal encerrado.';
    const destPhone = this.decrypt(session.destinatarioPhoneEnc);

    await evolutionClient
      .sendText(session.instanceName, { number: session.carteiroPhone, text: msg })
      .catch(() => {});
    await evolutionClient
      .sendText(session.instanceName, { number: destPhone, text: msg })
      .catch(() => {});

    // Limpar Redis
    await pilotSessionService.update(session.instanceName, session.carteiroPhone, {
      state: 'BOT_ACTIVE',
      proxySessionId: undefined,
    });
    await pilotSessionService.update(session.instanceName, destPhone, {
      state: 'BOT_ACTIVE',
      proxySessionId: undefined,
    });

    console.log(`[proxy] Encerrada: ${proxySessionId}, motivo: ${reason}`);
  }

  // ── Helpers de criptografia AES-256-GCM ──────────────────────────────────

  private encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
  }

  private decrypt(encrypted: string): string {
    const [ivHex, tagHex, encHex] = encrypted.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return (
      decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8')
    );
  }
}

export const pilotProxyService = new PilotProxyService();
