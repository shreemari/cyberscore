import Redis, { type RedisOptions } from 'ioredis';
import { env, isProd } from './env';
import { logger } from './logger';

// Redis singleton — one connection per process. BullMQ workers create their own.
const globalForRedis = globalThis as unknown as { redis?: Redis };

const options: RedisOptions = {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
};

export const redis =
  globalForRedis.redis ??
  (() => {
    const client = new Redis(env.REDIS_URL, options);
    client.on('error', (err) => logger.error({ err }, 'Redis error'));
    client.on('connect', () => logger.info('Redis connected'));
    return client;
  })();

if (!isProd) globalForRedis.redis = redis;

// Separate connection factory for BullMQ workers (they need their own
// instance so blocking commands don't starve the app pool).
export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, options);
}
