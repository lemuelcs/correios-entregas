/**
 * messages.ts
 * Mensagens internacionalizadas do bot WPP-PILOT.
 * Substitui dicionarios hardcoded em bot.service.ts.
 */

export type MessageKey =
  | 'menu_motorista'
  | 'menu_destinatario'
  | 'rota_nenhuma'
  | 'rota_resumo'
  | 'rota_detalhe'
  | 'rota_sem_cadastro'
  | 'rota_horario_confirmar'
  | 'insucessos_zero'
  | 'insucessos_count'
  | 'pagamento_nenhum'
  | 'pagamento_detalhe'
  | 'proxy_instrucao'
  | 'desconhecido'
  | 'nao_entendi'
  | 'encerrar_canal'
  | 'nps_otimo'
  | 'nps_bom'
  | 'nps_ruim'
  | 'status_nenhum'
  | 'status_detalhe'
  | 'reagendar_info'
  | 'cpf_solicitar'
  | 'cpf_encontrado'
  | 'cpf_nao_encontrado'
  | 'cpf_invalido'
  | 'lead_confirmar'
  | 'lead_criado'
  | 'lead_cancelado'
  | 'lead_erro'
  | 'handoff_confirmado'
  | 'onboarding_preparando'
  | 'onboarding_suspenso'
  | 'audio_entendi'
  | 'audio_erro'
  | 'greeting_morning'
  | 'greeting_afternoon'
  | 'greeting_evening';

const messages: Record<string, Record<MessageKey, string>> = {
  pt_BR: {
    menu_motorista:
      '🏍️ *Assistente {dspNome}*\n\n{greeting}! Escolha uma opção:\n\n*1* – Ver rota do dia\n*2* – Insucessos pendentes\n*3* – Próximo pagamento\n*4* – Abrir canal com destinatário\n\nOu envie *ENCERRAR* para fechar canal ativo.',
    menu_destinatario:
      '📦 *{dspNome}*\n\n{greeting}! Como posso ajudar?\n\n*1* – Status da minha entrega\n*2* – Informações sobre reagendamento\n\nApós receber seu pacote, envie uma *nota de 1 a 10* para avaliar!',
    rota_nenhuma: '📋 Nenhuma rota atribuída para hoje. Verifique com o gestor.',
    rota_resumo: '📋 *Rota de hoje:* {paradas} paradas, despacho {horario}',
    rota_detalhe:
      '🗺️ *Sua rota de hoje*\n\n📋 Código: {codigo}\n📦 Paradas: {paradas}\n⏰ Despacho: {horario}\n✅ Status: {status}',
    rota_sem_cadastro: '⚠️ Não identificamos seu cadastro. Consulte o gestor.',
    rota_horario_confirmar: 'a confirmar',
    insucessos_zero: '✅ Nenhum insucesso pendente. Excelente trabalho!',
    insucessos_count:
      '⚠️ Você tem *{count} entrega(s)* com insucesso pendente.\nAcesse o app para verificar e registrar nova tentativa.',
    pagamento_nenhum: '💳 Nenhuma fatura em aberto. Verifique o app para histórico.',
    pagamento_detalhe:
      '💳 *Seu próximo pagamento*\n\n📅 Período: {inicio} a {fim}\n💰 Valor: R$ {valor}\n📊 Status: {status}\n\nAcesse o app para detalhes e ateste.',
    proxy_instrucao:
      '📱 Para abrir canal com o destinatário, use o botão *"Chamar Destinatário"* no app Delivyo na tela da parada.',
    desconhecido:
      '📍 Este é o canal da *{dspNome}*.\n\nNão identificamos seu cadastro.\n\n• Se você é *motorista parceiro*, confirme seu telefone com o gestor.\n• Se você aguarda uma *entrega*, fique atento: você receberá notificações automáticas aqui.',
    nao_entendi: 'Não entendi. Envie *MENU* para ver as opções.',
    encerrar_canal: '✅ Canal com destinatário encerrado.',
    nps_otimo: '⭐ Obrigado! Ficamos felizes que a entrega foi ótima!',
    nps_bom: '😊 Obrigado pelo feedback!',
    nps_ruim: '😔 Obrigado. Vamos melhorar!',
    status_nenhum:
      '📦 Não encontrei entregas ativas vinculadas a este número.\nFique atento: você receberá uma notificação quando o motorista sair.',
    status_detalhe: '📦 *Status da sua entrega*\n\n🔖 Pacote: {pacote}\n📊 Status: {status}',
    reagendar_info:
      '📅 Para reagendar, entre em contato com a {dspNome}.\nVocê receberá uma notificação automática quando o motorista sair para entrega.',
    cpf_solicitar:
      '🔍 Não identifiquei seu cadastro.\n\nPor favor, envie seu *CPF* (só números ou com pontuação) para que eu possa localizar sua conta.',
    cpf_encontrado: '✅ CPF encontrado! Olá, *{nome}*! Seu telefone foi vinculado à sua conta.',
    cpf_nao_encontrado:
      '❌ CPF não encontrado em nossa base.\n\nDeseja se cadastrar como *motorista parceiro*? Envie *SIM* ou *NÃO*.',
    cpf_invalido: '⚠️ CPF inválido. Envie 11 dígitos (ex: 123.456.789-00 ou 12345678900).',
    lead_confirmar: 'Qual seu *nome completo*?',
    lead_criado:
      '✅ Pré-cadastro iniciado!\n\nComplete seu registro em: {link}\n\nLá você vai enviar seus documentos (CNH, CRLV, MEI).\nAguarde nosso contato! 🚀',
    lead_cancelado: 'Sem problemas! Se precisar de algo, envie *MENU*.',
    lead_erro: '⚠️ Ocorreu um erro. Tente novamente mais tarde ou entre em contato com o gestor.',
    handoff_confirmado:
      '🙋 Vou acionar a equipe de atendimento. Um agente humano entrará em contato em breve.',
    onboarding_preparando: '📋 Seu onboarding está sendo preparado. Em breve você receberá instruções.',
    onboarding_suspenso: '\n\n⚠️ Seu onboarding está *suspenso*. Entre em contato com o gestor.',
    audio_entendi: '🎤 _Entendi:_ "{text}"',
    audio_erro: '🎤 Não consegui processar o áudio. Por favor, envie uma mensagem de texto.',
    greeting_morning: 'Bom dia',
    greeting_afternoon: 'Boa tarde',
    greeting_evening: 'Boa noite',
  },
  en_US: {
    menu_motorista:
      '🏍️ *{dspNome} Assistant*\n\n{greeting}! Choose an option:\n\n*1* – View today\'s route\n*2* – Pending failures\n*3* – Next payment\n*4* – Open channel with recipient\n\nOr send *STOP* to close active channel.',
    menu_destinatario:
      '📦 *{dspNome}*\n\n{greeting}! How can I help?\n\n*1* – My delivery status\n*2* – Rescheduling info\n\nAfter receiving your package, send a *score from 1 to 10* to rate!',
    rota_nenhuma: '📋 No route assigned for today. Check with your manager.',
    rota_resumo: "📋 *Today's route:* {paradas} stops, dispatch {horario}",
    rota_detalhe:
      "🗺️ *Today's route*\n\n📋 Code: {codigo}\n📦 Stops: {paradas}\n⏰ Dispatch: {horario}\n✅ Status: {status}",
    rota_sem_cadastro: '⚠️ We could not identify your registration. Contact your manager.',
    rota_horario_confirmar: 'to be confirmed',
    insucessos_zero: '✅ No pending failures. Great work!',
    insucessos_count:
      '⚠️ You have *{count} delivery(ies)* with pending failures.\nOpen the app to review and register a new attempt.',
    pagamento_nenhum: '💳 No open invoice. Check the app for history.',
    pagamento_detalhe:
      '💳 *Your next payment*\n\n📅 Period: {inicio} to {fim}\n💰 Amount: R$ {valor}\n📊 Status: {status}\n\nOpen the app for details and attestation.',
    proxy_instrucao:
      '📱 To open a channel with the recipient, use the *"Contact Recipient"* button in the Delivyo app on the stop screen.',
    desconhecido:
      '📍 This is the *{dspNome}* channel.\n\nWe could not identify your registration.\n\n• If you are a *partner driver*, confirm your phone with the manager.\n• If you are waiting for a *delivery*, stay tuned: you will receive automatic notifications here.',
    nao_entendi: 'I did not understand. Send *MENU* to see options.',
    encerrar_canal: '✅ Channel with recipient closed.',
    nps_otimo: '⭐ Thank you! We are glad the delivery was great!',
    nps_bom: '😊 Thank you for your feedback!',
    nps_ruim: '😔 Thank you. We will improve!',
    status_nenhum:
      '📦 No active deliveries linked to this number.\nStay tuned: you will receive a notification when the driver leaves.',
    status_detalhe: '📦 *Your delivery status*\n\n🔖 Package: {pacote}\n📊 Status: {status}',
    reagendar_info:
      '📅 To reschedule, contact {dspNome}.\nYou will receive an automatic notification when the driver leaves for delivery.',
    cpf_solicitar:
      '🔍 We could not identify your registration.\n\nPlease send your *CPF* (digits only or with dots/dashes) so we can find your account.',
    cpf_encontrado: '✅ CPF found! Hello, *{nome}*! Your phone has been linked to your account.',
    cpf_nao_encontrado:
      '❌ CPF not found in our records.\n\nWould you like to register as a *partner driver*? Send *YES* or *NO*.',
    cpf_invalido: '⚠️ Invalid CPF. Send 11 digits (e.g., 123.456.789-00 or 12345678900).',
    lead_confirmar: 'What is your *full name*?',
    lead_criado:
      "✅ Pre-registration started!\n\nComplete your registration at: {link}\n\nThere you will upload your documents (driver's license, vehicle registration).\nWe will be in touch! 🚀",
    lead_cancelado: 'No problem! If you need anything, send *MENU*.',
    lead_erro: '⚠️ An error occurred. Please try again later or contact the manager.',
    handoff_confirmado:
      '🙋 I will notify the support team. A human agent will reach out to you shortly.',
    onboarding_preparando: '📋 Your onboarding is being prepared. You will receive instructions soon.',
    onboarding_suspenso: '\n\n⚠️ Your onboarding is *suspended*. Please contact the manager.',
    audio_entendi: '🎤 _Understood:_ "{text}"',
    audio_erro: '🎤 Could not process the audio. Please send a text message.',
    greeting_morning: 'Good morning',
    greeting_afternoon: 'Good afternoon',
    greeting_evening: 'Good evening',
  },
  es_ES: {
    menu_motorista:
      '🏍️ *Asistente {dspNome}*\n\n{greeting}! Elige una opción:\n\n*1* – Ver ruta del día\n*2* – Fracasos pendientes\n*3* – Próximo pago\n*4* – Abrir canal con destinatario\n\nO envíe *CERRAR* para cerrar el canal activo.',
    menu_destinatario:
      '📦 *{dspNome}*\n\n{greeting}! ¿Cómo puedo ayudar?\n\n*1* – Estado de mi entrega\n*2* – Información de reprogramación\n\n¡Después de recibir su paquete, envíe una *nota de 1 a 10* para evaluar!',
    rota_nenhuma: '📋 Ninguna ruta asignada para hoy. Consulte con el gestor.',
    rota_resumo: '📋 *Ruta de hoy:* {paradas} paradas, despacho {horario}',
    rota_detalhe:
      '🗺️ *Tu ruta de hoy*\n\n📋 Código: {codigo}\n📦 Paradas: {paradas}\n⏰ Despacho: {horario}\n✅ Estado: {status}',
    rota_sem_cadastro: '⚠️ No identificamos su registro. Consulte al gestor.',
    rota_horario_confirmar: 'por confirmar',
    insucessos_zero: '✅ Ningún fracaso pendiente. ¡Excelente trabajo!',
    insucessos_count:
      '⚠️ Tiene *{count} entrega(s)* con fracaso pendiente.\nAbra la app para verificar y registrar un nuevo intento.',
    pagamento_nenhum: '💳 Ninguna factura abierta. Consulte la app para el historial.',
    pagamento_detalhe:
      '💳 *Su próximo pago*\n\n📅 Período: {inicio} a {fim}\n💰 Valor: R$ {valor}\n📊 Estado: {status}\n\nAcceda a la app para detalles y atestación.',
    proxy_instrucao:
      '📱 Para abrir canal con el destinatario, use el botón *"Contactar Destinatario"* en la app Delivyo en la pantalla de la parada.',
    desconhecido:
      '📍 Este es el canal de *{dspNome}*.\n\nNo identificamos su registro.\n\n• Si usted es un *conductor asociado*, confirme su teléfono con el gestor.\n• Si está esperando una *entrega*, esté atento: recibirá notificaciones automáticas aquí.',
    nao_entendi: 'No entendí. Envíe *MENU* para ver las opciones.',
    encerrar_canal: '✅ Canal con destinatario cerrado.',
    nps_otimo: '⭐ ¡Gracias! ¡Nos alegra que la entrega fue excelente!',
    nps_bom: '😊 ¡Gracias por su feedback!',
    nps_ruim: '😔 Gracias. ¡Vamos a mejorar!',
    status_nenhum:
      '📦 No encontré entregas activas vinculadas a este número.\nEsté atento: recibirá una notificación cuando el conductor salga.',
    status_detalhe: '📦 *Estado de su entrega*\n\n🔖 Paquete: {pacote}\n📊 Estado: {status}',
    reagendar_info:
      '📅 Para reprogramar, contacte a {dspNome}.\nRecibirá una notificación automática cuando el conductor salga para la entrega.',
    cpf_solicitar:
      '🔍 No identificamos su registro.\n\nPor favor, envíe su *CPF* (solo números o con puntuación) para que pueda localizar su cuenta.',
    cpf_encontrado: '✅ ¡CPF encontrado! Hola, *{nome}*! Su teléfono fue vinculado a su cuenta.',
    cpf_nao_encontrado:
      '❌ CPF no encontrado en nuestra base.\n\n¿Desea registrarse como *conductor asociado*? Envíe *SÍ* o *NO*.',
    cpf_invalido: '⚠️ CPF inválido. Envíe 11 dígitos (ej: 123.456.789-00 o 12345678900).',
    lead_confirmar: '¿Cuál es su *nombre completo*?',
    lead_criado:
      '✅ ¡Pre-registro iniciado!\n\nComplete su registro en: {link}\n\nAllí enviará sus documentos (licencia, registro del vehículo).\n¡Aguarde nuestro contacto! 🚀',
    lead_cancelado: '¡Sin problemas! Si necesita algo, envíe *MENU*.',
    lead_erro: '⚠️ Ocurrió un error. Intente nuevamente más tarde o contacte al gestor.',
    handoff_confirmado:
      '🙋 Voy a notificar al equipo de atención. Un agente humano se comunicará con usted en breve.',
    onboarding_preparando:
      '📋 Su onboarding está siendo preparado. Pronto recibirá instrucciones.',
    onboarding_suspenso: '\n\n⚠️ Su onboarding está *suspendido*. Contacte al gestor.',
    audio_entendi: '🎤 _Entendí:_ "{text}"',
    audio_erro: '🎤 No pude procesar el audio. Por favor, envíe un mensaje de texto.',
    greeting_morning: 'Buenos días',
    greeting_afternoon: 'Buenas tardes',
    greeting_evening: 'Buenas noches',
  },
};

/**
 * Traduz uma chave de mensagem para o locale informado.
 * Suporta interpolacao de variaveis: {nome}, {valor}, etc.
 */
export function t(
  locale: string,
  key: MessageKey,
  vars: Record<string, string | number> = {},
): string {
  const dict = messages[locale] ?? messages['pt_BR'];
  let msg = dict[key] ?? messages['pt_BR'][key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    msg = msg.replaceAll(`{${k}}`, String(v));
  }
  return msg;
}
