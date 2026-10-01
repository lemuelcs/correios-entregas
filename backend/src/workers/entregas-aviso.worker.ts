/**
 * AvisoWorker (fila `entregas-aviso`, TechSpec › AvisoWorker):
 * - `aviso`: um job por pacote (`aviso_<pacoteId>`), com o caso de mediação antes;
 * - `resumo`: resumo das orientações ao carteiro (`resumo_<cargaId>_<carteiroId>`).
 *
 * Limite de 25 envios/min POR CANAL (o `limiter` do BullMQ é por fila): um
 * contador por canal e minuto no Redis; acima do limite o job volta para a
 * fila atrasada até o próximo minuto, sem gastar tentativa. 5 tentativas com
 * backoff exponencial; esgotadas, o pacote fica `NAO_ENVIADO` (`falha_envio`).
 */
import { DelayedError, Worker, type Job } from 'bullmq';
import { entregasAvisoQueue, redisConnection } from '../queue';
import logger from '../shared/utils/logger';
import { liberacaoService, TENTATIVAS_AVISO, type LiberacaoService } from '../modules/entregas/liberacao.service';
import type { DadosJobAviso, DadosJobResumo } from '../modules/entregas/aviso.builder';

export const FILA_AVISO = 'entregas-aviso';

type DadosJob = DadosJobAviso | DadosJobResumo;

/** Envios por minuto e por canal (Prosio: 30/min por chave). */
export function limitePorMinuto(): number {
  const v = Number(process.env.ENTREGAS_AVISO_LIMITE_MIN);
  return Number.isInteger(v) && v > 0 ? v : 25;
}

/**
 * Reserva um envio no minuto corrente do canal. `ok: false` = limite atingido;
 * `ate` é o início do próximo minuto. O minuto vem do relógio do Redis (o
 * mesmo para todas as instâncias da API), não do relógio do processo.
 */
export async function reservarTaxa(canalId: string): Promise<{ ok: boolean; ate: number }> {
  const cliente = await entregasAvisoQueue.client;
  const [segundos, micros] = await cliente.time();
  const agora = Number(segundos) * 1000 + Math.floor(Number(micros) / 1000);
  const minuto = Math.floor(agora / 60_000);
  const chave = `entregas:aviso:taxa:${canalId}:${minuto}`;
  const n = await cliente.incr(chave);
  if (n === 1) await cliente.expire(chave, 120);
  return { ok: n <= limitePorMinuto(), ate: (minuto + 1) * 60_000 + Math.floor(Math.random() * 1000) };
}

export async function processarJobAviso(job: Job<DadosJob>, token: string | undefined, servico: LiberacaoService = liberacaoService): Promise<string> {
  const reservarEnvio = async (canalId: string): Promise<void> => {
    const { ok, ate } = await reservarTaxa(canalId);
    if (ok) return;
    await job.moveToDelayed(ate, token);
    throw new DelayedError();
  };
  if (job.name === 'resumo') return servico.enviarResumo(job.data as DadosJobResumo, { reservarEnvio });
  return servico.enviarAviso(job.data as DadosJobAviso, { reservarEnvio });
}

/** Tentativas esgotadas: marca a falha visível ao supervisor. */
export async function aoFalharJobAviso(job: Job<DadosJob> | undefined, err: Error, servico: LiberacaoService = liberacaoService): Promise<void> {
  if (!job || err instanceof DelayedError) return;
  const tentativas = job.opts.attempts ?? TENTATIVAS_AVISO;
  if (job.attemptsMade < tentativas) return;
  if (job.name === 'resumo') await servico.marcarFalhaResumo(job.data as DadosJobResumo);
  else await servico.marcarFalhaEnvio((job.data as DadosJobAviso).pacoteId, err.message);
}

let worker: Worker<DadosJob> | null = null;

export function startEntregasAvisoWorker(opcoes: { servico?: LiberacaoService; concorrencia?: number } = {}): Worker<DadosJob> {
  if (worker) return worker;
  const servico = opcoes.servico ?? liberacaoService;
  worker = new Worker<DadosJob>(FILA_AVISO, (job, token) => processarJobAviso(job, token, servico), {
    connection: redisConnection,
    concurrency: opcoes.concorrencia ?? 5,
  });
  worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, tentativa: job?.attemptsMade, erro: err.message }, 'entregas.aviso job falhou');
    aoFalharJobAviso(job, err, servico).catch((e) => logger.error({ jobId: job?.id, erro: (e as Error).message }, 'entregas.aviso falha ao marcar a falha'));
  });
  worker.on('error', (err) => logger.error({ erro: err.message }, 'entregas.aviso erro do worker'));
  return worker;
}

export async function stopEntregasAvisoWorker(): Promise<void> {
  if (!worker) return;
  const w = worker;
  worker = null;
  await w.close();
}
