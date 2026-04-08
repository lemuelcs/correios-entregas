// ── Enums / Union types ─────────────────────────────────────────────────────

export type EstadoConversa = 'BOT_ACTIVE' | 'DISPATCHER_ACTIVE' | 'PROXY_ACTIVE' | 'OPTED_OUT' | 'CLOSED';
export type TipoParticipante = 'MOTORISTA' | 'DESTINATARIO' | 'UNKNOWN';
export type StatusInstancia = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
export type StatusTemplate = 'APPROVED' | 'PENDING' | 'REJECTED';
export type StatusProxySession = 'ACTIVE' | 'ENDED';
export type EndReason = 'TIMEOUT' | 'MAX_MESSAGES' | 'DRIVER_ENDED' | 'GESTOR_ENDED';
export type DirecaoMensagem = 'INBOUND' | 'OUTBOUND';
export type TipoMensagem = 'BOT' | 'DISPATCHER';
export type DeliveryStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

// ── Backend API response shapes ────────────────────────────────────────────

/** GET /comunicacao/conversas — one item */
export interface Conversa {
  id: string;
  phoneDisplay: string;
  participantType: TipoParticipante;
  state: EstadoConversa;
  totalMessages: number;
  lastMessageAt: string | null;
  botSilenciado: boolean;
  dispatcherAtivo: boolean;
  dispatcherNome: string | null;
  dispatcherSessionId: string | null;
  ultimasMensagens: { direction: DirecaoMensagem; content: string; createdAt: string }[];
}

/** GET /comunicacao/conversas/:id/mensagens — one item */
export interface Mensagem {
  id: string;
  createdAt: string;
  direction: DirecaoMensagem;
  content: string;
  tipo: TipoMensagem;
  remetente: string;
  deliveryStatus: DeliveryStatus;
}

/** GET /comunicacao/proxy/sessions — one item (raw Prisma WppProxyPilotSession) */
export interface ProxySession {
  id: string;
  instanceName: string;
  carteiroPhone: string;
  carteiroId: string | null;
  rotaId: string | null;
  paradaId: string | null;
  status: StatusProxySession;
  messageCount: number;
  expiresAt: string;
  endedAt: string | null;
  endReason: string | null;
  createdAt: string;
}

/** GET /comunicacao/status */
export interface InstanciaStatus {
  connected: boolean;
  state: string;
  instanceName: string | null;
}

/** GET /comunicacao/admin/config */
export interface AdminConfig {
  configured: boolean;
  instanceName?: string;
  phoneNumber?: string;
  dspNome?: string;
  locale?: string;
  timezone?: string;
  botEnabled?: boolean;
  proxyEnabled?: boolean;
  instanceExists?: boolean;
  connected?: boolean;
  connectedAt?: string | null;
  lastWebhookAt?: string | null;
  webhook?: {
    current: unknown;
    expected: { url: string; events: string[] };
    ok: boolean;
  };
}

/** GET /comunicacao/admin/stats */
export interface AdminStats {
  mensagensEnviadas: number;
  mensagensRecebidas: number;
  entregues: number;
  lidas: number;
  falhas: number;
  sessoesAtivas: number;
  sessoesBot: number;
  sessoesDispatcher: number;
  motoristaCount: number;
  destinatarioCount: number;
  llmRequests: number;
  llmCostUsd: number;
  taxaBot: number;
}

/** GET /comunicacao/admin/llm-analytics */
export interface LlmAnalytics {
  period: { start: string; end: string };
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byProviderModel: {
    provider: string;
    model: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    avgLatencyMs: number;
  }[];
  daily: { date: string; costUsd: number; requests: number }[];
}

/** GET /comunicacao/admin/llm-config */
export interface LlmConfig {
  llmEnabled: boolean;
  llmConfig: Record<string, unknown>;
}

export interface TemplateHSM {
  id: string;
  nome: string;
  publico: TipoParticipante;
  status: StatusTemplate;
  categoria: string;
  idioma: string;
  variaveis: string[];
  corpo: string;
}

// ── Dashboard chart types (computed on frontend from stats) ────────────────

export interface ChartDataPoint {
  dia: number;
  recebidas: number;
  enviadas: number;
}

export interface MotivoHandoff {
  motivo: string;
  qtd: number;
  pct: number;
}

export interface CustoLLMModelo {
  modelo: string;
  chamadas: number;
  custo: string;
  pct: number;
}

export interface AlertaConfigurado {
  alerta: string;
  status: 'OK' | 'ALERT';
  check: string;
}

export interface ComplianceLGPD {
  label: string;
  value: string;
  status: 'ok' | 'info';
}

// ── Badge mappings ──────────────────────────────────────────────────────────

export interface BadgeMapping {
  variant: string;
  label: string;
}

export const ESTADO_BADGE: Record<EstadoConversa, BadgeMapping> = {
  BOT_ACTIVE: { variant: 'info', label: 'Bot ativo' },
  DISPATCHER_ACTIVE: { variant: 'warning', label: 'Humano' },
  PROXY_ACTIVE: { variant: 'blue', label: 'Proxy' },
  OPTED_OUT: { variant: 'neutral', label: 'Opt-out' },
  CLOSED: { variant: 'neutral', label: 'Encerrado' },
};

export const TIPO_BADGE: Record<TipoParticipante, BadgeMapping> = {
  MOTORISTA: { variant: 'blue', label: 'Carteiro' },
  DESTINATARIO: { variant: 'yellow', label: 'Destinatario' },
  UNKNOWN: { variant: 'neutral', label: 'Desconhecido' },
};

export const STATUS_TEMPLATE_BADGE: Record<StatusTemplate, BadgeMapping> = {
  APPROVED: { variant: 'success', label: 'Aprovado' },
  PENDING: { variant: 'warning', label: 'Aguardando Meta' },
  REJECTED: { variant: 'danger', label: 'Rejeitado' },
};

export const INSTANCE_BADGE: Record<StatusInstancia, BadgeMapping> = {
  ACTIVE: { variant: 'success', label: 'ACTIVE — Conectado' },
  INACTIVE: { variant: 'neutral', label: 'INACTIVE — Desconectado' },
  SUSPENDED: { variant: 'danger', label: 'SUSPENDED — Suspenso' },
  PENDING: { variant: 'warning', label: 'Conectando...' },
};
