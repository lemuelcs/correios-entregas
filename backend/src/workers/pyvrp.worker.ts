import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queue';
import { pyvrpClient, PyvrpInput, PyvrpResult } from '../integrations/pyvrp/pyvrp.client';

interface PyvrpJobData {
  pyvrpInput: PyvrpInput;
  metadata: {
    unidadeId: string;
    modo: string;
    solver: string;
    objectMapping: Array<{ index: number; objetoId: string; codigoRastreio: string; cep: string }>;
    vehicleMapping: Array<{ index: number; carteiroId: string; veiculoId: string; matricula: string }>;
  };
}

interface PyvrpJobResult {
  pyvrpResult: PyvrpResult;
  metadata: PyvrpJobData['metadata'];
}

async function processPyvrpJob(job: Job<PyvrpJobData>): Promise<PyvrpJobResult> {
  const { pyvrpInput, metadata } = job.data;

  await job.updateProgress(10);
  console.log(
    `[pyvrp] Processing job ${job.id}: ${pyvrpInput.vehicles.length} vehicles, ${pyvrpInput.jobs.length} jobs (mode: ${pyvrpInput.options.mode})`,
  );

  const pyvrpResult = await pyvrpClient.solve(pyvrpInput);
  await job.updateProgress(100);

  console.log(
    `[pyvrp] Job ${job.id} solved: ${pyvrpResult.summary.num_routes} routes, ${pyvrpResult.unassigned.length} unassigned`,
  );

  return { pyvrpResult, metadata };
}

let pyvrpWorker: Worker | null = null;

export function startPyvrpWorker(): Worker {
  if (pyvrpWorker) {
    return pyvrpWorker;
  }

  pyvrpWorker = new Worker<PyvrpJobData, PyvrpJobResult>(
    'pyvrp',
    async (job) => {
      return processPyvrpJob(job);
    },
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );

  pyvrpWorker.on('completed', (job) => {
    console.log(`[pyvrp] Job ${job.id} completed`);
  });

  pyvrpWorker.on('failed', (job, err) => {
    console.error(`[pyvrp] Job ${job?.id} failed:`, err.message);
  });

  pyvrpWorker.on('error', (err) => {
    console.error('[pyvrp] Worker error:', err.message);
  });

  console.log('[pyvrp] Worker listening on queue "pyvrp"');
  return pyvrpWorker;
}

export function stopPyvrpWorker(): Promise<void> {
  if (!pyvrpWorker) return Promise.resolve();
  const w = pyvrpWorker;
  pyvrpWorker = null;
  return w.close();
}
