/**
 * webhook.handler.ts
 * Entrada única para todos os webhooks do Evolution API (WPP-PILOT)
 * Roteamento: proxy → dispatcher (silenciado) → insucesso → bot por tipo
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
import { insucessoWppService } from './insucesso-wpp.service';
import { updateDeliveryStatus, sendAndSave } from './wpp-outbound';
import { transcribeAudioMessage } from './audio.service';
import { mapRawDeliveryStatus } from '../../utils/delivery-status';
import { normalizePhoneE164, extractPhoneFromJid } from '../../utils/phone';
import { resolveLocale, resolveTimezone, resolveDspNome, shortLang } from '../../utils/locale';
import logger from '../../../../shared/utils/logger';

function validateWebhookSecret(req: Request): boolean {
  const secret = process.env.EVOLUTION_PILOT_WEBHOOK_SECRET;
  if (!secret) return true; // sem secret configurado → aceita tudo (dev)
  const received = (req.headers['x-evolution-secret'] as string) ?? '';
  // Comparação segura contra timing attacks
  try {
    const exp = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(received.padEnd(64, '0').slice(0, 64)),
      Buffer.from(exp.padEnd(64, '0').slice(0, 64)),
    );
  } catch {
    return false;
  }
}

export async function handleInboundWebhook(req: Request, res: Response): Promise<void> {
  // Responder 200 imediatamente para não travar o Evolution API
  res.status(200).json({ ok: true });

  if (!validateWebhookSecret(req)) {
    logger.warn('[WPP-PILOT] Webhook com secret inválido — rejeitado');
    return;
  }

  const payload = req.body as EvolutionWebhookPayload;
  const instanceName = payload.instance;

  // ── Confirmação de entrega/leitura ────────────────────────────
  if (payload.event === 'messages.update') {
    const updates: any[] = Array.isArray(payload.data) ? payload.data : [payload.data];
    for (const upd of updates) {
      if (!upd?.key?.fromMe || !upd.key.id) continue;
      const status = mapRawDeliveryStatus(upd.update?.status ?? upd.status ?? '');
      if (status) await updateDeliveryStatus(upd.key.id, status).catch(err => logger.warn(err, '[WPP-PILOT] Falha ao atualizar delivery status'));
    }
    return;
  }

  // ── Atualização de status de conexão ──────────────────────────
  if (payload.event === 'connection.update') {
    const state: string = (payload.data as any)?.state ?? 'unknown';
    await db.wppPilotConfig
      .updateMany({
        where: { instanceName },
        data: {
          connected: state === 'open',
          connectedAt: state === 'open' ? new Date() : undefined,
          lastWebhookAt: new Date(),
        },
      })
      .catch(err => logger.warn(err, '[WPP-PILOT] Falha ao atualizar connection status'));
    logger.info({ instanceName, state }, '[WPP-PILOT] connection.update');
    return;
  }

  if (payload.event !== 'messages.upsert') return;
  if (payload.data?.key?.fromMe === true) return;

  const remoteJid = payload.data?.key?.remoteJid ?? '';
  if (remoteJid.endsWith('@g.us')) return; // ignorar grupos
  const phone = normalizePhoneE164(extractPhoneFromJid(remoteJid));
  let content = EvolutionClient.extractText(payload);
  const waMessageId = payload.data?.key?.id;
  const messageType = payload.data?.messageType ?? 'conversation';

  logger.debug({ instanceName, phone, content: content.slice(0, 40), messageType }, '[WPP-PILOT] Webhook recebido');

  // Dedup: ignorar mensagem já processada
  if (waMessageId) {
    const existing = await db.wppPilotMessage.findFirst({
      where: { waMessageId, direction: 'INBOUND' },
      select: { id: true },
    });
    if (existing) {
      logger.debug({ waMessageId }, '[WPP-PILOT] Mensagem duplicada ignorada');
      return;
    }
  }

  // Atualizar lastWebhookAt na config
  await db.wppPilotConfig
    .updateMany({ where: { instanceName }, data: { lastWebhookAt: new Date() } })
    .catch(err => logger.warn(err, '[WPP-PILOT] Falha ao atualizar lastWebhookAt'));

  const config = await db.wppPilotConfig.findUnique({ where: { instanceName } });
  if (!config) {
    logger.warn({ instanceName }, '[WPP-PILOT] Config não encontrada — ignorando mensagem');
    return;
  }

  const dspId: string = config.unidadeId;
  const dspNome = resolveDspNome(config);
  const locale = resolveLocale(config);
  const timezone = resolveTimezone(config);

  // ── Transcrição de áudio ──────────────────────────────────────
  if (messageType === 'audioMessage' && !content && waMessageId) {
    const lang = shortLang(locale);
    const transcribed = await transcribeAudioMessage(instanceName, waMessageId, remoteJid, lang);
    if (transcribed) {
      content = transcribed;
      const confirmMsg = locale === 'en_US'
        ? `🎤 _Understood:_ "${transcribed.slice(0, 200)}"`
        : `🎤 _Entendi:_ "${transcribed.slice(0, 200)}"`;
      await sendAndSave(instanceName, phone, confirmMsg, 300);
    } else {
      const errorMsg = locale === 'en_US'
        ? '🎤 Could not process the audio. Please send a text message.'
        : '🎤 Não consegui processar o áudio. Por favor, envie uma mensagem de texto.';
      await sendAndSave(instanceName, phone, errorMsg, 300);
      return;
    }
  }

  // ── Opt-out ───────────────────────────────────────────────────
  const optOutKeywords: string[] = (config.optOutKeywords as string[]) ?? ['PARAR', 'SAIR', 'STOP'];
  if (optOutKeywords.some((k: string) => content.trim().toUpperCase().includes(k))) {
    await wppSessionService.update(instanceName, phone, { state: 'OPTED_OUT' });
    await evolutionClient.sendText(instanceName, {
      number: phone,
      text: locale === 'en_US'
        ? '✅ You have been removed from notifications. To reactivate, send *HI*.'
        : '✅ Você foi removido das notificações. Para reativar, envie *OI*.',
      delay: 300,
    });
    return;
  }

  // Resolver participante (cache Redis ou banco)
  const session = await participantService.resolveParticipant(instanceName, phone, locale, timezone, config.unidadeId);

  // Reativar se estava em opt-out e enviou OI/HI
  if (session.state === 'OPTED_OUT') {
    if (!['OI', 'OLÁ', 'OLA', 'HI', 'HELLO'].includes(content.trim().toUpperCase())) return;
    await wppSessionService.update(instanceName, phone, { state: 'BOT_ACTIVE' });
  }

  // Persistir sessão ANTES de salvar mensagem (evita race condition)
  await _upsertSessionInDb(instanceName, phone, session).catch((e) => logger.error(e, '[WPP-PILOT] upsertSession'));

  // Salvar mensagem de forma síncrona — unique constraint em waMessageId garante dedup contra race conditions
  const saved = await _saveMessage(instanceName, phone, waMessageId, messageType, content, session);
  if (!saved) {
    logger.debug({ waMessageId }, '[WPP-PILOT] Mensagem duplicada (constraint) — ignorando');
    return;
  }

  if (waMessageId) evolutionClient.markAsRead(instanceName, waMessageId, phone).catch(() => {});

  // ── Proxy ativo → relay direto ─────────────────────────────────
  if (session.state === 'PROXY_ACTIVE' && session.proxySessionId) {
    await wppProxyPilotService.relayMessage(instanceName, phone, content, session.proxySessionId);
    return;
  }

  // ── Dispatcher ativo → bot silenciado, mensagem salva acima ───
  if (session.state === 'DISPATCHER_ACTIVE' || session.botSilenciado) return;

  // ── Fluxo de insucesso ativo para destinatário ─────────────────
  if (session.participantType === 'DESTINATARIO' && (session as any).insucessoFluxoId) {
    const processado = await insucessoWppService.processarResposta(
      (session as any).insucessoFluxoId,
      content,
      instanceName,
      dspNome,
      locale,
    );
    if (processado) return;
  }

  // ── Bot por tipo de participante ───────────────────────────────
  switch (session.participantType) {
    case 'CARTEIRO':
      await wppBotService.handleMotorista(instanceName, phone, content, session, dspNome, dspId, locale, timezone);
      break;
    case 'DESTINATARIO':
      await wppBotService.handleDestinatario(instanceName, phone, content, session, dspNome, dspId, locale, timezone);
      break;
    default:
      await wppBotService.handleUnknown(instanceName, phone, content, session, dspNome, dspId, locale);
  }
}

// ── Helpers internos ─────────────────────────────────────────────

async function _upsertSessionInDb(
  instanceName: string,
  phone: string,
  session: Awaited<ReturnType<typeof participantService.resolveParticipant>>,
): Promise<void> {
  await db.wppPilotSession.upsert({
    where: { instanceName_phone: { instanceName, phone } },
    update: {
      participantType: session.participantType as any,
      carteiroId: session.motoristaId,
      lastMessageAt: new Date(),
      totalMessages: { increment: 1 },
      state: session.state as any,
    },
    create: {
      instanceName,
      phone,
      participantType: session.participantType as any,
      carteiroId: session.motoristaId,
      lastMessageAt: new Date(),
      state: session.state as any,
    },
  });
}

async function _saveMessage(
  instanceName: string,
  phone: string,
  waMessageId: string | undefined,
  messageType: string,
  content: string,
  session: Awaited<ReturnType<typeof participantService.resolveParticipant>>,
): Promise<boolean> {
  const dbSession = await db.wppPilotSession.findUnique({
    where: { instanceName_phone: { instanceName, phone } },
  });
  if (!dbSession) return false;

  try {
    await db.wppPilotMessage.create({
      data: {
        sessionId: dbSession.id,
        waMessageId,
        direction: 'INBOUND',
        messageType,
        content: content || null,
        isProxied: session.state === 'PROXY_ACTIVE',
        proxySessionId: session.proxySessionId,
      },
    });
    return true;
  } catch (err: any) {
    // Unique constraint violation (P2002) = mensagem duplicada
    if (err?.code === 'P2002') return false;
    logger.error(err, '[WPP-PILOT] Erro ao salvar mensagem');
    return false;
  }
}
