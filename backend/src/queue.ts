import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const vroomQueue = new Queue('vroom', { connection });
export const pyvrpQueue = new Queue('pyvrp', { connection });
export const geocoderQueue = new Queue('geocoder', { connection });
export const dneSyncQueue = new Queue('dne-sync', { connection });
export const npsNotifyQueue = new Queue('nps-notify', { connection });

export { connection as redisConnection };
