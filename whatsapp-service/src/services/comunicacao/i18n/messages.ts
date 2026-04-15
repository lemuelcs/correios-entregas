/**
 * messages.ts
 * Sistema de Internacionalização White-Label com Nomenclatura Dinâmica.
 * Suporta override via banco de dados e substituição de termos (unit, agent, pack).
 */

export type MessageKey =
  | 'menu_driver'
  | 'menu_addressee'
  | 'route_none'
  | 'route_summary'
  | 'route_detail'
  | 'route_not_found'
  | 'route_time_confirm'
  | 'issue_zero'
  | 'issue_count'
  | 'payment_none'
  | 'payment_detail'
  | 'proxy_instruction'
  | 'unknown_participant'
  | 'not_understood'
  | 'close_channel'
  | 'nps_great'
  | 'nps_good'
  | 'nps_bad'
  | 'status_none'
  | 'status_detail'
  | 'reschedule_info'
  | 'id_request'
  | 'id_found'
  | 'id_not_found'
  | 'id_invalid'
  | 'handoff_confirmed'
  | 'audio_understood'
  | 'audio_error'
  | 'greeting_morning'
  | 'greeting_afternoon'
  | 'greeting_evening';

const defaultMessages: Record<string, Record<string, string>> = {
  pt_BR: {
    menu_driver:
      '🏍️ *Assistente {orgName}*\n\n{greeting}! Escolha uma opção:\n\n*1* – Ver {routeTerm} do dia\n*2* – Insucessos pendentes\n*3* – Próximo pagamento\n*4* – Abrir canal com {customerTerm}\n\nOu envie *ENCERRAR* para fechar canal ativo.',
    menu_addressee:
      '📦 *{orgName}*\n\n{greeting}! Como posso ajudar?\n\n*1* – Status da minha {packTerm}\n*2* – Informações sobre reagendamento\n\nApós receber seu {packTerm}, envie uma *nota de 1 a 10* para avaliar!',
    route_none: '📋 Nenhuma {routeTerm} atribuída para hoje. Verifique com a {unitTerm}.',
    route_summary: '📋 *{routeTerm} de hoje:* {stops} paradas, despacho {time}',
    route_detail:
      '🗺️ *Sua {routeTerm} de hoje*\n\n📋 Código: {code}\n📦 Paradas: {stops}\n⏰ Despacho: {time}\n✅ Status: {status}',
    route_not_found: '⚠️ Não identificamos seu cadastro. Consulte a {unitTerm}.',
    route_time_confirm: 'a confirmar',
    issue_zero: '✅ Nenhum insucesso pendente. Excelente trabalho!',
    issue_count:
      '⚠️ Você tem *{count} {packTerm}(s)* com insucesso pendente.\nAcesse o app para verificar e registrar nova tentativa.',
    payment_none: '💳 Nenhuma fatura em aberto. Verifique o app para histórico.',
    payment_detail:
      '💳 *Seu próximo pagamento*\n\n📅 Período: {start} a {end}\n💰 Valor: R$ {value}\n📊 Status: {status}',
    proxy_instruction:
      '📱 Para abrir canal com o {customerTerm}, use o botão *"Chamar {customerTerm}"* no app na tela da parada.',
    unknown_participant:
      '📍 Este é o canal da *{orgName}*.\n\nNão identificamos seu cadastro.\n\n• Se você é *{agentTerm} parceiro*, confirme seu telefone na {unitTerm}.\n• Se você aguarda uma *{packTerm}*, fique atento: você receberá notificações automáticas aqui.',
    not_understood: 'Não entendi. Envie *MENU* para ver as opções.',
    close_channel: '✅ Canal com {customerTerm} encerrado.',
    nps_great: '⭐ Obrigado! Ficamos felizes que a entrega foi ótima!',
    nps_good: '😊 Obrigado pelo feedback!',
    nps_bad: '😔 Obrigado. Vamos melhorar!',
    status_none:
      '📦 Não encontrei {packTerm}s ativas vinculadas a este número.\nFique atento: você receberá uma notificação quando o {agentTerm} sair.',
    status_detail: '📦 *Status da sua {packTerm}*\n\n🔖 {packTerm}: {code}\n📊 Status: {status}',
    reschedule_info:
      '📅 Para reagendar, entre em contato com a {orgName}.\nVocê receberá uma notificação automática quando o {agentTerm} sair para entrega.',
    id_request:
      '🔍 Não identifiquei seu cadastro.\n\nPor favor, envie seu *identificador* (CPF ou CNPJ) para que eu possa localizar sua conta.',
    id_found: '✅ Identificador encontrado! Olá, *{name}*! Seu telefone foi vinculado à sua conta.',
    id_not_found: '❌ Identificador não encontrado em nossa base.',
    id_invalid: '⚠️ Identificador inválido.',
    handoff_confirmed:
      '🙋 Vou acionar a equipe de atendimento. Um agente humano entrará em contato em breve.',
    audio_understood: '🎤 _Entendi:_ "{text}"',
    audio_error: '🎤 Não consegui processar o áudio. Por favor, envie uma mensagem de texto.',
    greeting_morning: 'Bom dia',
    greeting_afternoon: 'Boa tarde',
    greeting_evening: 'Boa noite',
  }
};

interface I18nContext {
  locale: string;
  terminology: {
    unit: string;
    agent: string;
    pack: string;
    customer: string;
    route: string;
  };
  customMessages: Record<string, string>;
  orgName: string;
}

/**
 * Traduz e processa a mensagem aplicando a taxonomia e overrides do tenant.
 */
export function t(
  ctx: I18nContext,
  key: MessageKey,
  vars: Record<string, string | number> = {},
): string {
  const { locale, terminology, customMessages, orgName } = ctx;
  
  // 1. Prioridade: Mensagem customizada do banco
  // 2. Fallback: Mensagem padrão do sistema
  let msg = customMessages[key] || defaultMessages[locale]?.[key] || defaultMessages['pt_BR'][key] || key;

  // 3. Substituir Variaveis de Negocio (Vars)
  const allVars = {
    ...vars,
    orgName,
    unitTerm: terminology.unit,
    agentTerm: terminology.agent,
    packTerm: terminology.pack,
    customerTerm: terminology.customer,
    routeTerm: terminology.route,
  };

  for (const [k, v] of Object.entries(allVars)) {
    msg = msg.replaceAll(`{${k}}`, String(v));
  }

  return msg;
}
