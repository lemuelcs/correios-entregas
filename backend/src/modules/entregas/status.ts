/**
 * Derivação de status das entregas mediadas (TechSpec › Data Models).
 *
 * Funções puras, sem banco: o quadro (task_04), a liberação e o webhook do
 * Prosio (task_06) e o rastreio (task_05) usam as mesmas regras.
 */
import type { StatusCarga, StatusPacote } from '@prisma/client';
import { horaDeBrasilia } from './datas';

// ——— Quadro (carga do distrito) ——————————————————————————————————

export type StatusQuadro = 'PENDENTE_UPLOAD' | 'DADOS_CARREGADOS' | 'LIBERADO' | 'EM_ENTREGA' | 'CONCLUIDO';

export const STATUS_QUADRO: readonly StatusQuadro[] = [
  'PENDENTE_UPLOAD',
  'DADOS_CARREGADOS',
  'LIBERADO',
  'EM_ENTREGA',
  'CONCLUIDO',
];

export type ContagemPorStatus = Partial<Record<StatusPacote, number>>;

export interface EntradaStatusCarga {
  /** Carga do dia, ou `null` quando o distrito ainda não tem carga. */
  carga: { status: StatusCarga; data: Date } | null;
  porStatus: ContagemPorStatus;
  /** Relógio atual (para "NAO_ENVIADO após as 20h"). */
  agora?: Date;
}

/** Estados do pacote a partir dos quais o aviso já saiu. */
const APOS_ENVIO: readonly StatusPacote[] = ['ENVIADO', 'LIDO', 'INTERAGINDO', 'INSUCESSO', 'ENTREGUE'];
const FINAIS: readonly StatusPacote[] = ['ENTREGUE', 'INSUCESSO'];
/** Hora de Brasília depois da qual um pacote `NAO_ENVIADO` não será mais avisado no dia. */
export const HORA_FIM_ENVIO = 20;

function soma(porStatus: ContagemPorStatus, estados?: readonly StatusPacote[]): number {
  return Object.entries(porStatus)
    .filter(([s]) => !estados || estados.includes(s as StatusPacote))
    .reduce((acc, [, n]) => acc + (n ?? 0), 0);
}

/**
 * Status do cartão do distrito no quadro:
 * - sem carga (ou carga com 0 pacotes) → `PENDENTE_UPLOAD`;
 * - `CARREGADO` → `DADOS_CARREGADOS`;
 * - liberado e todos os pacotes finais (`ENTREGUE`, `INSUCESSO`, ou `NAO_ENVIADO` depois das 20h) → `CONCLUIDO`;
 * - liberado com algum aviso `ENVIADO` ou além → `EM_ENTREGA`;
 * - liberado sem aviso enviado → `LIBERADO`.
 *
 * Pacotes `SEM_WHATSAPP` só contam como finais quando o rastreio os leva a
 * `ENTREGUE` ou `INSUCESSO` (o status do pacote muda).
 */
export function derivarStatusCarga({ carga, porStatus, agora = new Date() }: EntradaStatusCarga): StatusQuadro {
  const total = soma(porStatus);
  if (!carga || total === 0) return 'PENDENTE_UPLOAD';
  if (carga.status === 'CARREGADO') return 'DADOS_CARREGADOS';
  if (carga.status === 'CONCLUIDO') return 'CONCLUIDO';

  const fimDoEnvio = agora.getTime() >= horaDeBrasilia(carga.data, HORA_FIM_ENVIO).getTime();
  const finais = soma(porStatus, FINAIS) + (fimDoEnvio ? porStatus.NAO_ENVIADO ?? 0 : 0);
  if (finais === total) return 'CONCLUIDO';

  if (carga.status === 'EM_ENTREGA' || soma(porStatus, APOS_ENVIO) > 0) return 'EM_ENTREGA';
  return 'LIBERADO';
}

/** Aceita o status derivado ou o nome do enum `StatusCarga` (`CARREGADO` = `DADOS_CARREGADOS`). */
export function lerFiltroStatusQuadro(valor: string): StatusQuadro | null {
  const v = valor.trim().toUpperCase();
  if (v === 'CARREGADO') return 'DADOS_CARREGADOS';
  if (v === 'PENDENTE') return 'PENDENTE_UPLOAD';
  return (STATUS_QUADRO as readonly string[]).includes(v) ? (v as StatusQuadro) : null;
}

// ——— Resumo de pacotes ————————————————————————————————————————————

export interface ResumoPacotes {
  total: number;
  comWhatsapp: number;
  porStatus: ContagemPorStatus;
  escalonamentos: number;
}

/** Contagens do cartão ("X de Y com WhatsApp", por status e escalonamentos). */
export function resumirPacotes(
  pacotes: ReadonlyArray<{ status: StatusPacote; whatsappE164: string | null; escalonado?: boolean }>,
): ResumoPacotes {
  const porStatus: ContagemPorStatus = {};
  let comWhatsapp = 0;
  let escalonamentos = 0;
  for (const p of pacotes) {
    porStatus[p.status] = (porStatus[p.status] ?? 0) + 1;
    if (p.whatsappE164) comWhatsapp += 1;
    if (p.escalonado) escalonamentos += 1;
  }
  return { total: pacotes.length, comWhatsapp, porStatus, escalonamentos };
}

// ——— Pacote ————————————————————————————————————————————————————

/** Ordem de avanço. Estados de mesmo nível não se sobrepõem, exceto `INSUCESSO` → `ENTREGUE`. */
const NIVEL: Record<StatusPacote, number> = {
  SEM_WHATSAPP: 0,
  AGUARDANDO_LIBERACAO: 0,
  AGENDADO: 1,
  NAO_ENVIADO: 2,
  ENVIADO: 3,
  LIDO: 4,
  INTERAGINDO: 5,
  INSUCESSO: 6,
  ENTREGUE: 7,
};

export type EventoStatusPacote =
  /** Liberação: aviso enfileirado (ou adiado para 06:05). */
  | { tipo: 'agendado' }
  /** Callbacks de status da mensagem no Prosio. */
  | { tipo: 'sent' }
  | { tipo: 'delivered' }
  | { tipo: 'read' }
  | { tipo: 'failed'; failureReason?: string | null }
  /** Destinatário tocou num botão ou escreveu. */
  | { tipo: 'interacao' }
  /** Resultado do rastreio. */
  | { tipo: 'rastreio'; resultado: 'ENTREGUE' | 'INSUCESSO' };

export interface ResultadoAvanco {
  status: StatusPacote;
  /** `false` quando o evento foi ignorado (regressão ou evento sem efeito). */
  mudou: boolean;
  naoEnviadoMotivo?: string;
  /** Falha por limite do canal: reenviar quando houver capacidade no mesmo dia. */
  reenfileirar?: boolean;
}

/** `failureReason` do Prosio que significam "limite do canal" (reenvia depois). */
const FALHAS_DE_LIMITE = new Set(['daily_cap', 'rate_limit', 'rate_limited', 'warmup', 'warmup_cap', 'reply_ratio', 'ratio_cap']);
const FALHAS_DE_DESCADASTRO = new Set(['opt_out', 'recipient_opt_out', 'recipientoptout']);

/** Motivo gravado em `PacoteDia.naoEnviadoMotivo` para um `failureReason` do Prosio. */
export function motivoNaoEnviado(failureReason?: string | null): { motivo: string; reenfileirar: boolean } {
  const r = (failureReason ?? '').trim().toLowerCase();
  if (FALHAS_DE_LIMITE.has(r)) return { motivo: 'limite_canal', reenfileirar: true };
  if (FALHAS_DE_DESCADASTRO.has(r)) return { motivo: 'descadastrado', reenfileirar: false };
  return { motivo: 'falha_envio', reenfileirar: false };
}

/**
 * Próximo status do pacote para um evento. Só avança:
 * `ENVIADO` < `LIDO` < `INTERAGINDO` < finais (`INSUCESSO`, `ENTREGUE`).
 * Um `read` depois de `INTERAGINDO` não regride; `ENTREGUE` é definitivo.
 * `failed` só vale antes do envio; `SEM_WHATSAPP` só muda pelo rastreio.
 */
export function avancarStatusPacote(atual: StatusPacote, evento: EventoStatusPacote): ResultadoAvanco {
  const manter: ResultadoAvanco = { status: atual, mudou: false };
  if (atual === 'ENTREGUE') return manter;

  if (evento.tipo === 'rastreio') {
    if (evento.resultado === atual) return manter;
    return { status: evento.resultado, mudou: true };
  }

  if (atual === 'SEM_WHATSAPP') return manter;

  if (evento.tipo === 'failed') {
    if (NIVEL[atual] >= NIVEL.ENVIADO) return manter;
    const { motivo, reenfileirar } = motivoNaoEnviado(evento.failureReason);
    return { status: 'NAO_ENVIADO', mudou: true, naoEnviadoMotivo: motivo, reenfileirar };
  }

  const alvo: StatusPacote =
    evento.tipo === 'agendado' ? 'AGENDADO'
      : evento.tipo === 'read' ? 'LIDO'
        : evento.tipo === 'interacao' ? 'INTERAGINDO'
          : 'ENVIADO'; // sent | delivered

  if (NIVEL[alvo] <= NIVEL[atual]) return manter;
  return { status: alvo, mudou: true };
}

// ——— Rótulos ——————————————————————————————————————————————————————

const ROTULOS: Record<StatusPacote, string> = {
  SEM_WHATSAPP: 'Sem WhatsApp',
  AGUARDANDO_LIBERACAO: 'Aguardando liberação',
  AGENDADO: 'Agendado',
  NAO_ENVIADO: 'Não enviado',
  ENVIADO: 'Enviado com sucesso',
  LIDO: 'Lido/recebido',
  INTERAGINDO: 'Interagindo',
  INSUCESSO: 'Insucesso',
  ENTREGUE: 'Entregue',
};

export const ROTULO_LISTA_PRONTA = 'Lista pronta';

/** Texto exibido para o pacote. Carga ainda não liberada → "Lista pronta" em todos. */
export function rotuloStatusPacote(status: StatusPacote, cargaLiberada: boolean): string {
  if (!cargaLiberada) return ROTULO_LISTA_PRONTA;
  return ROTULOS[status];
}
