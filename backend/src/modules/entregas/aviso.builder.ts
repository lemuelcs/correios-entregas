/**
 * Regras puras da liberação (task_06): agendamento noturno, ids idempotentes
 * dos jobs do AvisoWorker e dados do caso de mediação. Os textos do aviso e do
 * resumo ficam em `textos.ts` (reexportados aqui).
 */
import { formatarData, hojeBrasilia, horaDeBrasilia } from './datas';
import { primeiroNome } from './textos';

export { botoesAviso, montarAviso, montarResumoCarteiro, type DadosAviso, type ItemResumo } from './textos';

const MINUTO_MS = 60_000;

/** Liberação entre 00h e 06h (Brasília) → avisos às 06h05 do mesmo dia (US-011.EC-2). */
export const HORA_INICIO_ENVIO = 6;
export const MINUTO_INICIO_ENVIO = 5;

export interface Agendamento {
  /** Atraso em ms a partir de `agora` (0 = já). */
  atrasoMs: number;
  /** Instante do envio quando há atraso. */
  agendadoPara: Date | null;
}

/** Atraso até 06:05 quando `agora` está entre 00:00 e 05:59 em Brasília; senão, nenhum. */
export function atrasoNoturno(agora: Date): Agendamento {
  const dia = hojeBrasilia(agora);
  const inicioJanela = horaDeBrasilia(dia, HORA_INICIO_ENVIO);
  if (agora.getTime() >= inicioJanela.getTime()) return { atrasoMs: 0, agendadoPara: null };
  const alvo = new Date(inicioJanela.getTime() + MINUTO_INICIO_ENVIO * MINUTO_MS);
  return { atrasoMs: alvo.getTime() - agora.getTime(), agendadoPara: alvo };
}

// ——— Jobs ————————————————————————————————————————————————————————————

export interface DadosJobAviso {
  pacoteId: string;
  /** Reenvio por limite do canal (1, 2, …); ausente no envio original. */
  reenvio?: number;
}

export interface DadosJobResumo {
  cargaId: string;
  carteiroId: string;
  orientacaoIds: string[];
  /** Resumo reenviado ao carteiro que assumiu depois da liberação. */
  troca?: boolean;
}

export type JobEntregas =
  | { nome: 'aviso'; id: string; dados: DadosJobAviso }
  | { nome: 'resumo'; id: string; dados: DadosJobResumo };

export const idAviso = (pacoteId: string): string => `aviso:${pacoteId}`;
export const idResumo = (cargaId: string, carteiroId: string): string => `resumo:${cargaId}:${carteiroId}`;

/** `Idempotency-Key` do aviso: o original é `aviso:<id>`; cada reenvio tem a sua (o Prosio deduplica pela chave). */
export function chaveIdempotenciaAviso(pacoteId: string, reenvio?: number): string {
  return reenvio ? `${idAviso(pacoteId)}:r${reenvio}` : idAviso(pacoteId);
}

/**
 * O BullMQ recusa `jobId` com um único `:` (formato reservado aos jobs
 * repetidos). O id lógico (`aviso:<pacoteId>`) vira `aviso_<pacoteId>` na fila.
 */
export function idJobFila(id: string): string {
  return id.replace(/:/g, '_');
}

/** Jobs de uma liberação: um aviso por pacote e, havendo orientações, o resumo ao carteiro. Ids estáveis. */
export function jobsDaLiberacao(carga: {
  cargaId: string;
  carteiroId: string | null;
  pacoteIds: readonly string[];
  orientacaoIds?: readonly string[];
}): JobEntregas[] {
  const jobs: JobEntregas[] = carga.pacoteIds.map((pacoteId) => ({ nome: 'aviso', id: idAviso(pacoteId), dados: { pacoteId } }));
  if (carga.carteiroId && carga.orientacaoIds && carga.orientacaoIds.length > 0) {
    jobs.push({
      nome: 'resumo',
      id: idResumo(carga.cargaId, carga.carteiroId),
      dados: { cargaId: carga.cargaId, carteiroId: carga.carteiroId, orientacaoIds: [...carga.orientacaoIds] },
    });
  }
  return jobs;
}

// ——— Caso de mediação ——————————————————————————————————————————————————

/** `externalRef` do caso de uma encomenda num dia: `<codigo>@<YYYY-MM-DD>` (nova tentativa → caso novo). */
export function externalRefDoCaso(codigo: string, data: Date): string {
  return `${codigo.trim().toUpperCase()}@${formatarData(data)}`;
}

/** Endereço curto para a desambiguação do caso (R5): logradouro e número, ou o texto livre. */
export function enderecoCurto(p: { logradouro?: string | null; numero?: string | null; complemento?: string | null; enderecoTexto?: string | null }): string {
  const partes = [p.logradouro, p.numero, p.complemento].map((s) => (s ?? '').trim()).filter(Boolean);
  const texto = partes.length > 0 ? partes.join(' ') : (p.enderecoTexto ?? '').trim();
  const t = texto.replace(/\s+/g, ' ');
  return t.length > 60 ? `${t.slice(0, 59).trimEnd()}…` : t;
}

/** `'<primeiro nome> · <endereço curto>'` (R5). */
export function resumoDoCaso(p: { nome: string; logradouro?: string | null; numero?: string | null; complemento?: string | null; enderecoTexto?: string | null }): string {
  const nome = primeiroNome(p.nome) || 'Destinatário';
  const endereco = enderecoCurto(p);
  return endereco ? `${nome} · ${endereco}` : nome;
}

/** Prazo do caso: fim do dia de entrega (23:59 em Brasília), R3. */
export function fimDoDiaDeEntrega(data: Date): Date {
  return new Date(horaDeBrasilia(data, 24).getTime() - MINUTO_MS);
}
