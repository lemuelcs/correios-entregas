/**
 * keywords.ts
 * Keywords expandidas para o WPP-PILOT — multi-idioma (PT/EN/ES)
 * Todas as keywords devem ser UPPERCASED e sem acentos (NFD-stripped)
 */

// ── Menu / Saudação ─────────────────────────────────────────────────
export const MENU_KW = [
  // PT
  'OI', 'OLA', 'MENU', 'AJUDA', 'INICIO', 'COMECAR', 'VOLTAR',
  'OPCOES', 'OPCAO', 'EAI', 'E AI', 'FALA', 'SALVE', 'ME AJUDA',
  'SOCORRO', 'PRECISO DE AJUDA', 'O QUE VOCE FAZ', 'COMO FUNCIONA',
  'BOM DIA', 'BOA TARDE', 'BOA NOITE',
  // EN
  'HI', 'HELLO', 'HEY', 'HELP', 'START', 'OPTIONS',
  'GOOD MORNING', 'GOOD AFTERNOON', 'GOOD EVENING',
  // ES
  'HOLA', 'AYUDA', 'OPCIONES', 'BUENOS DIAS',
  'BUENAS TARDES', 'BUENAS NOCHES',
];

// ── Encerrar / Opt-out ──────────────────────────────────────────────
export const STOP_KW = [
  // PT
  'PARAR', 'SAIR', 'ENCERRAR', 'FIM', 'CANCELAR', 'TCHAU', 'ADEUS',
  'CHEGA', 'FINALIZAR', 'ATE LOGO', 'VALEU', 'OBRIGADO TCHAU',
  'NAO QUERO MAIS',
  // EN
  'STOP', 'EXIT', 'END', 'QUIT', 'BYE', 'CANCEL', 'GOODBYE',
  // ES
  'SALIR', 'TERMINAR', 'ADIOS', 'CHAO',
];

// ── Rota do dia (motorista) ─────────────────────────────────────────
export const ROTA_KW = [
  // PT
  'ROTA', 'MINHA ROTA', 'ROTA DE HOJE', 'ROTA DO DIA',
  'MINHAS ENTREGAS', 'ENTREGAS DE HOJE', 'ENTREGAS DO DIA',
  'PARADAS', 'QUANTAS PARADAS', 'MINHAS PARADAS',
  'DESPACHO', 'HORARIO DE SAIDA', 'HORA DE SAIR', 'CARREGAMENTO',
  'MINHA PROGRAMACAO', 'PROGRAMACAO DE HOJE', 'ESCALADO',
  'TENHO ROTA', 'VOU RODAR', 'VOU SAIR',
  // EN
  'ROUTE', 'MY ROUTE', 'TODAY ROUTE', 'DELIVERIES', 'MY DELIVERIES',
  'STOPS', 'HOW MANY STOPS', 'DISPATCH', 'SCHEDULE',
  // ES
  'RUTA', 'MI RUTA', 'RUTA DE HOY', 'ENTREGAS', 'PARADAS',
  'DESPACHO', 'HORARIO',
];

// ── Insucessos (motorista) ──────────────────────────────────────────
export const INSUCESSO_KW = [
  // PT
  'INSUCESSO', 'ENTREGA FALHOU', 'FALHA', 'FALHOU', 'DEVOLVER',
  'DEVOLUCAO', 'TENTATIVA', 'NAO CONSEGUI ENTREGAR',
  'DESTINATARIO AUSENTE', 'CLIENTE AUSENTE', 'NINGUEM EM CASA',
  'ENDERECO ERRADO', 'ENDERECO NAO ENCONTRADO',
  'RETORNO', 'PROBLEMA ENTREGA', 'PROBLEMA NA ENTREGA',
  'PACOTE DEVOLVIDO', 'NAO ENTREGUE', 'PENDENTE',
  'NOVA TENTATIVA', 'SEGUNDA TENTATIVA',
  // EN
  'FAILURE', 'FAILED', 'UNDELIVERED', 'RETURN', 'ISSUE',
  'NOT DELIVERED', 'WRONG ADDRESS', 'CUSTOMER ABSENT',
  // ES
  'FALLO', 'FALLA', 'DEVOLUCION', 'NO PUDE ENTREGAR',
  'DIRECCION INCORRECTA', 'CLIENTE AUSENTE',
];

// ── Pagamento / Fatura (motorista) ──────────────────────────────────
export const PAGAMENTO_KW = [
  // PT
  'PAGAMENTO', 'FATURA', 'PAGAR', 'QUANTO VOU RECEBER',
  'SALARIO', 'RECEBIMENTO', 'VALOR', 'GRANA', 'DINHEIRO',
  'NOTA FISCAL', 'NFS', 'PRE FATURA', 'PREFATURA', 'ACERTO',
  'EXTRATO', 'MEU PAGAMENTO', 'QUANDO VOU RECEBER',
  'QUANTO GANHEI', 'MEU ACERTO', 'MINHA FATURA',
  'RECEBO QUANDO', 'DIA DO PAGAMENTO', 'HOLERITE',
  // EN
  'PAYMENT', 'INVOICE', 'PAY', 'HOW MUCH', 'SALARY',
  'EARNINGS', 'MY PAYMENT', 'WHEN DO I GET PAID',
  // ES
  'PAGO', 'FACTURA', 'COBRO', 'SUELDO', 'CUANTO VOY A COBRAR',
  'MI PAGO', 'CUANDO COBRO',
];

// ── Status entrega (destinatário) ───────────────────────────────────
export const STATUS_KW = [
  // PT
  'STATUS', 'RASTREAR', 'RASTREAMENTO', 'RASTREIO',
  'ONDE ESTA', 'CADE', 'MINHA ENTREGA', 'MEU PACOTE',
  'MEU PEDIDO', 'PREVISAO', 'QUANDO CHEGA',
  'JA SAIU', 'SAIU PRA ENTREGA', 'MOTORISTA SAIU',
  'ACOMPANHAR', 'ACOMPANHAMENTO', 'POSICAO',
  'TA PERTO', 'FALTA MUITO', 'ETA',
  // EN
  'STATUS', 'TRACK', 'TRACKING', 'WHERE IS', 'MY DELIVERY',
  'MY PACKAGE', 'MY ORDER', 'WHEN', 'ETA', 'HOW LONG',
  // ES
  'ESTADO', 'RASTREAR', 'DONDE ESTA', 'MI ENTREGA',
  'MI PAQUETE', 'CUANDO LLEGA',
];

// ── Reagendamento (destinatário) ────────────────────────────────────
export const REAGENDAR_KW = [
  // PT
  'REAGENDAR', 'REMARCAR', 'OUTRO DIA', 'OUTRA DATA',
  'MUDAR DATA', 'TROCAR DIA', 'NAO VOU ESTAR',
  'NAO ESTAREI', 'AUSENTE', 'MUDAR HORARIO',
  'TROCAR HORARIO', 'ADIAR', 'POSTERGAR',
  // EN
  'RESCHEDULE', 'ANOTHER DAY', 'CHANGE DATE',
  'CHANGE TIME', 'NOT HOME', 'POSTPONE',
  // ES
  'REAGENDAR', 'REPROGRAMAR', 'OTRO DIA',
  'CAMBIAR FECHA', 'CAMBIAR HORARIO',
];

// ── Handoff para humano ─────────────────────────────────────────────
export const HANDOFF_KW = [
  // PT
  'FALAR COM HUMANO', 'ATENDENTE', 'PESSOA', 'ALGUEM',
  'SUPORTE', 'AJUDA HUMANA', 'PESSOA REAL', 'ATENDIMENTO',
  'HUMANO', 'AGENTE', 'SUPERVISOR', 'GERENTE', 'GESTOR',
  'NAO QUERO BOT', 'QUERO FALAR', 'FALAR COM ALGUEM',
  'FALAR COM GENTE', 'ME PASSA PRA ALGUEM', 'OPERADOR',
  'PRECISO FALAR COM ALGUEM', 'TEM ALGUEM AI',
  'QUERO ATENDIMENTO', 'ATENDIMENTO HUMANO',
  // EN
  'HUMAN', 'AGENT', 'SUPPORT', 'REAL PERSON',
  'SPEAK TO SOMEONE', 'TALK TO SOMEONE', 'SUPERVISOR',
  'MANAGER', 'OPERATOR', 'CUSTOMER SERVICE',
  // ES
  'HABLAR CON PERSONA', 'AGENTE', 'SOPORTE', 'HUMANO',
  'SUPERVISOR', 'OPERADOR', 'ATENCION',
];

// ── Onboarding status ───────────────────────────────────────────────
export const ONBOARDING_KW = [
  // PT
  'ONBOARDING', 'MINHA SITUACAO', 'MEU STATUS', 'MEU CADASTRO',
  'MEUS DOCUMENTOS', 'ETAPAS', 'COMO ESTA MEU PROCESSO',
  'O QUE FALTA', 'PENDENCIAS', 'PROCESSO SELETIVO',
  'MINHA ETAPA', 'ETAPA ATUAL', 'MEU PROGRESSO',
  'FALTA MUITO', 'QUANDO COMECO', 'QUANDO VOU COMECAR',
  'DOCUMENTACAO', 'MINHA DOCUMENTACAO',
  // EN
  'MY STATUS', 'MY ONBOARDING', 'MY DOCUMENTS',
  'WHAT IS MISSING', 'MY PROGRESS',
  // ES
  'MI ESTADO', 'MI PROCESO', 'MIS DOCUMENTOS',
  'QUE FALTA', 'MI PROGRESO',
];

// ── Utilitário ──────────────────────────────────────────────────────

/**
 * Verifica se o texto normalizado bate com alguma keyword.
 * - Frases multi-word: usa substring match (text.includes)
 * - Palavras únicas: verifica match exato entre as palavras do texto
 *   OU substring (para cobrir variações como "ROTAA")
 */
export function matchesAny(text: string, keywords: readonly string[]): boolean {
  const words = text.split(/\s+/);
  return keywords.some((kw) => {
    if (kw.includes(' ')) {
      return text.includes(kw);
    }
    // Palavra única — match exato em alguma word do texto
    return words.includes(kw);
  });
}
