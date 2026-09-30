/**
 * Tipos da borda com o Prosio (ADR-011, ADR-014).
 *
 * Os formatos de fio espelham os contratos reais de `@prosio/contracts`
 * (`messaging.ts`, `mediation.ts`, `atendimento.ts`). Onde o TechSpec prevê um
 * campo que o Prosio ainda não aceita (requisitos R1–R7 da mediação e P1–P3 do
 * roteamento por unidade), o campo existe aqui mas só vai para o fio quando o
 * cliente é criado com `extensoesMediacao: true` — ver `prosio.client.ts`.
 */
import type { TipoCanal } from '@prisma/client';

/** `MediationReasonSchema` do Prosio. */
export type MotivoMediacao =
  | 'destinatario_ausente'
  | 'endereco_incorreto'
  | 'acesso_negado'
  | 'recusa_do_destinatario'
  | 'reagendamento'
  | 'entrega_indireta'
  | 'outro';

/**
 * Um `CanalProsio` com as credenciais já decifradas. Os dois segredos são
 * propriedades NÃO enumeráveis: `JSON.stringify`, `console.log` e o `logger`
 * nunca os mostram, mesmo que alguém registre o objeto inteiro por engano.
 */
export interface CanalResolvido {
  readonly id: string;
  readonly nome: string;
  /** Origin, sem barra no fim (ex.: `https://prosio.com.br`). */
  readonly baseUrl: string;
  readonly tipo: TipoCanal;
  readonly compartilhado: boolean;
  readonly apiKey: string;
  readonly callbackSecret: string;
}

export interface BotaoMensagem {
  /** ≤ 200 caracteres (ex.: `CE_OP:<pacoteId>.AMANHA`). */
  id: string;
  /** ≤ 60 caracteres. */
  text: string;
}

export interface NovaMensagem {
  to: string;
  body: string;
  reference: string;
  idempotencyKey: string;
  buttons?: BotaoMensagem[];
  /** P1 (Prosio): ainda não existe no `MessagingSendRequestSchema`, que o descarta sem erro. */
  unidadeRef?: string;
}

/** `firstContact` de `MediationOpenCaseResponseSchema`. */
export type PrimeiroContato = 'queued' | 'pending' | 'blocked' | 'not_required';

export interface NovoCaso {
  /** `<codigo>@<data>`. */
  externalRef: string;
  providerPhone: string;
  recipientPhone: string;
  motivo?: MotivoMediacao;
  /** R5 — só vai para o fio com `extensoesMediacao`. */
  resumo: string;
  /** R3 — só vai para o fio com `extensoesMediacao`. */
  respondBy: Date;
  /** P1 — só vai para o fio com `extensoesMediacao`. */
  unidadeRef?: string;
}

export interface CasoAberto {
  caseId: string;
  /** `false` quando o Prosio devolveu 200 (a `externalRef` já tinha caso). */
  created: boolean;
  firstContact?: PrimeiroContato;
  protocolo?: string;
  expiresAt?: string | null;
}

export interface FatosCaso {
  motivoRelatado: MotivoMediacao;
  perguntaAberta: string;
}

export type PapelAtendimento = 'agente' | 'administrador';

export interface UsuarioAtendimento {
  idExterno: string;
  nome: string;
  email: string;
  papel: PapelAtendimento;
  /** P3 — o `AtendimentoSessaoRequestSchema` atual descarta o campo sem erro. */
  unidadeRef?: string;
  /** `dominio` do `AtendimentoSessaoRequestSchema` (link servido em `atendimento.<dominio>`). */
  dominio?: string;
}

export interface SessaoAtendimento {
  url: string;
  expiraEm: string;
}

// ——— Callbacks que o Prosio envia ao webhook do canal (ADR-014) —————————

/** `MessageStatusCallbackSchema` (ADR-0029 do Prosio). */
export interface CallbackStatusMensagem {
  messageId: string;
  channel: 'whatsapp';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'ambiguous';
  reference: string | null;
  occurredAt: string;
  failureReason: string | null;
  recipientOptOut?: { optedOut: boolean; at: string };
}

export interface CondicaoMediacao {
  ate?: string;
  local?: string;
}

/** `MediationOutcomeCallbackSchema`. */
export interface CallbackDesfechoMediacao {
  event: 'mediation.outcome';
  deliveryId: string;
  caseId: string;
  externalRef: string;
  sequence: number;
  occurredAt: string;
  outcome: {
    estado: 'resolvido' | 'sem_sucesso' | 'expirado' | 'cancelado';
    motivo: MotivoMediacao;
    exigeAcao: boolean;
    condicao?: CondicaoMediacao;
    decididoPor: 'provider' | 'recipient' | 'tenant' | 'system';
    decididoEm: string;
    origemFato?: string;
  };
  disposition: 'decidido' | 'proposto';
  conhecimento?: Array<Record<string, unknown>>;
}

/**
 * Falha de uma chamada ao Prosio. `status` é o HTTP devolvido (0 quando não
 * houve resposta: tempo limite ou erro de rede). `tentavel` diz se o worker
 * deve tentar de novo: 429, 5xx e falhas sem resposta sim; 4xx não.
 */
export class ProsioError extends Error {
  readonly tentavel: boolean;

  constructor(
    public status: number,
    public code: string,
    opcoes: { tentavel?: boolean; detalhe?: string } = {},
  ) {
    super(code);
    this.name = 'ProsioError';
    this.tentavel = opcoes.tentavel ?? ProsioError.ehTentavel(status);
    if (opcoes.detalhe) this.detalhe = opcoes.detalhe;
  }

  /** Texto curto e sem dado pessoal para log (ex.: `details.detail` da mediação). */
  detalhe?: string;

  static ehTentavel(status: number): boolean {
    return status === 0 || status === 429 || status >= 500;
  }
}
