/**
 * Job diário `foto-retencao` (ADR-010): às 03:00 America/Sao_Paulo exclui as fotos
 * de rótulo expiradas. A fila é criada só quando o worker sobe (sem conexão no import).
 */
import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../queue';
import { executarRetencao } from '../modules/captura/retencao';

export const FILA_FOTO_RETENCAO = 'foto-retencao';
export const AGENDA_FOTO_RETENCAO = { pattern: '0 3 * * *', tz: 'America/Sao_Paulo' };

let fila: Queue | null = null;
let worker: Worker | null = null;

export function startFotoRetencaoWorker(): Worker {
  if (worker) return worker;

  fila = new Queue(FILA_FOTO_RETENCAO, { connection: redisConnection });
  fila
    .upsertJobScheduler('foto-retencao-diaria', AGENDA_FOTO_RETENCAO, { name: 'retencao' })
    .catch((err: Error) => console.error('[foto-retencao] Falha ao agendar:', err.message));

  worker = new Worker(
    FILA_FOTO_RETENCAO,
    async () => {
      const excluidas = await executarRetencao();
      return { excluidas };
    },
    { connection: redisConnection, concurrency: 1 },
  );
  worker.on('failed', (job, err) => console.error(`[foto-retencao] Job ${job?.id} falhou:`, err.message));
  worker.on('error', (err) => console.error('[foto-retencao] Erro do worker:', err.message));
  console.log('[foto-retencao] Worker ouvindo a fila "foto-retencao" (03:00 America/Sao_Paulo)');
  return worker;
}

export async function stopFotoRetencaoWorker(): Promise<void> {
  const w = worker;
  const f = fila;
  worker = null;
  fila = null;
  await Promise.all([w?.close(), f?.close()]);
}
