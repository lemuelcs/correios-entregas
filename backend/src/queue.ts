import { Queue } from 'bullmq';

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');

const connection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port || '6379'),
  // Decode URL-encoded password (e.g. %40 → @)
  password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
  maxRetriesPerRequest: null,
};

export const vroomQueue = new Queue('vroom', { connection });
export const pyvrpQueue = new Queue('pyvrp', { connection });
export const geocoderQueue = new Queue('geocoder', { connection });
export const dneSyncQueue = new Queue('dne-sync', { connection });
export const npsNotifyQueue = new Queue('nps-notify', { connection });

export { connection as redisConnection };
