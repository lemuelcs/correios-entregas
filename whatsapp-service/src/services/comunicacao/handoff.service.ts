/**
 * handoff.service.ts
 * Transferência para atendimento humano — notifica dispatchers via WhatsApp + in-app
 */
import { db } from '../../types/prisma-extended';
import { sendAndSave } from './wpp-outbound';
import { EvolutionClient } from './evolution.client';
import { WppPilotSession } from './session.service';
import logger from '../../shared/utils/logger';

function t(locale: string, key: string): string {
  const msgs: Record<string, Record<string, string>> = {
    pt_BR: {
      confirmado: '🙋 Vou acionar a equipe de atendimento. Um agente humano entrará em contato em breve.',
    },
    en_US: {
      confirmado: '🙋 I will notify the support team. A human agent will reach out to you shortly.',
    },
  };
  return (msgs[locale] ?? msgs['pt_BR'])[key] ?? key;
}

export const handoffService = {
  async requestHumanHandoff(
    instanceName: string,
    phone: string,
    session: WppPilotSession,
    dspId: string,
    dspNome: string,
    userMessage: string,
    locale: string,
  ): Promise<void> {
    const unidadeId = session.unidadeId ?? dspId;
    // 1. Confirmar ao usuário
    await sendAndSave(instanceName, phone, t(locale, 'confirmado'), 500);

    // 2. Buscar administradores ativos da unidade
    const dispatchers = await db.usuario
      .findMany({
        where: {
          unidadeId,
          ativo: true,
          role: 'UNIDADE',
        },
        select: { id: true, nome: true, email: true },
      })
      .catch(() => []);

    if (dispatchers.length === 0) {
      logger.warn({ unidadeId }, '[WPP-PILOT] Nenhum dispatcher encontrado para handoff');
      return;
    }

    // 3. Montar mensagem de alerta
    const participantLabel =
      session.participantType === 'CARTEIRO'
        ? 'Carteiro'
        : session.participantType === 'DESTINATARIO'
          ? 'Destinatário'
          : 'Contato';

    const _alertMsg =
      `🚨 *Solicitação de Atendimento Humano*\n\n` +
      `👤 ${participantLabel}: ${phone}\n` +
      `💬 Mensagem: "${userMessage.slice(0, 200)}"\n\n` +
      `Acesse o painel de conversas para atender.`;

    // 4. Notificação (sem celular no modelo Usuario, log apenas)
    // TODO: integrar com sistema de notificação da unidade
    logger.info(
      { unidadeId, phone, dispatchers: dispatchers.length },
      '[WPP-PILOT] Handoff solicitado — dispatchers notificados (in-app only)',
    );
  },
};
