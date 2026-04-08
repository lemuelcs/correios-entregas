/**
 * proxy-pilot.service.ts
 * Canal bidirecional anônimo motorista ↔ destinatário
 * Criptografia AES-256-GCM para LGPD (número do destinatário nunca exposto)
 */
import crypto from 'crypto';
import { db } from '../../types/prisma-extended';
import { evolutionClient } from './evolution.client';
import { wppSessionService } from './session.service';
import logger from '../../../../shared/utils/logger';

const ENC_KEY = (): Buffer => {
  const k = process.env.PROXY_ENCRYPTION_KEY;
  if (!k || k.length !== 64) throw new Error('PROXY_ENCRYPTION_KEY deve ter 64 chars hex (32 bytes)');
  return Buffer.from(k, 'hex');
};

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(encrypted: string): string {
  const [ivHex, tagHex, encHex] = encrypted.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

export const wppProxyPilotService = {
  async startSession(opts: {
    instanceName: string;
    dspId: string;
    motoristaId: string;
    motoristaPhone: string;
    destinatarioPhone: string;
    dspNome: string;
    rotaId?: string;
    pacoteId?: string;
  }): Promise<string> {
    const { instanceName, dspId, motoristaId, motoristaPhone, destinatarioPhone, dspNome, rotaId, pacoteId } = opts;

    // Idempotência: evitar proxy duplo para o mesmo motorista
    const existing = await db.wppProxyPilotSession.findFirst({
      where: { instanceName, carteiroPhone: motoristaPhone, status: 'ACTIVE' },
    });
    if (existing) return existing.id;

    const config = await db.wppPilotConfig.findUnique({ where: { instanceName } });
    if (!config?.proxyEnabled) throw new Error('Proxy desabilitado para esta instância');

    const expiresAt = new Date(Date.now() + (config.maxProxyHours ?? 4) * 3_600_000);

    const session = await db.wppProxyPilotSession.create({
      data: {
        instanceName,
        unidadeId: dspId,
        carteiroPhone: motoristaPhone,
        carteiroId: motoristaId || undefined,
        destinatarioPhoneEnc: encrypt(destinatarioPhone),
        rotaId,
        paradaId: pacoteId,
        expiresAt,
      },
    });

    // Atualizar sessão Redis do motorista
    await wppSessionService.update(instanceName, motoristaPhone, {
      state: 'PROXY_ACTIVE',
      proxySessionId: session.id,
    });

    // Atualizar/criar sessão Redis do destinatário
    const destSession = await wppSessionService.get(instanceName, destinatarioPhone);
    if (destSession) {
      await wppSessionService.update(instanceName, destinatarioPhone, {
        state: 'PROXY_ACTIVE',
        proxySessionId: session.id,
      });
    } else {
      await wppSessionService.set({
        instanceName,
        phone: destinatarioPhone,
        participantType: 'DESTINATARIO',
        state: 'PROXY_ACTIVE',
        proxySessionId: session.id,
        locale: config.locale ?? 'pt_BR',
        timezone: config.timezone ?? 'America/Sao_Paulo',
        lastActivityAt: Date.now(),
      });
    }

    await evolutionClient.sendText(instanceName, {
      number: destinatarioPhone,
      text: `📱 Um motorista da *${dspNome}* quer falar com você sobre sua entrega.\nAs mensagens são anônimas.\n\nResponda aqui para falar com o entregador.`,
      delay: 500,
    });

    await evolutionClient.sendText(instanceName, {
      number: motoristaPhone,
      text: `✅ Canal aberto com o destinatário.\nSuas mensagens são repassadas de forma anônima.\n\nPara encerrar, envie *ENCERRAR*.`,
      delay: 500,
    });

    logger.info({ sessionId: session.id }, '[WPP-PILOT] Proxy iniciado');
    return session.id;
  },

  async relayMessage(
    instanceName: string,
    fromPhone: string,
    content: string,
    proxySessionId: string,
  ): Promise<void> {
    const session = await db.wppProxyPilotSession.findUnique({
      where: { id: proxySessionId },
    });
    if (!session || session.status !== 'ACTIVE') return;

    const config = await db.wppPilotConfig.findUnique({ where: { instanceName } });

    if (new Date() > session.expiresAt) {
      await wppProxyPilotService.endSession(proxySessionId, 'TIMEOUT');
      return;
    }
    if (session.messageCount >= (config?.maxProxyMessages ?? 50)) {
      await wppProxyPilotService.endSession(proxySessionId, 'MAX_MESSAGES');
      return;
    }

    const isFromMotorista = session.carteiroPhone === fromPhone;
    const targetPhone = isFromMotorista ? decrypt(session.destinatarioPhoneEnc) : session.carteiroPhone;
    const prefix = isFromMotorista ? '🏍️ *Motorista:*\n' : '👤 *Destinatário:*\n';

    await evolutionClient.sendText(instanceName, { number: targetPhone, text: `${prefix}${content}`, delay: 800 });

    // Audit log (apenas hash — LGPD)
    await db.wppProxyPilotAudit.create({
      data: {
        proxySessionId,
        direction: isFromMotorista ? 'MOTORISTA_TO_DEST' : 'DEST_TO_MOTORISTA',
        messageHash: crypto.createHash('sha256').update(content).digest('hex'),
        charCount: content.length,
      },
    });

    await db.wppProxyPilotSession.update({
      where: { id: proxySessionId },
      data: { messageCount: { increment: 1 } },
    });
  },

  async endSession(proxySessionId: string, reason: string): Promise<void> {
    const session = await db.wppProxyPilotSession.findUnique({
      where: { id: proxySessionId },
    });
    if (!session || session.status !== 'ACTIVE') return;

    await db.wppProxyPilotSession.update({
      where: { id: proxySessionId },
      data: { status: 'ENDED', endedAt: new Date(), endReason: reason },
    });

    const msgs: Record<string, string> = {
      TIMEOUT: '⏱️ Canal encerrado por tempo limite.',
      MAX_MESSAGES: '⚠️ Limite de mensagens atingido. Canal encerrado.',
      MOTORISTA_ENDED: '✅ Canal encerrado pelo motorista.',
      GESTOR_ENDED: '📋 Canal encerrado pelo gestor.',
      DELIVERED: '📦 Entrega confirmada. Canal encerrado.',
    };

    const destPhone = decrypt(session.destinatarioPhoneEnc);
    const msg = msgs[reason] ?? 'Canal encerrado.';

    await evolutionClient.sendText(session.instanceName, { number: session.carteiroPhone, text: msg }).catch(() => {});
    await evolutionClient.sendText(session.instanceName, { number: destPhone, text: msg }).catch(() => {});

    await wppSessionService
      .update(session.instanceName, session.carteiroPhone, { state: 'BOT_ACTIVE', proxySessionId: undefined })
      .catch(() => {});
    await wppSessionService
      .update(session.instanceName, destPhone, { state: 'BOT_ACTIVE', proxySessionId: undefined })
      .catch(() => {});

    logger.info({ proxySessionId, reason }, '[WPP-PILOT] Proxy encerrado');
  },
};
