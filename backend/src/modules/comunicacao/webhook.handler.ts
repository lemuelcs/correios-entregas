import crypto from 'crypto';
import { type Request, type Response } from 'express';
import { EvolutionClient, type EvolutionWebhookPayload, evolutionClient } from './evolution.client';
import { participantService } from './participant.service';
import { pilotProxyService } from './proxy.service';
import { pilotBotService } from './bot.service';
import { pilotSessionService } from './session.service';
import { prisma } from '../../shared/utils/prisma';

// ── Validação HMAC do webhook ─────────────────────────────────────────────────

function validateWebhookSecret(req: Request): boolean {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!secret) return true; // Desabilitado em dev
  const received = (req.headers['x-evolution-secret'] as string) ?? '';
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  // padEnd garante buffers de mesmo tamanho para timingSafeEqual
  return crypto.timingSafeEqual(
    Buffer.from(received.padEnd(64, '0')),
    Buffer.from(expected.padEnd(64, '0')),
  );
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function handleInboundWebhook(req: Request, res: Response): Promise<void> {
  // Responder imediatamente – Evolution API não aguarda processamento
  res.status(200).json({ ok: true });

  if (!validateWebhookSecret(req)) {
    console.warn('[webhook] Secret inválido – payload ignorado');
    return;
  }

  const payload = req.body as EvolutionWebhookPayload;

  // Apenas mensagens recebidas
  if (payload.event !== 'messages.upsert') return;
  if (payload.data?.key?.fromMe === true) return;

  const remoteJid = payload.data?.key?.remoteJid ?? '';
  if (remoteJid.endsWith('@g.us')) return; // Ignorar grupos

  const instanceName = payload.instance;
  const phone = EvolutionClient.extractPhone(remoteJid);
  const content = EvolutionClient.extractText(payload);
  const waMessageId = payload.data?.key?.id;
  const messageType = payload.data?.messageType ?? 'conversation';

  console.log(`[webhook] ${instanceName} ← ${phone} (${messageType}): "${content.slice(0, 40)}"`);

  // Atualizar timestamp
  prisma.pilotWaConfig
    .updateMany({ where: { instanceName }, data: { lastWebhookAt: new Date() } })
    .catch(() => {});

  // ── Opt-out ────────────────────────────────────────────────────────────────
  const config = await prisma.pilotWaConfig
    .findUnique({ where: { instanceName } })
    .catch(() => null);
  const optOutKeywords = (config?.optOutKeywords as string[]) ?? ['PARAR', 'SAIR', 'STOP'];

  if (optOutKeywords.some((k) => content.toUpperCase().includes(k))) {
    await pilotSessionService.update(instanceName, phone, { state: 'OPTED_OUT' }).catch(() => {});
    await evolutionClient
      .sendText(instanceName, {
        number: phone,
        text: 'Você foi removido das notificações. Para reativar, envie *OI*.',
        delay: 300,
      })
      .catch(() => {});
    return;
  }

  // Verificar estado OPTED_OUT em cache
  const existingSession = await pilotSessionService.get(instanceName, phone);
  if (existingSession?.state === 'OPTED_OUT') {
    // Permitir reativação com OI
    if (!['OI', 'OLÁ', 'OLA'].includes(content.trim().toUpperCase())) return;
    await pilotSessionService.update(instanceName, phone, { state: 'BOT_ACTIVE' });
  }

  // ── Resolver participante ─────────────────────────────────────────────────
  const session = await participantService.resolveParticipant(instanceName, phone);

  // Upsert da sessão no banco
  prisma.pilotWaSession
    .upsert({
      where: { instanceName_phone: { instanceName, phone } },
      create: {
        instanceName,
        phone,
        participantType: session.participantType as any,
        carteiroId: session.carteiroId,
        state: session.state as any,
        lastMessageAt: new Date(),
        totalMessages: 1,
      },
      update: {
        lastMessageAt: new Date(),
        totalMessages: { increment: 1 },
        state: session.state as any,
      },
    })
    .catch(() => {});

  // Salvar mensagem recebida
  prisma.pilotWaSession
    .findUnique({ where: { instanceName_phone: { instanceName, phone } } })
    .then((dbSession) => {
      if (!dbSession) return;
      return prisma.pilotWaMessage.create({
        data: {
          sessionId: dbSession.id,
          waMessageId,
          direction: 'INBOUND',
          messageType,
          content,
          isProxied: session.state === 'PROXY_ACTIVE',
          proxySessionId: session.proxySessionId,
        },
      });
    })
    .catch(() => {});

  // Marcar como lida
  if (waMessageId) {
    evolutionClient.markAsRead(instanceName, waMessageId, phone).catch(() => {});
  }

  // ── Roteamento ────────────────────────────────────────────────────────────

  // Proxy ativo → relay
  if (session.state === 'PROXY_ACTIVE' && session.proxySessionId) {
    await pilotProxyService.relayMessage(instanceName, phone, content, session.proxySessionId);
    return;
  }

  // Bot por tipo de participante
  switch (session.participantType) {
    case 'CARTEIRO':
      await pilotBotService.handleCarteiro(instanceName, phone, content, session);
      break;
    case 'DESTINATARIO':
      await pilotBotService.handleDestinatario(instanceName, phone, content, session);
      break;
    default:
      await pilotBotService.handleUnknown(instanceName, phone);
  }
}
