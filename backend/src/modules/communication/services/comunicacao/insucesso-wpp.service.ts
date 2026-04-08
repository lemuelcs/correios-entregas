/**
 * insucesso-wpp.service.ts
 * Fluxo de insucesso WPP-PILOT:
 *   1. Verifica se PacoteInsucesso tem destinatarioTelefone
 *   2. Envia mensagem ao destinatário perguntando nova tentativa hoje ou amanhã
 *   3. Aguarda resposta (timeout configurável)
 *   4. Encaminha resultado ao motorista
 */
import { db } from '../../types/prisma-extended';
import { evolutionClient } from './evolution.client';
import { wppSessionService } from './session.service';
import logger from '../../../../shared/utils/logger';

const DEFAULT_TIMEOUT_MIN = (): number =>
  parseInt(process.env.WPP_INSUCESSO_TIMEOUT_MIN ?? '15');

export const insucessoWppService = {
  async iniciarFluxo(opts: {
    pacoteInsucessoId: string;
    instanceName: string;
    dspId: string;
    motoristaId: string;
    motoristaPhone: string;
    rotaId?: string;
    dspNome: string;
    locale?: string;
    timezone?: string;
  }): Promise<{ fluxoId: string; status: string }> {
    const { pacoteInsucessoId, instanceName, dspId, motoristaId, motoristaPhone, rotaId, dspNome } = opts;
    const locale = opts.locale ?? 'pt_BR';
    const timeoutMin = DEFAULT_TIMEOUT_MIN();

    // Buscar dados do objeto (equivalente a pacoteInsucesso)
    const pacote = await db.objeto.findUnique({ where: { id: pacoteInsucessoId } });
    if (!pacote) {
      logger.warn({ pacoteInsucessoId }, '[INSUCESSO-WPP] Objeto não encontrado');
      return { fluxoId: '', status: 'PACOTE_NOT_FOUND' };
    }

    const destPhone = pacote.destinatarioTelefone
      ? String(pacote.destinatarioTelefone).replace(/\D/g, '').slice(-11)
      : null;
    const destNome: string = pacote.destinatarioNome ?? 'Destinatário';

    // Idempotência: evitar fluxo duplo
    const existente = await db.wppInsucessoFluxo.findFirst({
      where: { pacoteInsucessoId, status: 'AGUARDANDO_RESPOSTA' },
    });
    if (existente) return { fluxoId: existente.id, status: 'JA_ATIVO' };

    // ── Sem telefone ─────────────────────────────────────────────
    if (!destPhone) {
      const fluxo = await db.wppInsucessoFluxo.create({
        data: {
          instanceName,
          unidadeId: dspId,
          carteiroId: motoristaId,
          carteiroPhone: motoristaPhone,
          pacoteInsucessoId,
          rotaId,
          status: 'SEM_TELEFONE',
          expiresAt: new Date(),
        },
      });

      await evolutionClient.sendText(instanceName, {
        number: motoristaPhone,
        text: `⚠️ *Insucesso registrado*\n\n📦 Pacote: ${pacote.codigoRastreio}\n👤 ${destNome}\n\nO destinatário não tem telefone cadastrado. Não foi possível contato automático. Consulte o gestor.`,
        delay: 500,
      });

      return { fluxoId: fluxo.id, status: 'SEM_TELEFONE' };
    }

    // ── Com telefone ──────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + timeoutMin * 60_000);

    const fluxo = await db.wppInsucessoFluxo.create({
      data: {
        instanceName,
        unidadeId: dspId,
        carteiroId: motoristaId,
        carteiroPhone: motoristaPhone,
        pacoteInsucessoId,
        rotaId,
        destinatarioPhone: destPhone,
        destinatarioNome: destNome,
        status: 'AGUARDANDO_RESPOSTA',
        expiresAt,
      },
    });

    // Marcar sessão Redis do destinatário com fluxoId
    const sessaoAtual = await wppSessionService.get(instanceName, destPhone);
    await wppSessionService.set({
      instanceName,
      phone: destPhone,
      participantType: 'DESTINATARIO',
      state: 'BOT_ACTIVE',
      locale,
      timezone: opts.timezone ?? 'America/Sao_Paulo',
      insucessoFluxoId: fluxo.id,
      lastActivityAt: Date.now(),
      ...sessaoAtual,
    });

    // Mensagem ao destinatário (localizada)
    const msgDest =
      locale === 'en_US'
        ? `📦 *${dspNome}*\n\nHello${destNome !== 'Destinatário' ? `, ${destNome.split(' ')[0]}` : ''}! We tried to deliver your package but could not complete it.\n\n*What do you prefer?*\n\n*1* – The driver can try again today\n*2* – I prefer to reschedule for tomorrow\n\n_Reply within ${timeoutMin} minutes._`
        : `📦 *${dspNome}*\n\nOlá${destNome !== 'Destinatário' ? `, ${destNome.split(' ')[0]}` : ''}! Tentamos realizar sua entrega mas não conseguimos completá-la.\n\n*O que você prefere?*\n\n*1* – O motorista pode tentar novamente ainda hoje\n*2* – Prefiro reagendar para amanhã\n\n_Responda nos próximos ${timeoutMin} minutos._`;

    try {
      await evolutionClient.sendText(instanceName, { number: destPhone, text: msgDest, delay: 500 });
      await db.wppInsucessoFluxo.update({
        where: { id: fluxo.id },
        data: { mensagemEnviadaEm: new Date() },
      });
    } catch (err) {
      await db.wppInsucessoFluxo.update({
        where: { id: fluxo.id },
        data: { status: 'ERRO_ENVIO' },
      });
      logger.error(err, '[INSUCESSO-WPP] Erro ao enviar mensagem ao destinatário');
      return { fluxoId: fluxo.id, status: 'ERRO_ENVIO' };
    }

    // Timeout em memória (piloto). Em produção: usar Bull queue
    setTimeout(
      () => insucessoWppService.expirarFluxo(fluxo.id, instanceName, locale).catch((e) => logger.error(e, '[INSUCESSO-WPP] Erro ao expirar fluxo')),
      timeoutMin * 60_000,
    );

    logger.info({ fluxoId: fluxo.id, destPhone }, '[INSUCESSO-WPP] Fluxo iniciado');
    return { fluxoId: fluxo.id, status: 'AGUARDANDO_RESPOSTA' };
  },

  async processarResposta(
    fluxoId: string,
    content: string,
    instanceName: string,
    dspNome: string,
    locale = 'pt_BR',
  ): Promise<boolean> {
    const fluxo = await db.wppInsucessoFluxo.findUnique({ where: { id: fluxoId } });
    if (!fluxo || fluxo.status !== 'AGUARDANDO_RESPOSTA') return false;

    if (new Date() > fluxo.expiresAt) {
      await insucessoWppService.expirarFluxo(fluxoId, instanceName, locale);
      return true;
    }

    const text = content
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

    let novoStatus: 'RETORNO_HOJE' | 'REAGENDADO' | null = null;

    if (text === '1' || text.includes('HOJE') || text.includes('AGORA') || text.includes('PODE') || text.includes('TODAY')) {
      novoStatus = 'RETORNO_HOJE';
    } else if (text === '2' || text.includes('AMANHA') || text.includes('REAGENDAR') || text.includes('TOMORROW')) {
      novoStatus = 'REAGENDADO';
    }

    if (!novoStatus) {
      const pedir =
        locale === 'en_US'
          ? `I didn't understand. Please reply:\n\n*1* – Driver can return today\n*2* – Reschedule for tomorrow`
          : `Não entendi. Por favor:\n\n*1* – Motorista pode retornar ainda hoje\n*2* – Reagendar para amanhã`;
      await evolutionClient.sendText(instanceName, { number: fluxo.destinatarioPhone!, text: pedir, delay: 300 });
      return true;
    }

    // Confirmar ao destinatário
    const confirmDest =
      novoStatus === 'RETORNO_HOJE'
        ? locale === 'en_US'
          ? `✅ Got it! The driver will try to return today.\nYou'll receive a notification when he is on the way.`
          : `✅ Combinado! O motorista tentará retornar ainda hoje.\nAguarde a notificação quando ele estiver a caminho.`
        : locale === 'en_US'
          ? `✅ Noted! Your delivery will be rescheduled for tomorrow.\nYou'll receive a notification when the driver leaves.`
          : `✅ Anotado! Sua entrega será reagendada para amanhã.\nVocê receberá notificação quando o motorista sair.`;

    await evolutionClient.sendText(instanceName, { number: fluxo.destinatarioPhone!, text: confirmDest, delay: 400 });

    // Encaminhar resultado ao motorista
    const msgMot =
      novoStatus === 'RETORNO_HOJE'
        ? `✅ *Resposta do destinatário*\n\n📦 Pacote: ...${fluxo.pacoteInsucessoId.slice(-6)}\n👤 ${fluxo.destinatarioNome ?? 'Destinatário'} respondeu:\n\n"Pode retornar ainda hoje" ✓\n\nSe precisar de contato direto, use o botão no app.`
        : `📅 *Resposta do destinatário*\n\n📦 Pacote: ...${fluxo.pacoteInsucessoId.slice(-6)}\n👤 ${fluxo.destinatarioNome ?? 'Destinatário'} respondeu:\n\n"Prefere reagendar para amanhã" 📆\n\nConfirme o reagendamento no app.`;

    await evolutionClient.sendText(instanceName, { number: fluxo.carteiroPhone, text: msgMot, delay: 400 });

    await db.wppInsucessoFluxo.update({
      where: { id: fluxoId },
      data: {
        status: novoStatus,
        respostaRaw: content,
        respostaRecebidaEm: new Date(),
        carteiroNotificadoEm: new Date(),
      },
    });

    // Limpar fluxoId da sessão Redis do destinatário
    if (fluxo.destinatarioPhone) {
      await wppSessionService
        .update(instanceName, fluxo.destinatarioPhone, { insucessoFluxoId: undefined })
        .catch(() => {});
    }

    logger.info({ fluxoId, novoStatus }, '[INSUCESSO-WPP] Fluxo concluído');
    return true;
  },

  async expirarFluxo(fluxoId: string, instanceName: string, locale = 'pt_BR'): Promise<void> {
    const fluxo = await db.wppInsucessoFluxo.findUnique({ where: { id: fluxoId } });
    if (!fluxo || fluxo.status !== 'AGUARDANDO_RESPOSTA') return;

    await db.wppInsucessoFluxo.update({ where: { id: fluxoId }, data: { status: 'SEM_RESPOSTA' } });

    const timeoutMin = DEFAULT_TIMEOUT_MIN();
    const msg =
      locale === 'en_US'
        ? `⏱️ *No response from recipient*\n\n📦 Package: ...${fluxo.pacoteInsucessoId.slice(-6)}\n👤 ${fluxo.destinatarioNome ?? 'Recipient'} did not respond in ${timeoutMin} minutes.\n\nConsult the manager or use the button in the app for direct contact.`
        : `⏱️ *Sem resposta do destinatário*\n\n📦 Pacote: ...${fluxo.pacoteInsucessoId.slice(-6)}\n👤 ${fluxo.destinatarioNome ?? 'Destinatário'} não respondeu em ${timeoutMin} minutos.\n\nConsulte o gestor ou use o botão no app para contato direto.`;

    await evolutionClient.sendText(instanceName, { number: fluxo.carteiroPhone, text: msg, delay: 400 });

    if (fluxo.destinatarioPhone) {
      await wppSessionService
        .update(instanceName, fluxo.destinatarioPhone, { insucessoFluxoId: undefined })
        .catch(() => {});
    }

    logger.info({ fluxoId }, '[INSUCESSO-WPP] Fluxo expirado sem resposta');
  },

  /** Executar no startup para recuperar fluxos que expiraram durante restart do PM2 */
  async recuperarFluxosExpiradosNoStartup(): Promise<void> {
    const expirados = await db.wppInsucessoFluxo
      .findMany({ where: { status: 'AGUARDANDO_RESPOSTA', expiresAt: { lt: new Date() } } })
      .catch(() => []);

    for (const f of expirados as any[]) {
      await insucessoWppService.expirarFluxo(f.id, f.instanceName).catch(() => {});
    }
    logger.info({ count: expirados.length }, '[INSUCESSO-WPP] Fluxos expirados recuperados no startup');
  },
};
