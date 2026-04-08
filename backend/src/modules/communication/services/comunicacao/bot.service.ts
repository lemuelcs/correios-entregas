/**
 * bot.service.ts
 * Árvore de decisão do WPP-PILOT com keywords expandidas
 * Multi-locale: mensagens adaptadas ao locale da sessão
 */
import { db } from '../../types/prisma-extended';
import { wppProxyPilotService } from './proxy-pilot.service';
import { WppPilotSession, wppSessionService } from './session.service';
import { sendAndSave } from './wpp-outbound';
import logger from '../../../../shared/utils/logger';
import {
  MENU_KW,
  STOP_KW,
  ROTA_KW,
  INSUCESSO_KW,
  PAGAMENTO_KW,
  STATUS_KW,
  REAGENDAR_KW,
  HANDOFF_KW,
  ONBOARDING_KW,
  matchesAny,
} from './keywords';
import { t } from './i18n/messages';
import { getGreeting } from './i18n/greetings';

// ── Normalização de CPF ─────────────────────────────────────────
function normalizeCPF(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 11) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  return digits;
}

// ── Bot Service ─────────────────────────────────────────────────
export const wppBotService = {
  async handleMotorista(
    instanceName: string,
    phone: string,
    content: string,
    session: WppPilotSession,
    dspNome: string,
    dspId: string,
    locale: string,
    timezone: string,
  ): Promise<void> {
    if (session.botSilenciado) return;

    const text = content.trim().toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const greeting = getGreeting(locale, timezone);

    // ── Onboarding: carteiro em processo (stub — não há onboarding no correios-entregas)
    // No modelo correios-entregas, Carteiro não tem campo 'status' de onboarding.

    // ── Encerrar proxy ativo ─────────────────────────────────────
    if (session.proxySessionId && matchesAny(text, STOP_KW)) {
      await wppProxyPilotService.endSession(session.proxySessionId, 'MOTORISTA_ENDED');
      return;
    }

    // ── Handoff para humano ──────────────────────────────────────
    if (matchesAny(text, HANDOFF_KW)) {
      const { handoffService } = await import('./handoff.service');
      await handoffService.requestHumanHandoff(
        instanceName, phone, session, dspId, dspNome, content, locale,
      );
      return;
    }

    // ── Menu ─────────────────────────────────────────────────────
    if (matchesAny(text, MENU_KW)) {
      let menuText = t(locale, 'menu_motorista', { dspNome, greeting });
      // Resumo da rota pela manhã
      const h = parseInt(
        new Date().toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }),
      );
      if (h >= 5 && h < 12 && session.motoristaId) {
        const resumo = await _getRouteSummary(session.motoristaId, timezone, locale);
        if (resumo) menuText += `\n\n${resumo}`;
      }
      await sendAndSave(instanceName, phone, menuText, 500);
      return;
    }

    // ── Opções numéricas + keywords ──────────────────────────────
    if (text === '1' || matchesAny(text, ROTA_KW)) {
      await _rotaMotorista(instanceName, phone, session, locale, dspNome);
      return;
    }

    if (text === '2' || matchesAny(text, INSUCESSO_KW)) {
      await _insucessosMotorista(instanceName, phone, session, locale);
      return;
    }

    if (text === '3' || matchesAny(text, PAGAMENTO_KW)) {
      await _pagamentoMotorista(instanceName, phone, session, locale);
      return;
    }

    if (text === '4') {
      await sendAndSave(instanceName, phone, t(locale, 'proxy_instrucao'), 400);
      return;
    }

    // ── LLM fallback (se habilitado) ─────────────────────────────
    const llmResponse = await _tryLlmFallback(dspId, dspNome, 'CARTEIRO', phone, content, session);
    if (llmResponse) {
      if (llmResponse.escalate) {
        const { handoffService } = await import('./handoff.service');
        await handoffService.requestHumanHandoff(
          instanceName, phone, session, dspId, dspNome, content, locale,
        );
        return;
      }
      await sendAndSave(instanceName, phone, llmResponse.text, 500);
      return;
    }

    await sendAndSave(instanceName, phone, t(locale, 'nao_entendi'), 500);
  },

  async handleDestinatario(
    instanceName: string,
    phone: string,
    content: string,
    session: WppPilotSession,
    dspNome: string,
    dspId: string,
    locale: string,
    _timezone: string,
  ): Promise<void> {
    if (session.botSilenciado) return;

    const text = content.trim().toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const greeting = getGreeting(locale, _timezone);

    // ── Handoff para humano ──────────────────────────────────────
    if (matchesAny(text, HANDOFF_KW)) {
      const { handoffService } = await import('./handoff.service');
      await handoffService.requestHumanHandoff(
        instanceName, phone, session, dspId, dspNome, content, locale,
      );
      return;
    }

    if (matchesAny(text, MENU_KW)) {
      await sendAndSave(instanceName, phone, t(locale, 'menu_destinatario', { dspNome, greeting }), 500);
      return;
    }

    if (text === '1' || matchesAny(text, STATUS_KW)) {
      await _statusDestinatario(instanceName, phone, locale);
      return;
    }

    if (text === '2' || matchesAny(text, REAGENDAR_KW)) {
      await sendAndSave(instanceName, phone, t(locale, 'reagendar_info', { dspNome }), 500);
      return;
    }

    // NPS: nota de 1 a 10
    const nota = parseInt(text);
    if (!isNaN(nota) && nota >= 1 && nota <= 10) {
      await _registrarNps(instanceName, phone, nota, locale);
      return;
    }

    // ── LLM fallback (se habilitado) ─────────────────────────────
    const llmResponse = await _tryLlmFallback(dspId, dspNome, 'DESTINATARIO', phone, content, session);
    if (llmResponse) {
      if (llmResponse.escalate) {
        const { handoffService } = await import('./handoff.service');
        await handoffService.requestHumanHandoff(
          instanceName, phone, session, dspId, dspNome, content, locale,
        );
        return;
      }
      await sendAndSave(instanceName, phone, llmResponse.text, 500);
      return;
    }

    await sendAndSave(instanceName, phone, t(locale, 'nao_entendi'), 500);
  },

  async handleUnknown(
    instanceName: string,
    phone: string,
    content: string,
    session: WppPilotSession,
    dspNome: string,
    dspId: string,
    locale: string,
  ): Promise<void> {
    const text = content.trim().toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

    // ── Sub-fluxo: aguardando CPF ────────────────────────────────
    if (session.subState === 'AWAITING_CPF') {
      const cpf = normalizeCPF(content);
      if (!cpf) {
        await sendAndSave(instanceName, phone, t(locale, 'cpf_invalido'), 500);
        return;
      }

      // Buscar carteiro por CPF (via usuario.cpf → carteiro)
      const carteiro = await db.carteiro
        .findFirst({
          where: { usuario: { cpf }, unidadeId: dspId },
          select: { id: true, usuario: { select: { nome: true } } },
        })
        .catch(() => null);

      if (carteiro) {
        // Limpar cache e re-resolver como carteiro
        await wppSessionService.delete(instanceName, phone);
        await sendAndSave(
          instanceName, phone,
          t(locale, 'cpf_encontrado', { nome: carteiro.usuario.nome }),
          500,
        );
        return;
      }

      // CPF não encontrado — oferecer cadastro como lead
      await wppSessionService.update(instanceName, phone, {
        subState: 'AWAITING_LEAD_CONFIRM',
        tempData: cpf,
      } as Partial<WppPilotSession>);
      await sendAndSave(instanceName, phone, t(locale, 'cpf_nao_encontrado'), 500);
      return;
    }

    // ── Sub-fluxo: confirmar cadastro lead ───────────────────────
    if (session.subState === 'AWAITING_LEAD_CONFIRM') {
      const SIM_KW = ['SIM', 'SI', 'YES', 'S', 'QUERO', 'CLARO', 'COM CERTEZA', 'PODE SER'];
      const NAO_KW = ['NAO', 'NO', 'N', 'NAO QUERO', 'AGORA NAO'];

      if (SIM_KW.includes(text) || SIM_KW.some((k) => text.includes(k))) {
        await wppSessionService.update(instanceName, phone, {
          subState: 'AWAITING_LEAD_NAME',
        } as Partial<WppPilotSession>);
        await sendAndSave(instanceName, phone, t(locale, 'lead_confirmar'), 500);
        return;
      }

      if (NAO_KW.includes(text) || NAO_KW.some((k) => text.includes(k))) {
        await wppSessionService.update(instanceName, phone, {
          subState: undefined,
          tempData: undefined,
        } as Partial<WppPilotSession>);
        await sendAndSave(instanceName, phone, t(locale, 'lead_cancelado'), 500);
        return;
      }

      // Repetir a pergunta
      await sendAndSave(instanceName, phone, t(locale, 'cpf_nao_encontrado'), 500);
      return;
    }

    // ── Sub-fluxo: receber nome para lead ────────────────────────
    if (session.subState === 'AWAITING_LEAD_NAME') {
      const nome = content.trim();
      if (nome.length < 3) {
        await sendAndSave(instanceName, phone, t(locale, 'lead_confirmar'), 500);
        return;
      }

      try {
        // TODO: integrar com módulo de leads quando disponível no correios-entregas
        const normalizedPhone = phone.replace(/\D/g, '');
        const localPhone = normalizedPhone.startsWith('55') && normalizedPhone.length >= 12
          ? normalizedPhone.slice(2)
          : normalizedPhone;

        logger.info({ nome, phone: localPhone, cpf: (session as any).tempData }, '[WPP-PILOT] Lead recebido (sem módulo CRM)');

        await wppSessionService.update(instanceName, phone, {
          subState: undefined,
          tempData: undefined,
        } as Partial<WppPilotSession>);

        await sendAndSave(instanceName, phone, t(locale, 'lead_criado', { link: '' }), 500);
      } catch (err) {
        logger.error(err, '[WPP-PILOT] Erro ao processar lead');
        await sendAndSave(instanceName, phone, t(locale, 'lead_erro'), 500);
      }
      return;
    }

    // ── Primeiro contato: pedir CPF ──────────────────────────────
    await wppSessionService.set({
      ...session,
      subState: 'AWAITING_CPF',
    } as WppPilotSession);
    await sendAndSave(instanceName, phone, t(locale, 'cpf_solicitar', { dspNome }), 500);
  },
};

// ── Handlers internos ────────────────────────────────────────────

async function _getRouteSummary(
  carteiroId: string,
  timezone: string,
  locale: string,
): Promise<string | null> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const rota = await db.rota
    .findFirst({
      where: {
        carteiroId,
        createdAt: { gte: hoje },
        statusAtual: { in: ['DISPONIVEL', 'COLETADA', 'EM_ANDAMENTO'] },
      },
    })
    .catch(() => null);

  if (!rota) return null;

  const horario = rota.horarioDespachoAlvo
    ? new Date(rota.horarioDespachoAlvo).toLocaleTimeString(
        locale === 'en_US' ? 'en-US' : 'pt-BR',
        { hour: '2-digit', minute: '2-digit', timeZone: timezone },
      )
    : '–';

  return t(locale, 'rota_resumo', {
    paradas: rota.totalParadas ?? '–',
    horario,
  });
}

async function _rotaMotorista(
  instanceName: string,
  phone: string,
  session: WppPilotSession,
  locale: string,
  _dspNome: string,
): Promise<void> {
  if (!session.motoristaId) {
    await sendAndSave(instanceName, phone, t(locale, 'rota_sem_cadastro'), 500);
    return;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const rota = await db.rota
    .findFirst({
      where: {
        carteiroId: session.motoristaId,
        createdAt: { gte: hoje },
        statusAtual: { in: ['DISPONIVEL', 'COLETADA', 'EM_ANDAMENTO'] },
      },
    })
    .catch(() => null);

  if (!rota) {
    await sendAndSave(instanceName, phone, t(locale, 'rota_nenhuma'), 500);
    return;
  }

  const horario = rota.horarioDespachoAlvo
    ? new Date(rota.horarioDespachoAlvo).toLocaleTimeString(
        locale === 'en_US' ? 'en-US' : 'pt-BR',
        { hour: '2-digit', minute: '2-digit', timeZone: session.timezone },
      )
    : t(locale, 'rota_horario_confirmar');

  await sendAndSave(
    instanceName,
    phone,
    t(locale, 'rota_detalhe', {
      codigo: rota.id.slice(-8),
      paradas: rota.totalParadas ?? '–',
      horario,
      status: rota.statusAtual,
    }),
    500,
  );
}

async function _insucessosMotorista(
  instanceName: string,
  phone: string,
  session: WppPilotSession,
  locale: string,
): Promise<void> {
  if (!session.motoristaId) return;

  // Contar objetos com insucesso (tentativa sem atendimento) nas rotas do carteiro
  const count = await db.objeto
    .count({
      where: {
        rota: { carteiroId: session.motoristaId },
        statusAtual: 'TENTATIVA_SEM_ATENDIMENTO',
      },
    })
    .catch(() => 0);

  await sendAndSave(
    instanceName,
    phone,
    count > 0 ? t(locale, 'insucessos_count', { count }) : t(locale, 'insucessos_zero'),
    500,
  );
}

async function _pagamentoMotorista(
  instanceName: string,
  phone: string,
  _session: WppPilotSession,
  locale: string,
): Promise<void> {
  // Módulo de faturamento não disponível no correios-entregas
  await sendAndSave(instanceName, phone, t(locale, 'pagamento_nenhum'), 500);
}

async function _statusDestinatario(instanceName: string, phone: string, locale: string): Promise<void> {
  const rawDigits = phone.replace(/\D/g, '');
  let digits = rawDigits.startsWith('55') && rawDigits.length >= 12 ? rawDigits.slice(2) : rawDigits;
  if (digits.length === 10) digits = digits.slice(0, 2) + '9' + digits.slice(2);

  // Buscar objeto com insucesso para este destinatário (pelo telefone)
  const objeto = await db.objeto
    .findFirst({
      where: {
        destinatarioTelefone: { contains: digits },
        statusAtual: { in: ['TENTATIVA_SEM_ATENDIMENTO', 'DEVOLVIDO_UNIDADE', 'AGUARDANDO_RETIRADA'] },
      },
      orderBy: { updatedAt: 'desc' },
    })
    .catch(() => null);

  if (!objeto) {
    await sendAndSave(instanceName, phone, t(locale, 'status_nenhum'), 500);
    return;
  }

  const statusLabel: Record<string, string> = {
    TENTATIVA_SEM_ATENDIMENTO: '🔄 Aguardando nova tentativa de entrega',
    DEVOLVIDO_UNIDADE: '🏠 Retornado à unidade',
    AGUARDANDO_RETIRADA: '📦 Aguardando retirada na unidade',
  };

  await sendAndSave(
    instanceName,
    phone,
    t(locale, 'status_detalhe', {
      pacote: objeto.codigoRastreio,
      status: statusLabel[objeto.statusAtual] ?? objeto.statusAtual,
    }),
    500,
  );
}

async function _registrarNps(instanceName: string, phone: string, nota: number, locale: string): Promise<void> {
  logger.info({ phone, nota }, '[WPP-PILOT] NPS recebido');
  const msg = nota >= 9 ? t(locale, 'nps_otimo') : nota >= 7 ? t(locale, 'nps_bom') : t(locale, 'nps_ruim');
  await sendAndSave(instanceName, phone, msg, 500);
}

// ── Onboarding status ────────────────────────────────────────────

const ETAPAS_ORDEM = [
  'LOGIN_AMAZON', 'VALIDACAO_CNH', 'CADASTRO_BRK', 'VALIDACAO_BRK',
  'AUTORIZACAO_TOXICOLOGICO', 'COLETA_TOXICOLOGICO', 'RESULTADO_TOXICOLOGICO',
  'ACESSO_TREINAMENTO', 'CONCLUSAO_TREINAMENTO', 'ATIVAR_MOTORISTA',
  'ENVIO_CONTRATO', 'ASSINATURA_CONTRATO', 'INFORMAR_DISPONIBILIDADE',
  'INCLUIR_GRUPOS_WHATSAPP', 'ROTA_TREINAMENTO', 'PRIMEIRA_ROTA_NURSERY',
  'ACOMPANHAMENTO_POS_NURSERY',
];

const ETAPA_LABELS: Record<string, string> = {
  LOGIN_AMAZON: '🔑 Login Amazon',
  VALIDACAO_CNH: '📄 Validação CNH',
  CADASTRO_BRK: '🏢 Cadastro BRK',
  VALIDACAO_BRK: '✅ Validação BRK',
  AUTORIZACAO_TOXICOLOGICO: '🧪 Autorização Toxicológico',
  COLETA_TOXICOLOGICO: '🩺 Coleta Toxicológico',
  RESULTADO_TOXICOLOGICO: '📊 Resultado Toxicológico',
  ACESSO_TREINAMENTO: '📚 Acesso ao Treinamento',
  CONCLUSAO_TREINAMENTO: '🎓 Conclusão do Treinamento',
  ATIVAR_MOTORISTA: '🚗 Ativação como Motorista',
  ENVIO_CONTRATO: '📝 Envio do Contrato',
  ASSINATURA_CONTRATO: '✍️ Assinatura do Contrato',
  INFORMAR_DISPONIBILIDADE: '📅 Informar Disponibilidade',
  INCLUIR_GRUPOS_WHATSAPP: '💬 Grupos WhatsApp',
  ROTA_TREINAMENTO: '🗺️ Rota de Treinamento',
  PRIMEIRA_ROTA_NURSERY: '🚀 Primeira Rota',
  ACOMPANHAMENTO_POS_NURSERY: '📈 Acompanhamento Pós-Nursery',
};

const ETAPA_ORIENTACAO: Record<string, string> = {
  LOGIN_AMAZON: 'Acesse o link enviado pela equipe para criar seu login Amazon Flex.',
  VALIDACAO_CNH: 'Envie uma foto da sua CNH (frente e verso) pelo app ou ao gestor.',
  CADASTRO_BRK: 'Realize seu cadastro na plataforma BRK conforme instruções enviadas.',
  VALIDACAO_BRK: 'Aguarde a validação do seu cadastro BRK. Em caso de pendência, consulte o gestor.',
  AUTORIZACAO_TOXICOLOGICO: 'Solicite a autorização para realizar o exame toxicológico.',
  COLETA_TOXICOLOGICO: 'Compareça ao laboratório indicado para coleta do exame toxicológico.',
  RESULTADO_TOXICOLOGICO: 'Aguarde o resultado do exame toxicológico.',
  ACESSO_TREINAMENTO: 'Acesse a plataforma de treinamento com o login fornecido.',
  CONCLUSAO_TREINAMENTO: 'Complete todos os módulos de treinamento obrigatórios.',
  ATIVAR_MOTORISTA: 'Sua ativação está sendo processada. Aguarde confirmação.',
  ENVIO_CONTRATO: 'O contrato será enviado para assinatura digital. Fique atento ao e-mail.',
  ASSINATURA_CONTRATO: 'Assine o contrato digital enviado ao seu e-mail.',
  INFORMAR_DISPONIBILIDADE: 'Informe ao gestor seus dias e horários disponíveis para rotas.',
  INCLUIR_GRUPOS_WHATSAPP: 'Você será incluído nos grupos de WhatsApp operacionais.',
  ROTA_TREINAMENTO: 'Participe da rota de treinamento acompanhado por um mentor.',
  PRIMEIRA_ROTA_NURSERY: 'Realize sua primeira rota no programa Nursery.',
  ACOMPANHAMENTO_POS_NURSERY: 'Período de acompanhamento pós-nursery. Conte com o suporte do gestor.',
};

async function _onboardingStatus(
  instanceName: string,
  phone: string,
  _session: WppPilotSession,
  locale: string,
): Promise<void> {
  // Onboarding não disponível no correios-entregas
  await sendAndSave(instanceName, phone, t(locale, 'onboarding_preparando'), 500);
}

// ── LLM fallback ─────────────────────────────────────────────────

async function _tryLlmFallback(
  dspId: string,
  _dspNome: string,
  participantType: 'CARTEIRO' | 'DESTINATARIO',
  phone: string,
  content: string,
  session: WppPilotSession,
): Promise<{ text: string; escalate?: boolean; reason?: string } | null> {
  try {
    const { wppPilotLlmAdapter } = await import('./llm-adapter.service');
    return await wppPilotLlmAdapter.processUnmatchedMessage(
      dspId, _dspNome, participantType, phone, content,
      session.motoristaId, session.timezone,
    );
  } catch {
    // LLM não disponível ou não configurado — fallback silencioso
    return null;
  }
}
