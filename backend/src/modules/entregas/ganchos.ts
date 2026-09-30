/**
 * Ganchos públicos do módulo `entregas`.
 *
 * `aoAdicionarPacotesEmCargaLiberada(pacoteIds)` é chamado DEPOIS do commit
 * sempre que pacotes com WhatsApp entram numa carga já liberada (confirmação
 * de lista nova ou WhatsApp adicionado por `PATCH /pacotes/:id`). A task_06
 * registra o envio imediato do aviso; outros produtores (ex.: o app de captura
 * de etiquetas) chamam a mesma função. A implementação padrão não faz nada.
 */
import logger from '../../shared/utils/logger';

export type GanchoPacotesEmCargaLiberada = (pacoteIds: string[]) => Promise<void>;

const semEfeito: GanchoPacotesEmCargaLiberada = async () => {};
let implementacao: GanchoPacotesEmCargaLiberada = semEfeito;

/** Troca a implementação (task_06). Passe `null` para voltar ao padrão sem efeito. */
export function registrarGanchoPacotesEmCargaLiberada(fn: GanchoPacotesEmCargaLiberada | null): void {
  implementacao = fn ?? semEfeito;
}

/**
 * Avisa que `pacoteIds` entraram (ou ganharam WhatsApp) numa carga já liberada.
 * Nunca lança: a gravação já foi confirmada, então uma falha aqui só é registrada.
 */
export async function aoAdicionarPacotesEmCargaLiberada(pacoteIds: string[]): Promise<void> {
  if (pacoteIds.length === 0) return;
  try {
    await implementacao(pacoteIds);
  } catch (err) {
    logger.error({ erro: err instanceof Error ? err.message : String(err), pacotes: pacoteIds.length }, 'entregas: falha no gancho de pacotes em carga liberada');
  }
}

// ——— Reenvio por limite do canal (task_05 → task_06) ————————————————————

/**
 * `aoFalharPorLimiteDoCanal(pacoteId)` é chamado pelo webhook de status
 * (task_05) quando o Prosio recusa o aviso por limite do canal
 * (`failureReason` de aquecimento/cota; `avancarStatusPacote` → `reenfileirar`).
 * A task_06 registra o reenfileiramento (30 min depois, até as 20h) no
 * AvisoWorker. A implementação padrão não faz nada.
 */
export type GanchoLimiteCanal = (pacoteId: string) => Promise<void>;

const limiteSemEfeito: GanchoLimiteCanal = async () => {};
let implementacaoLimite: GanchoLimiteCanal = limiteSemEfeito;

export function registrarGanchoLimiteCanal(fn: GanchoLimiteCanal | null): void {
  implementacaoLimite = fn ?? limiteSemEfeito;
}

/** Nunca lança: o status já foi gravado; uma falha aqui só é registrada. */
export async function aoFalharPorLimiteDoCanal(pacoteId: string): Promise<void> {
  try {
    await implementacaoLimite(pacoteId);
  } catch (err) {
    logger.error({ erro: err instanceof Error ? err.message : String(err), pacoteId }, 'entregas: falha no gancho de limite do canal');
  }
}
