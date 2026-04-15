/**
 * webhook.handler.ts
 * Entrada única para webhooks (Multi-Tenant & White-Label)
 */
import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../../types/prisma-extended';
import { EvolutionClient, EvolutionWebhookPayload } from './evolution.client';
import { evolutionClient } from './evolution.client';
import { participantService } from './participant.service';
import { wppSessionService } from './session.service';
import { wppProxyPilotService } from './proxy-pilot.service';
import { wppBotService } from './bot.service';
import { updateDeliveryStatus, sendAndSave } from './wpp-outbound';
import { transcribeAudioMessage } from './audio.service';
import { mapRawDeliveryStatus } from '../../utils/delivery-status';
import { normalizePhoneE164, extractPhoneFromJid } from '../../utils/phone';
import { shortLang } from '../../utils/locale';
import logger from '../../shared/utils/logger';

export async function handleInboundWebhook(req: Request, res: Response): Promise<void> {
  // 200 OK para evitar retentativas infinitas da Evolution API
  res.status(200).json({ ok: true });

  const payload = req.body as EvolutionWebhookPayload;
  const instanceName = payload.instance;

  // ── 1. STATUS DE CONEXÃO ──────────────────────────────────────
  if (payload.event === 'connection.update') {
    const state: string = (payload.data as any)?.state ?? 'unknown';
    await db.wppPilotConfig.updateMany({
      where: { instanceName },
      data: {
        connected: state === 'open',
        connectedAt: state === 'open' ? new Date() : undefined,
        lastWebhookAt: new Date(),
      },
    }).catch(err => logger.warn(err, '[WPP-WEBHOOK] Falha ao atualizar connection status'));
    return;
  }

  // ── 2. CONFIRMAÇÃO DE ENTREGA ─────────────────────────────────
  if (payload.event === 'messages.update') {
    const updates: any[] = Array.isArray(payload.data) ? payload.data : [payload.data];
    for (const upd of updates) {
      if (!upd?.key?.fromMe || !upd.key.id) continue;
      const status = mapRawDeliveryStatus(upd.update?.status ?? upd.status ?? '');
      if (status) await updateDeliveryStatus(upd.key.id, status);
    }
    return;
  }

  if (payload.event !== 'messages.upsert') return;
  if (payload.data?.key?.fromMe === true) return;

  // ── 3. PROCESSAMENTO DE MENSAGEM RECEBIDA ─────────────────────
  const remoteJid = payload.data?.key?.remoteJid ?? '';
  if (remoteJid.endsWith('@g.us')) return; // Ignorar grupos

  const phone = normalizePhoneE164(extractPhoneFromJid(remoteJid));
  let content = EvolutionClient.extractText(payload);
  const waMessageId = payload.data?.key?.id;
  const messageType = payload.data?.messageType ?? 'conversation';

  // Buscar Config do Tenant/Instância
  const config = await db.wppPilotConfig.findUnique({ where: { instanceName } });
  if (!config) {
    logger.warn({ instanceName }, '[WPP-WEBHOOK] Instância não reconhecida');
    return;
  }

  // Atualizar timestamp de atividade
  await db.wppPilotConfig.update({
    where: { id: config.id },
    data: { lastWebhookAt: new Date() }
  }).catch(() => null);

  // ── 4. TRANSCRIÇÃO DE ÁUDIO ───────────────────────────────────
  if (messageType === 'audioMessage' && !content && waMessageId) {
    const transcribed = await transcribeAudioMessage(instanceName, waMessageId, remoteJid, shortLang(config.locale));
    if (transcribed) content = transcribed;
  }

  // ── 5. RESOLVER SESSÃO & PARTICIPANTE ────────────────────────
  const session = await participantService.resolveParticipant(
    instanceName, 
    phone, 
    config.locale, 
    config.timezone
  );

  // Reativar bot se o usuário enviou OI/HI após opt-out
  if (session.state === 'OPTED_OUT') {
    if (['OI', 'HI', 'MENU'].includes(content.trim().toUpperCase())) {
      session.state = 'BOT_ACTIVE';
      await wppSessionService.update(instanceName, phone, { state: 'BOT_ACTIVE' });
    } else {
      return; // Permanece em opt-out
    }
  }

  // Persistir Mensagem & Sessão no Banco Local
  await _upsertSessionInDb(instanceName, phone, session);
  const isNew = await _saveMessage(instanceName, phone, waMessageId, messageType, content, session);
  if (!isNew) return; // Dedup

  // ── 6. ROTEAMENTO DE LÓGICA ───────────────────────────────────

  // A. Proxy Ativo (Driver <-> Addressee)
  if (session.state === 'PROXY_ACTIVE' && session.proxySessionId) {
    await wppProxyPilotService.relayMessage(instanceName, phone, content, session.proxySessionId);
    return;
  }

  // B. Atendimento Humano (Dispatcher)
  if (session.state === 'DISPATCHER_ACTIVE' || session.botSilenciado) {
    return; // Silencia o bot se houver um humano na conversa
  }

  // C. Chatbot White-Label (Cascata: Keywords -> Flow -> LLM)
  await wppBotService.handleMessage(
    instanceName,
    phone,
    content,
    session,
    config
  );
}

/**
 * Helpers de Persistência Local
 */

async function _upsertSessionInDb(instanceName: string, phone: string, session: any) {
  await db.wppPilotSession.upsert({
    where: { instanceName_phone: { instanceName, phone } },
    update: {
      participantType: session.participantType,
      tenantId: session.tenantId,
      stationId: session.stationId,
      driverId: session.motoristaId || session.driverId,
      addresseeId: session.addresseeId,
      packId: session.objetoId || session.packId,
      lastMessageAt: new Date(),
      totalMessages: { increment: 1 },
      state: session.state,
    },
    create: {
      instanceName,
      phone,
      participantType: session.participantType,
      tenantId: session.tenantId,
      stationId: session.stationId,
      driverId: session.motoristaId || session.driverId,
      addresseeId: session.addresseeId,
      packId: session.objetoId || session.packId,
      lastMessageAt: new Date(),
      state: session.state,
    },
  });
}

async function _saveMessage(instanceName: string, phone: string, waId: string | undefined, type: string, content: string, session: any) {
  const dbSession = await db.wppPilotSession.findUnique({
    where: { instanceName_phone: { instanceName, phone } },
  });
  if (!dbSession) return false;

  try {
    await db.wppPilotMessage.create({
      data: {
        sessionId: dbSession.id,
        waMessageId: waId,
        direction: 'INBOUND',
        messageType: type,
        content: content || null,
        isProxied: session.state === 'PROXY_ACTIVE',
        proxySessionId: session.proxySessionId,
      },
    });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') return false; // Duplicada
    throw err;
  }
}
