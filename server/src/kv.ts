import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Minimal KV interface, compatible with both a Cloudflare KVNamespace and the
 * local dev file backend below. The client (browser) talks to this through the
 * Hono routes; the runtime provides the implementation via `c.env.KV`.
 */
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Local-file KV for development (`npm run dev`). Persists a single JSON map so
 * the sync state survives restarts. Not for production — use Cloudflare KV.
 */
export function createLocalKV(filePath = path.resolve(process.cwd(), '.data/kv.json')): KV {
  let cache: Record<string, string> | null = null;

  async function load(): Promise<Record<string, string>> {
    if (cache) return cache;
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      cache = JSON.parse(raw) as Record<string, string>;
    } catch {
      cache = {};
    }
    return cache;
  }

  async function save(data: Record<string, string>): Promise<void> {
    cache = data;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data), 'utf8');
  }

  return {
    async get(key) {
      const data = await load();
      return key in data ? data[key] : null;
    },
    async put(key, value) {
      const data = await load();
      data[key] = value;
      await save(data);
    },
    async delete(key) {
      const data = await load();
      delete data[key];
      await save(data);
    },
  };
}
