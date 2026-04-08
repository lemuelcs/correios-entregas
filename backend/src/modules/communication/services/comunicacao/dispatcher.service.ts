/**
 * dispatcher.service.ts
 * Intervenção humana em conversas WhatsApp (WPP-PILOT)
 * Dashboard web: lista de conversas ativas + detalhe com chat do dispatcher
 */
import { db } from '../../types/prisma-extended';
import { evolutionClient } from './evolution.client';
import { wppSessionService } from './session.service';
import logger from '../../../../shared/utils/logger';

export interface ConversaAtiva {
  id: string;
  phoneDisplay: string;
  participantType: string;
  state: string;
  totalMessages: number;
  lastMessageAt: Date | null;
  botSilenciado: boolean;
  dispatcherAtivo: boolean;
  dispatcherNome: string | null;
  ultimasMensagens: { direction: string; content: string; createdAt: Date }[];
  dispatcherSessionId: string | null;
}

export interface MensagemConversa {
  id: string;
  createdAt: Date;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  tipo: 'BOT' | 'DISPATCHER';
  remetente: string;
  deliveryStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
}

export const dispatcherService = {
  async entrarConversa(opts: {
    wppSessionId: string;
    instanceName: string;
    dispatcherId: string;
    dispatcherNome: string;
    dspId: string;
    notificar?: boolean;
  }): Promise<{ dispatcherSessionId: string }> {
    const { wppSessionId, instanceName, dispatcherId, dispatcherNome, dspId } = opts;
    const notificar = opts.notificar ?? true;

    const wppSession = await db.wppPilotSession.findUnique({ where: { id: wppSessionId } });
    if (!wppSession) throw new Error('Sessão WhatsApp não encontrada');

    // Encerrar dispatcher anterior se ainda ativo
    await db.wppDispatcherSession.updateMany({
      where: { wppSessionId, ativo: true },
      data: { ativo: false, saidaEm: new Date() },
    });

    const dispSession = await db.wppDispatcherSession.create({
      data: { instanceName, unidadeId: dspId, dispatcherId, dispatcherNome, wppSessionId, ativo: true },
    });

    await db.wppPilotSession.update({
      where: { id: wppSessionId },
      data: {
        dispatcherAtivo: true,
        dispatcherNome,
        dispatcherSince: new Date(),
        botSilenciado: true,
        state: 'DISPATCHER_ACTIVE',
      },
    });

    await wppSessionService.update(instanceName, wppSession.phone, {
      state: 'DISPATCHER_ACTIVE',
      botSilenciado: true,
    });

    if (notificar) {
      await evolutionClient
        .sendText(instanceName, {
          number: wppSession.phone,
          text: `👋 *${dispatcherNome}* entrou na conversa e irá atendê-lo agora.`,
          delay: 400,
        })
        .catch(() => {});
    }

    logger.info({ dispatcherSessionId: dispSession.id, dispatcherNome }, '[DISPATCHER] Entrou na conversa');
    return { dispatcherSessionId: dispSession.id };
  },

  async enviarMensagem(opts: {
    dispatcherSessionId: string;
    content: string;
    instanceName: string;
  }): Promise<void> {
    const dispSession = await db.wppDispatcherSession.findUnique({
      where: { id: opts.dispatcherSessionId },
      include: { wppSession: true },
    });
    if (!dispSession?.ativo) throw new Error('Sessão de dispatcher não está ativa');

    const waMessageId = await evolutionClient.sendText(opts.instanceName, {
      number: dispSession.wppSession.phone,
      text: `💬 *${dispSession.dispatcherNome}:*\n${opts.content}`,
      delay: 300,
    });

    await db.wppDispatcherMsg.create({
      data: {
        dispatcherSessionId: opts.dispatcherSessionId,
        waMessageId,
        content: opts.content,
        direction: 'OUTBOUND',
        toPhone: dispSession.wppSession.phone,
      },
    });
  },

  async sairConversa(opts: {
    dispatcherSessionId: string;
    instanceName: string;
    notificar?: boolean;
  }): Promise<void> {
    const notificar = opts.notificar ?? true;

    const dispSession = await db.wppDispatcherSession.findUnique({
      where: { id: opts.dispatcherSessionId },
      include: { wppSession: true },
    });
    if (!dispSession) return;

    await db.wppDispatcherSession.update({
      where: { id: opts.dispatcherSessionId },
      data: { ativo: false, saidaEm: new Date() },
    });

    await db.wppPilotSession.update({
      where: { id: dispSession.wppSessionId },
      data: {
        dispatcherAtivo: false,
        dispatcherNome: null,
        dispatcherSince: null,
        botSilenciado: false,
        state: 'BOT_ACTIVE',
      },
    });

    await wppSessionService.update(opts.instanceName, dispSession.wppSession.phone, {
      state: 'BOT_ACTIVE',
      botSilenciado: false,
    });

    if (notificar) {
      await evolutionClient
        .sendText(opts.instanceName, {
          number: dispSession.wppSession.phone,
          text: `✅ *${dispSession.dispatcherNome}* encerrou o atendimento. O assistente automático está de volta.\n\nEnvie *MENU* para ver as opções.`,
          delay: 400,
        })
        .catch(() => {});
    }

    logger.info({ dispatcherSessionId: opts.dispatcherSessionId }, '[DISPATCHER] Saiu da conversa');
  },

  async listarConversasAtivas(dspId: string): Promise<ConversaAtiva[]> {
    const config = await db.wppPilotConfig.findFirst({ where: { unidadeId: dspId } });
    if (!config) return [];

    const sessions = await db.wppPilotSession.findMany({
      where: {
        instanceName: config.instanceName,
        state: { not: 'OPTED_OUT' },
        lastMessageAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
      },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 5 },
        dispatcherSessions: { where: { ativo: true }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return sessions.map((s: any) => ({
      id: s.id,
      phoneDisplay: `•••• ${s.phone.slice(-4)}`,
      participantType: s.participantType,
      state: s.state,
      totalMessages: s.totalMessages,
      lastMessageAt: s.lastMessageAt,
      botSilenciado: s.botSilenciado,
      dispatcherAtivo: s.dispatcherAtivo,
      dispatcherNome: s.dispatcherNome ?? null,
      ultimasMensagens: s.messages.map((m: any) => ({
        direction: m.direction,
        content: m.content ? m.content.slice(0, 120) : '[mídia]',
        createdAt: m.createdAt,
      })),
      dispatcherSessionId: s.dispatcherSessions[0]?.id ?? null,
    }));
  },

  async getMensagensConversa(wppSessionId: string, limit = 50): Promise<MensagemConversa[]> {
    const msgs = await db.wppPilotMessage.findMany({
      where: { sessionId: wppSessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const dispMsgs = await db.wppDispatcherMsg.findMany({
      where: { dispatcherSession: { wppSessionId } },
      include: { dispatcherSession: { select: { dispatcherNome: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const todas: MensagemConversa[] = [
      ...msgs.map((m: any) => ({
        id: m.id,
        createdAt: m.createdAt,
        direction: m.direction as 'INBOUND' | 'OUTBOUND',
        content: m.content ?? '[mídia]',
        tipo: 'BOT' as const,
        remetente: m.direction === 'INBOUND' ? 'Participante' : 'Bot',
        deliveryStatus: (m.deliveryStatus ?? (m.direction === 'INBOUND' ? 'READ' : 'SENT')) as MensagemConversa['deliveryStatus'],
      })),
      ...dispMsgs.map((m: any) => ({
        id: m.id,
        createdAt: m.createdAt,
        direction: 'OUTBOUND' as const,
        content: m.content,
        tipo: 'DISPATCHER' as const,
        remetente: m.dispatcherSession.dispatcherNome,
        deliveryStatus: 'SENT' as const,
      })),
    ];

    return todas.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },
};
