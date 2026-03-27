import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queue';
import { dneImporter } from '../integrations/dne/dne.importer';

interface DneSyncJobData {
  triggeredBy?: string;
}

interface DneSyncJobResult {
  imported: number;
}

async function processDneSyncJob(job: Job<DneSyncJobData>): Promise<DneSyncJobResult> {
  console.log(`[dne-sync] Processing job ${job.id}...`);

  await job.updateProgress(10);
  const result = await dneImporter.importar();
  await job.updateProgress(100);

  return { imported: result.imported };
}

let dneSyncWorker: Worker | null = null;

export function startDneSyncWorker(): Worker {
  if (dneSyncWorker) {
    return dneSyncWorker;
  }

  dneSyncWorker = new Worker<DneSyncJobData, DneSyncJobResult>(
    'dne-sync',
    async (job) => {
      return processDneSyncJob(job);
    },
    {
      connection: redisConnection,
      concurrency: 1,
    },
  );

  dneSyncWorker.on('completed', (job) => {
    console.log(`[dne-sync] Job ${job.id} completed`);
  });

  dneSyncWorker.on('failed', (job, err) => {
    console.error(`[dne-sync] Job ${job?.id} failed:`, err.message);
  });

  dneSyncWorker.on('error', (err) => {
    console.error('[dne-sync] Worker error:', err.message);
  });

  console.log('[dne-sync] Worker listening on queue "dne-sync"');
  return dneSyncWorker;
}

export function stopDneSyncWorker(): Promise<void> {
  if (!dneSyncWorker) return Promise.resolve();
  const w = dneSyncWorker;
  dneSyncWorker = null;
  return w.close();
}
