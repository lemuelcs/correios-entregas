// ── Enums / Union types ─────────────────────────────────────────────────────

export type EstadoConversa = 'bot_active' | 'human_active' | 'opted_out' | 'ended';
export type TipoParticipante = 'carteiro' | 'destinatario';
export type StatusInstancia = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
export type StatusTemplate = 'APPROVED' | 'PENDING' | 'REJECTED';
export type StatusProxySession = 'ACTIVE' | 'ENDED';
export type EndReason = 'TIMEOUT' | 'MAX_MESSAGES' | 'DRIVER_ENDED' | 'MANAGER_ENDED';
export type RemetenteMensagem = 'participante' | 'bot' | 'gestor';

// ── Entities ────────────────────────────────────────────────────────────────

export interface Conversa {
  id: string;
  participante: string;
  tipo: TipoParticipante;
  estado: EstadoConversa;
  msgs: number;
  ultimaMsg: string;
  ha: string;
  unresolved: boolean;
}

export interface Mensagem {
  de: RemetenteMensagem;
  texto: string;
  hora: string;
  tipo: 'text';
}

export interface ProxySession {
  id: string;
  carteiro: string;
  objeto: string | null;
  inicio: string;
  duracaoMin: number;
  msgs: number;
  maxMsgs: number;
  maxHoras: number;
  status: StatusProxySession;
  expiresIn: string;
  nearLimit?: boolean;
  endReason?: EndReason;
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
  bot_active: { variant: 'info', label: 'Bot ativo' },
  human_active: { variant: 'warning', label: 'Humano' },
  opted_out: { variant: 'neutral', label: 'Opt-out' },
  ended: { variant: 'neutral', label: 'Encerrado' },
};

export const TIPO_BADGE: Record<TipoParticipante, BadgeMapping> = {
  carteiro: { variant: 'blue', label: 'Carteiro' },
  destinatario: { variant: 'yellow', label: 'Destinatario' },
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
