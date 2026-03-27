import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queue';
import { vroomClient, VroomInput, VroomResult } from '../integrations/vroom/vroom.client';

interface VroomJobData {
  vroomInput: VroomInput;
  metadata: {
    unidadeId: string;
    modo: string;
    objectMapping: Array<{ index: number; objetoId: string; codigoRastreio: string; cep: string }>;
    vehicleMapping: Array<{ index: number; carteiroId: string; veiculoId: string; matricula: string }>;
  };
}

interface VroomJobResult {
  vroomResult: VroomResult;
  metadata: VroomJobData['metadata'];
}

async function processVroomJob(job: Job<VroomJobData>): Promise<VroomJobResult> {
  const { vroomInput, metadata } = job.data;

  await job.updateProgress(10);
  console.log(
    `[vroom] Processing job ${job.id}: ${vroomInput.vehicles.length} vehicles, ${vroomInput.jobs.length} jobs`,
  );

  const vroomResult = await vroomClient.solve(vroomInput);
  await job.updateProgress(100);

  console.log(
    `[vroom] Job ${job.id} solved: ${vroomResult.summary.routes} routes, ${vroomResult.summary.unassigned} unassigned`,
  );

  return { vroomResult, metadata };
}

let vroomWorker: Worker | null = null;

export function startVroomWorker(): Worker {
  if (vroomWorker) {
    return vroomWorker;
  }

  vroomWorker = new Worker<VroomJobData, VroomJobResult>(
    'vroom',
    async (job) => {
      return processVroomJob(job);
    },
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );

  vroomWorker.on('completed', (job) => {
    console.log(`[vroom] Job ${job.id} completed`);
  });

  vroomWorker.on('failed', (job, err) => {
    console.error(`[vroom] Job ${job?.id} failed:`, err.message);
  });

  vroomWorker.on('error', (err) => {
    console.error('[vroom] Worker error:', err.message);
  });

  console.log('[vroom] Worker listening on queue "vroom"');
  return vroomWorker;
}

export function stopVroomWorker(): Promise<void> {
  if (!vroomWorker) return Promise.resolve();
  const w = vroomWorker;
  vroomWorker = null;
  return w.close();
}
