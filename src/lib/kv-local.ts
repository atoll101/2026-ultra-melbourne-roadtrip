import fs from 'fs';
import path from 'path';
import type { KVStore } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'kv-store.json');

function readStore(): Record<string, unknown> {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(STORE_PATH, '{}', 'utf-8');
      return {};
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, unknown>): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export const kvLocal: KVStore = {
  async get<T>(key: string): Promise<T | null> {
    const store = readStore();
    return (store[key] as T) ?? null;
  },
  async set<T>(key: string, value: T): Promise<void> {
    const store = readStore();
    store[key] = value;
    writeStore(store);
  },
};
