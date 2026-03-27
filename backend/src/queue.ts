import { Queue } from 'bullmq';

const connection = {
  host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
  port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
  maxRetriesPerRequest: null,
};

export const vroomQueue = new Queue('vroom', { connection });
export const pyvrpQueue = new Queue('pyvrp', { connection });
export const geocoderQueue = new Queue('geocoder', { connection });
export const dneSyncQueue = new Queue('dne-sync', { connection });
export const npsNotifyQueue = new Queue('nps-notify', { connection });

export { connection as redisConnection };
