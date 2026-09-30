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

// ——— Troca do carteiro do dia (task_03 → task_06) ——————————————————————————

/**
 * `notificarTrocaCarteiro(distritoId, data, carteiroNovoId)` é chamado DEPOIS
 * do commit quando o carteiro do dia muda num distrito cuja carga da `data` já
 * foi liberada (US-005.AC-3). A task_06 registra o reenvio do resumo das
 * orientações pendentes ao novo carteiro. A implementação padrão não faz nada.
 */
export type GanchoTrocaCarteiro = (distritoId: string, data: Date, carteiroNovoId: string) => Promise<void>;

const trocaSemEfeito: GanchoTrocaCarteiro = async () => {};
let implementacaoTroca: GanchoTrocaCarteiro = trocaSemEfeito;

/** Troca a implementação (task_06). Passe `null` para voltar ao padrão sem efeito. */
export function registrarGanchoTrocaCarteiro(fn: GanchoTrocaCarteiro | null): void {
  implementacaoTroca = fn ?? trocaSemEfeito;
}

/** Avisa a troca do carteiro do dia num distrito liberado. Nunca lança (só registra a falha). */
export async function notificarTrocaCarteiro(distritoId: string, data: Date, carteiroNovoId: string): Promise<void> {
  try {
    await implementacaoTroca(distritoId, data, carteiroNovoId);
  } catch (err) {
    logger.error({ erro: err instanceof Error ? err.message : String(err), distritoId }, 'entregas: falha no gancho de troca de carteiro');
  }
}
