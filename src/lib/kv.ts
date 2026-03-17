import type { KVStore } from './types';

let _kv: KVStore | null = null;

export function getKV(): KVStore {
  if (_kv) return _kv;

  if (process.env.UPSTASH_REDIS_REST_URL) {
    // Dynamic import would be ideal but we need sync access;
    // the module is only loaded when env var exists
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { kvUpstash } = require('./kv-upstash');
    _kv = kvUpstash;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { kvLocal } = require('./kv-local');
    _kv = kvLocal;
  }

  return _kv!;
}
