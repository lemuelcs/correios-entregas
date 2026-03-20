import type {
  ChartDataPoint,
  Conversa,
  CustoLLMModelo,
  Mensagem,
  MotivoHandoff,
  ProxySession,
  TemplateHSM,
} from '@/types/comunicacao.types';

// ── Instância WhatsApp ──────────────────────────────────────────────────────

export const INSTANCE_STATUS = 'ACTIVE' as const;

// ── Gráfico 30 dias ─────────────────────────────────────────────────────────

export const CHART_DATA: ChartDataPoint[] = Array.from({ length: 30 }, (_, i) => ({
  dia: i + 1,
  recebidas: Math.floor(Math.random() * 80 + 30),
  enviadas: Math.floor(Math.random() * 120 + 60),
}));

// ── Dashboard — últimas 10 conversas ────────────────────────────────────────

export const ULTIMAS_CONVERSAS: Omit<Conversa, 'id' | 'msgs' | 'unresolved'>[] = [
  { participante: '+55 61 9 9801-****', tipo: 'carteiro', estado: 'bot_active', ultimaMsg: 'Qual minha rota amanha?', ha: '2 min' },
  { participante: '+55 61 9 9234-****', tipo: 'destinatario', estado: 'bot_active', ultimaMsg: 'Quero reagendar minha entrega', ha: '8 min' },
  { participante: '+55 61 9 9445-****', tipo: 'carteiro', estado: 'human_active', ultimaMsg: 'Nao consigo acessar o app', ha: '14 min' },
  { participante: '+55 61 9 8812-****', tipo: 'destinatario', estado: 'bot_active', ultimaMsg: 'Autorizar vizinha a retirar', ha: '21 min' },
  { participante: '+55 61 9 9102-****', tipo: 'carteiro', estado: 'opted_out', ultimaMsg: 'SAIR', ha: '45 min' },
  { participante: '+55 21 9 9777-****', tipo: 'destinatario', estado: 'ended', ultimaMsg: '10 — excelente atendimento!', ha: '1h' },
  { participante: '+55 61 9 9003-****', tipo: 'carteiro', estado: 'bot_active', ultimaMsg: 'Tenho 3 objetos com insucesso pendente', ha: '1h 10min' },
  { participante: '+55 61 9 8500-****', tipo: 'destinatario', estado: 'human_active', ultimaMsg: 'Nao reconheco esse envio', ha: '2h' },
  { participante: '+55 61 9 9311-****', tipo: 'destinatario', estado: 'bot_active', ultimaMsg: 'Quando chega meu SEDEX?', ha: '2h 30min' },
  { participante: '+55 61 9 8991-****', tipo: 'carteiro', estado: 'ended', ultimaMsg: 'OK, confirmado!', ha: '3h' },
];

// ── Conversas (lista completa) ──────────────────────────────────────────────

export const CONVERSAS: Conversa[] = [
  { id: '1', participante: '+55 61 9 9801-0042', tipo: 'carteiro', estado: 'bot_active', msgs: 7, ultimaMsg: 'Qual minha rota amanha?', ha: '2 min', unresolved: false },
  { id: '2', participante: '+55 61 9 9234-1188', tipo: 'destinatario', estado: 'bot_active', msgs: 3, ultimaMsg: 'Quero reagendar minha entrega', ha: '8 min', unresolved: false },
  { id: '3', participante: '+55 61 9 9445-2200', tipo: 'carteiro', estado: 'human_active', msgs: 15, ultimaMsg: 'Nao consigo acessar o app', ha: '14 min', unresolved: true },
  { id: '4', participante: '+55 61 9 8812-3311', tipo: 'destinatario', estado: 'bot_active', msgs: 5, ultimaMsg: 'Autorizar vizinha a retirar', ha: '21 min', unresolved: false },
  { id: '5', participante: '+55 61 9 9102-4400', tipo: 'carteiro', estado: 'opted_out', msgs: 1, ultimaMsg: 'SAIR', ha: '45 min', unresolved: false },
  { id: '6', participante: '+55 21 9 9777-5500', tipo: 'destinatario', estado: 'ended', msgs: 12, ultimaMsg: '10 — excelente atendimento!', ha: '1h', unresolved: false },
  { id: '7', participante: '+55 61 9 9003-6611', tipo: 'carteiro', estado: 'bot_active', msgs: 9, ultimaMsg: 'Tenho 3 objetos com insucesso pendente', ha: '1h 10min', unresolved: false },
  { id: '8', participante: '+55 61 9 8500-7722', tipo: 'destinatario', estado: 'human_active', msgs: 22, ultimaMsg: 'Nao reconheco esse envio', ha: '2h', unresolved: true },
];

// ── Mensagens mock (detalhe de conversa) ────────────────────────────────────

export const MENSAGENS_MOCK: Mensagem[] = [
  { de: 'participante', texto: 'Oi, qual minha rota amanha?', hora: '14:02', tipo: 'text' },
  { de: 'bot', texto: 'Ola Carlos! Consultando sua escala no sistema...', hora: '14:02', tipo: 'text' },
  { de: 'bot', texto: 'Sua rota de amanha e a R-01, com despacho previsto as 07:30. Voce tem 142 objetos pre-alocados. Deseja confirmar sua presenca?', hora: '14:02', tipo: 'text' },
  { de: 'participante', texto: 'Sim, confirmo!', hora: '14:03', tipo: 'text' },
  { de: 'bot', texto: 'Presenca confirmada para R-01 em 20/03/2026. Voce recebera uma notificacao 30 min antes do despacho. Mais alguma duvida?', hora: '14:03', tipo: 'text' },
  { de: 'participante', texto: 'Tenho 3 insucessos de ontem, o que fazer?', hora: '14:05', tipo: 'text' },
  { de: 'bot', texto: 'Encontrei 3 objetos com BDE pendente:\n- AA123456789BR — BDE_02 (ausente) — 1a tentativa\n- AA987654321BR — BDE_04 (endereco) — 1a tentativa\n- SX000001111BR — BDE_07 (recusado) — 2a tentativa (ultima!)\n\nDeseja reagendar algum deles?', hora: '14:05', tipo: 'text' },
];

// ── Sessões proxy ───────────────────────────────────────────────────────────

export const SESSOES_MOCK: ProxySession[] = [
  { id: 'prx_001', carteiro: 'Carlos Mendes (COR-001)', objeto: 'AA123456789BR', inicio: '14:02', duracaoMin: 22, msgs: 8, maxMsgs: 50, maxHoras: 4, status: 'ACTIVE', expiresIn: '3h 38min' },
  { id: 'prx_002', carteiro: 'Ana Lima (COR-002)', objeto: 'AA987654321BR', inicio: '13:45', duracaoMin: 39, msgs: 14, maxMsgs: 50, maxHoras: 4, status: 'ACTIVE', expiresIn: '3h 21min' },
  { id: 'prx_003', carteiro: 'Paulo Souza (COR-003)', objeto: null, inicio: '12:30', duracaoMin: 92, msgs: 31, maxMsgs: 50, maxHoras: 4, status: 'ACTIVE', expiresIn: '2h 28min' },
  { id: 'prx_004', carteiro: 'Marcia Torres (COR-004)', objeto: 'SX000001111BR', inicio: '11:18', duracaoMin: 164, msgs: 49, maxMsgs: 50, maxHoras: 4, status: 'ACTIVE', expiresIn: '56min', nearLimit: true },
  { id: 'prx_005', carteiro: 'Roberto Lima (COR-007)', objeto: 'AA444555666BR', inicio: '10:00', duracaoMin: 244, msgs: 50, maxMsgs: 50, maxHoras: 4, status: 'ENDED', expiresIn: '—', endReason: 'MAX_MESSAGES' },
];

// ── Templates HSM ───────────────────────────────────────────────────────────

export const TEMPLATES: TemplateHSM[] = [
  { id: 't1', nome: 'rota_disponivel', publico: 'carteiro', status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR', variaveis: ['{{1}} nome', '{{2}} codigo rota', '{{3}} horario despacho'], corpo: 'Ola, {{1}}! Sua rota {{2}} esta disponivel para coleta a partir de {{3}}. Acesse o app para confirmar.' },
  { id: 't2', nome: 'escala_publicada', publico: 'carteiro', status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR', variaveis: ['{{1}} nome', '{{2}} periodo', '{{3}} dias'], corpo: '{{1}}, sua escala para {{2}} foi publicada. Dias: {{3}}. Responda aqui se tiver duvidas.' },
  { id: 't3', nome: 'aviso_operacional', publico: 'carteiro', status: 'PENDING', categoria: 'UTILITY', idioma: 'pt_BR', variaveis: ['{{1}} nome', '{{2}} assunto', '{{3}} instrucao'], corpo: 'Aviso para {{1}}: {{2}}. {{3}}. Confirme o recebimento respondendo OK.' },
  { id: 't4', nome: 'insucesso_pendente', publico: 'carteiro', status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR', variaveis: ['{{1}} nome', '{{2}} qtd', '{{3}} prazo'], corpo: '{{1}}, voce tem {{2}} objeto(s) com insucesso pendente ate {{3}}. Acesse o app para reagendar.' },
  { id: 't5', nome: 'entrega_iniciada', publico: 'destinatario', status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR', variaveis: ['{{1}} nome', '{{2}} codigo rastreio', '{{3}} estimativa'], corpo: '{{1}}, seu objeto {{2}} saiu para entrega! Previsao: hoje ate {{3}}. Responda AJUDA para interagir.' },
  { id: 't6', nome: 'tentativa_insucesso', publico: 'destinatario', status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR', variaveis: ['{{1}} nome', '{{2}} codigo', '{{3}} prazo reagendamento'], corpo: '{{1}}, tentamos entregar {{2}} mas nao encontramos ninguem. Reagende ate {{3}} respondendo REAGENDAR.' },
  { id: 't7', nome: 'entrega_confirmada', publico: 'destinatario', status: 'APPROVED', categoria: 'UTILITY', idioma: 'pt_BR', variaveis: ['{{1}} nome', '{{2}} codigo'], corpo: '{{1}}, seu objeto {{2}} foi entregue com sucesso! Como foi sua experiencia? Responda com uma nota de 1 a 10.' },
  { id: 't8', nome: 'aguardando_retirada', publico: 'destinatario', status: 'PENDING', categoria: 'UTILITY', idioma: 'pt_BR', variaveis: ['{{1}} nome', '{{2}} codigo', '{{3}} unidade', '{{4}} prazo'], corpo: '{{1}}, seu objeto {{2}} aguarda retirada na unidade {{3}} ate {{4}}. Horario: seg-sex 8h-18h, sab 8h-12h.' },
  { id: 't9', nome: 'carteiro_contato', publico: 'destinatario', status: 'REJECTED', categoria: 'UTILITY', idioma: 'pt_BR', variaveis: ['{{1}} nome', '{{2}} codigo'], corpo: '{{1}}, o carteiro responsavel pelo objeto {{2}} tentara contato. As mensagens sao anonimas por seguranca.' },
];

// ── Analytics ───────────────────────────────────────────────────────────────

export const RESOLUCAO_POR_DIA = [72, 74, 70, 78, 81, 76, 79, 75, 83, 80, 77, 82, 85, 76];
export const CUSTO_POR_DIA = [2.1, 2.8, 1.9, 3.2, 3.8, 2.6, 2.9, 2.4, 3.1, 2.7, 3.0, 3.3, 2.8, 2.5];

export const MOTIVOS_HANDOFF: MotivoHandoff[] = [
  { motivo: 'Nao consigo acessar o app', qtd: 18, pct: 32 },
  { motivo: 'Reclamacao sobre entrega', qtd: 12, pct: 21 },
  { motivo: 'Problema com codigo de rastreio', qtd: 9, pct: 16 },
  { motivo: 'Solicitacao nao reconhecida pelo bot', qtd: 8, pct: 14 },
  { motivo: 'Outros', qtd: 10, pct: 17 },
];

export const CUSTO_LLM: CustoLLMModelo[] = [
  { modelo: 'gpt-4o-mini', chamadas: 1842, custo: 'US$ 1,47', pct: 62 },
  { modelo: 'gpt-4o', chamadas: 214, custo: 'US$ 5,23', pct: 9 },
  { modelo: 'claude-haiku-4-5-20251001', chamadas: 380, custo: 'US$ 0,95', pct: 16 },
  { modelo: 'gemini-flash', chamadas: 310, custo: 'US$ 0,31', pct: 13 },
];

// ── Alertas e LGPD ──────────────────────────────────────────────────────────

export const ALERTAS_CONFIGURADOS = [
  { alerta: 'Custo LLM diario > R$ 150/dia', status: 'OK' as const, check: 'Max. hoje: R$ 14,80' },
  { alerta: 'Sessoes proxy simultaneas > 20', status: 'OK' as const, check: 'Max. hoje: 6' },
  { alerta: 'Taxa de falha LLM > 5% em 5min', status: 'OK' as const, check: 'Taxa atual: 0,2%' },
  { alerta: 'Instancia Evolution offline > 5min', status: 'ALERT' as const, check: 'Offline as 11:34 por 3 min (recuperado)' },
  { alerta: 'Fila n8n > 1000 jobs pendentes', status: 'OK' as const, check: 'Fila atual: 3' },
];

export const COMPLIANCE_LGPD = [
  { label: 'Msgs nullificadas (30d+)', value: '12.430', status: 'ok' as const },
  { label: 'Sessoes proxy expiradas (7d)', value: '891', status: 'ok' as const },
  { label: 'Logs LLM expirados (90d)', value: '3.210', status: 'ok' as const },
  { label: 'Opt-outs ativos', value: '14', status: 'info' as const },
];
