// haoxue 独立 IndexedDB 存储（key-value），与 task-timer 主 DB 隔离。
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'haoxue';
const STORE = 'kv';
const DB_VERSION = 1;

let dbp: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'k' });
        }
      },
    });
  }
  return dbp;
}

export interface KVRow {
  k: string;
  v: unknown;
  _ts?: string;
}

export async function getKV<T>(k: string): Promise<T | null> {
  const db = await getDB();
  const row = (await db.get(STORE, k)) as KVRow | undefined;
  return row ? (row.v as T) : null;
}

/** 写入并返回 ISO 时间戳（用于同步 last-write-wins） */
export async function setKV<T>(k: string, v: T): Promise<string> {
  const db = await getDB();
  const _ts = new Date().toISOString();
  await db.put(STORE, { k, v, _ts });
  return _ts;
}

export async function getAllKV(): Promise<KVRow[]> {
  const db = await getDB();
  return (await db.getAll(STORE)) as KVRow[];
}

export async function delKV(k: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, k);
}

export async function delByPrefix(prefix: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.key.toString().startsWith(prefix)) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}
