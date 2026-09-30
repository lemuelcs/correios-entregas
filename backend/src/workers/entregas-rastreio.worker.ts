/**
 * RastreioWorker (fila `entregas-rastreio`, ADR-016):
 * - `entregas-rastreio-horario`: a cada hora cheia das 7h às 19h (America/Sao_Paulo),
 *   só pacotes `LIDO`/`INTERAGINDO` de cargas liberadas do dia;
 * - `entregas-rastreio-varredura`: às 20h, todos os que ainda não chegaram a um estado final.
 *
 * Cada pacote tem até 3 tentativas de consulta (erros tentáveis do Seu Rastreio).
 */
import { Worker, type Job, type Queue } from 'bullmq';
import { entregasRastreioQueue, redisConnection } from '../queue';
import logger from '../shared/utils/logger';
import { processarRastreio, type DepsRastreio, type ResumoRodada } from '../modules/entregas/rastreio.service';

export const FILA_RASTREIO = 'entregas-rastreio';
const FUSO = 'America/Sao_Paulo';

export interface JobRastreio {
  varredura?: boolean;
  /** ISO; só para testes e reprocessamento. Ausente → agora. */
  agora?: string;
}

export function processarJobRastreio(job: Pick<Job<JobRastreio>, 'data'>, deps: DepsRastreio = {}): Promise<ResumoRodada> {
  const agora = job.data.agora ? new Date(job.data.agora) : new Date();
  return processarRastreio({ agora, varredura: job.data.varredura === true }, deps);
}

/** Registra (ou atualiza) os dois agendamentos repetidos. Idempotente. */
export async function agendarRastreio(fila: Queue = entregasRastreioQueue): Promise<void> {
  await fila.upsertJobScheduler(
    'entregas-rastreio-horario',
    { pattern: '0 7-19 * * *', tz: FUSO },
    { name: 'horario', data: { varredura: false } satisfies JobRastreio, opts: { removeOnComplete: 100, removeOnFail: 100 } },
  );
  await fila.upsertJobScheduler(
    'entregas-rastreio-varredura',
    { pattern: '0 20 * * *', tz: FUSO },
    { name: 'varredura', data: { varredura: true } satisfies JobRastreio, opts: { removeOnComplete: 100, removeOnFail: 100 } },
  );
}

let worker: Worker<JobRastreio> | null = null;

export function startEntregasRastreioWorker(deps: DepsRastreio = {}, opcoes: { agendar?: boolean } = {}): Worker<JobRastreio> {
  if (worker) return worker;
  worker = new Worker<JobRastreio>(FILA_RASTREIO, (job) => processarJobRastreio(job, deps), {
    connection: redisConnection,
    concurrency: 1,
  });
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, erro: err.message }, 'entregas.rastreio job falhou'));
  worker.on('error', (err) => logger.error({ erro: err.message }, 'entregas.rastreio erro do worker'));
  if (opcoes.agendar !== false) {
    agendarRastreio().catch((err) => logger.error({ erro: (err as Error).message }, 'entregas.rastreio falha ao agendar'));
  }
  return worker;
}

export async function stopEntregasRastreioWorker(): Promise<void> {
  if (!worker) return;
  const w = worker;
  worker = null;
  await w.close();
}
