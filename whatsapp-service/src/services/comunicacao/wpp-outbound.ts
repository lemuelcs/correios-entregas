/**
 * wpp-outbound.ts
 * Persiste mensagens OUTBOUND do WPP-PILOT no banco de dados.
 *
 * Sem isso, mensagens enviadas pelo bot/sistema não criam sessão e não aparecem
 * no dashboard de conversas. Chamado de bot.service.ts, insucesso-wpp.service.ts
 * e do endpoint /notify.
 */
import { db } from '../../types/prisma-extended';
import { evolutionClient, EvolutionClient } from './evolution.client';
import { participantService } from './participant.service';
import { wppSessionService, type WppPilotSession } from './session.service';
import logger from '../../shared/utils/logger';

interface SendOpts {
  number: string;
  text: string;
  delay?: number;
}

/**
 * Envia mensagem WhatsApp E salva no banco como OUTBOUND.
 * Faz upsert da WppPilotSession para que a conversa apareça no dashboard
 * mesmo quando o motorista ainda não respondeu.
 */
export async function sendAndSave(
  instanceName: string,
  phone: string,
  text: string,
  delay?: number,
  unidadeId?: string | null,
): Promise<string | undefined> {
  // Normalizar telefone para E.164 (sem +) antes de enviar
  const normalizedPhone = EvolutionClient.normalizePhone(phone);
  const sessionContext =
    (await wppSessionService.get(instanceName, normalizedPhone).catch(() => null))
    ?? (await participantService.resolveParticipant(instanceName, normalizedPhone).catch(() => null));

  let waMessageId: string | undefined;
  try {
    waMessageId = await evolutionClient.sendText(instanceName, { number: normalizedPhone, text, delay });
  } catch (err) {
    logger.error(err, '[WPP-OUTBOUND] Falha ao enviar mensagem');
    throw err;
  }

  // Persiste de forma síncrona para garantir que a sessão e mensagem
  // existam no banco antes de qualquer webhook ou consulta do frontend
  try {
    await _persistOutbound(instanceName, phone, waMessageId, text, sessionContext ?? undefined, unidadeId);
  } catch (err) {
    logger.error(err, '[WPP-OUTBOUND] Falha ao persistir mensagem');
  }

  return waMessageId;
}

/**
 * Atualiza o deliveryStatus de uma mensagem OUTBOUND quando o Evolution API
 * notifica via webhook messages.update.
 */
export async function updateDeliveryStatus(
  waMessageId: string,
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
): Promise<void> {
  await db.wppPilotMessage
    .updateMany({
      where: { waMessageId },
      data: { deliveryStatus: status },
    })
    .catch((err: unknown) => logger.error(err, '[WPP-OUTBOUND] Falha ao atualizar deliveryStatus'));
}

// ── Interno ──────────────────────────────────────────────────────────

async function _persistOutbound(
  instanceName: string,
  phone: string,
  waMessageId: string | undefined,
  content: string,
  sessionContext?: WppPilotSession,
  fallbackUnidadeId?: string | null,
): Promise<void> {
  // Normalizar telefone para evitar sessões duplicadas
  const normalizedPhone = EvolutionClient.normalizePhone(phone);
  const participantType = sessionContext?.participantType ?? 'UNKNOWN';
  // Prioridade: contexto de sessão > parâmetro explícito
  const resolvedUnidadeId = sessionContext?.unidadeId ?? fallbackUnidadeId ?? undefined;

  // Upsert da sessão: cria se não existe, atualiza lastMessageAt se já existe
  const session = await db.wppPilotSession.upsert({
    where: { instanceName_phone: { instanceName, phone: normalizedPhone } },
    update: {
      participantType: participantType as any,
      unidadeId: resolvedUnidadeId,
      objetoId: sessionContext?.objetoId ?? undefined,
      carteiroId: sessionContext?.motoristaId ?? undefined,
      lastMessageAt: new Date(),
      totalMessages: { increment: 1 },
    },
    create: {
      instanceName,
      phone: normalizedPhone,
      participantType: participantType as any,
      unidadeId: resolvedUnidadeId,
      objetoId: sessionContext?.objetoId ?? undefined,
      carteiroId: sessionContext?.motoristaId ?? undefined,
      lastMessageAt: new Date(),
      state: 'BOT_ACTIVE',
      totalMessages: 1,
    },
  });

  // Salva a mensagem OUTBOUND
  await db.wppPilotMessage.create({
    data: {
      sessionId: session.id,
      waMessageId: waMessageId ?? null,
      direction: 'OUTBOUND',
      messageType: 'conversation',
      content,
      deliveryStatus: 'SENT',
    },
  });
}
