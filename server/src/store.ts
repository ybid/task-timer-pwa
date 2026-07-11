import type { KV } from './kv';

export type StoreName = 'plans' | 'groups' | 'tasks' | 'dailyRecords' | 'timeRecords';

export const STORES: StoreName[] = ['plans', 'groups', 'tasks', 'dailyRecords', 'timeRecords'];

export interface SyncEntity {
  id: string;
  updatedAt?: string;
  deletedAt?: string | null;
  [key: string]: unknown;
}

export interface SyncChange {
  store: StoreName;
  entity: SyncEntity;
}

/**
 * Per-account, per-store key in KV. Value is a JSON map of id -> entity.
 * Every device signed into the same account shares this namespace, so the
 * data is truly synced across devices (not just backed up per device).
 */
function storeKey(accountId: string, store: StoreName): string {
  return `sync:${accountId}:${store}`;
}

async function readStore(kv: KV, accountId: string, store: StoreName): Promise<Record<string, SyncEntity>> {
  const raw = await kv.get(storeKey(accountId, store));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, SyncEntity>;
  } catch {
    return {};
  }
}

async function writeStore(
  kv: KV,
  accountId: string,
  store: StoreName,
  map: Record<string, SyncEntity>,
): Promise<void> {
  await kv.put(storeKey(accountId, store), JSON.stringify(map));
}

/**
 * Apply incoming changes with last-write-wins on `updatedAt` (mirrors the
 * client-side merge). Soft-deleted entities (`deletedAt` set) are stored as-is
 * so deletions propagate. Deletions made remotely after `since` are also
 * returned to the client on pull.
 */
export async function applyChanges(kv: KV, accountId: string, changes: SyncChange[]): Promise<void> {
  const byStore = new Map<StoreName, SyncEntity[]>();
  for (const ch of changes) {
    if (!STORES.includes(ch.store)) continue;
    const list = byStore.get(ch.store) ?? [];
    list.push(ch.entity);
    byStore.set(ch.store, list);
  }

  for (const [store, entities] of byStore) {
    const map = await readStore(kv, accountId, store);
    for (const entity of entities) {
      if (!entity || typeof entity.id !== 'string') continue;
      const existing = map[entity.id];
      const incoming = entity.updatedAt ?? '0';
      const existingTs = existing?.updatedAt ?? '0';
      if (!existing || incoming >= existingTs) {
        map[entity.id] = entity;
      }
    }
    await writeStore(kv, accountId, store, map);
  }
}

/**
 * Return all entities changed since `since` (strictly greater), plus any
 * soft-deleted entities regardless of `since` so deletions always propagate.
 */
export async function getChangesSince(
  kv: KV,
  accountId: string,
  since: string | null,
): Promise<SyncChange[]> {
  const out: SyncChange[] = [];
  for (const store of STORES) {
    const map = await readStore(kv, accountId, store);
    for (const entity of Object.values(map)) {
      const updated = entity.updatedAt ?? '0';
      if (!since || updated > since || Boolean(entity.deletedAt)) {
        out.push({ store, entity });
      }
    }
  }
  return out;
}
