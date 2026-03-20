import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queue';

interface NpsNotifyJobData {
  objetoId: string;
  destinatarioId: string;
  codigoRastreio: string;
}

async function processNpsNotifyJob(job: Job<NpsNotifyJobData>): Promise<void> {
  const { objetoId, destinatarioId, codigoRastreio } = job.data;

  // In production: send push notification or email to destinatario
  // For MVP: just log the notification
  console.log(
    `[nps-notify] Job ${job.id}: Would notify destinatario ${destinatarioId} ` +
    `about objeto ${objetoId} (rastreio: ${codigoRastreio})`,
  );
  console.log(
    `[nps-notify] Future implementation: send email/push notification with NPS survey link`,
  );
}

let npsNotifyWorker: Worker | null = null;

export function startNpsNotifyWorker(): Worker {
  if (npsNotifyWorker) {
    return npsNotifyWorker;
  }

  npsNotifyWorker = new Worker<NpsNotifyJobData>(
    'nps-notify',
    async (job) => {
      await processNpsNotifyJob(job);
    },
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );

  npsNotifyWorker.on('completed', (job) => {
    console.log(`[nps-notify] Job ${job.id} completed`);
  });

  npsNotifyWorker.on('failed', (job, err) => {
    console.error(`[nps-notify] Job ${job?.id} failed:`, err.message);
  });

  npsNotifyWorker.on('error', (err) => {
    console.error('[nps-notify] Worker error:', err.message);
  });

  console.log('[nps-notify] Worker listening on queue "nps-notify"');
  return npsNotifyWorker;
}

export function stopNpsNotifyWorker(): Promise<void> {
  if (!npsNotifyWorker) return Promise.resolve();
  const w = npsNotifyWorker;
  npsNotifyWorker = null;
  return w.close();
}
