/**
 * redis.ts
 * Cliente Redis genérico para sessões e cache do módulo de comunicação.
 * Reutiliza a mesma URL do BullMQ.
 */
import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis && redis.status === 'ready') return redis;
  if (redis) return redis; // connecting

  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
    });
    redis.connect().catch(() => {
      redis = null;
    });
    return redis;
  } catch {
    redis = null;
    return null;
  }
}

export function isRedisAvailable(): boolean {
  return redis?.status === 'ready';
}
