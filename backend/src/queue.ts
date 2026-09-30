import { Queue } from 'bullmq';

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');

/** Índice do banco na URL (`redis://host:6379/5` → 5); ausente ou inválido → 0. */
function bancoDaUrl(url: URL): number {
  const n = Number(url.pathname.replace(/^\//, ''));
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379'),
  // Decode URL-encoded password (e.g. %40 → @)
  password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
  // Respeita o banco da URL: os testes (e ambientes paralelos) isolam as filas por índice.
  db: bancoDaUrl(redisUrl),
  maxRetriesPerRequest: null,
};

export const vroomQueue = new Queue('vroom', { connection });
export const pyvrpQueue = new Queue('pyvrp', { connection });
export const geocoderQueue = new Queue('geocoder', { connection });
export const dneSyncQueue = new Queue('dne-sync', { connection });
export const npsNotifyQueue = new Queue('nps-notify', { connection });
/** Entregas mediadas (task_05): rastreio adaptativo, ADR-016. */
export const entregasRastreioQueue = new Queue('entregas-rastreio', { connection });

export { connection as redisConnection };
