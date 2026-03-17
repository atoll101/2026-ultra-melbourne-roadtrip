import { Redis } from '@upstash/redis';
import type { KVStore } from './types';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const kvUpstash: KVStore = {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get<T>(key);
    return value ?? null;
  },
  async set<T>(key: string, value: T): Promise<void> {
    await redis.set(key, value);
  },
};
