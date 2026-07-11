import { getAllForStore, applySyncChanges, getSettings, saveSettings } from '../db';
import { SyncStoreName } from '../types';
import { uuid } from '../utils/uuid';

/**
 * Lightweight cloud-sync client (local-first).
 *
 * The backend is a tiny Hono serverless API (see /server). When unreachable,
 * the app keeps working fully offline; sync just no-ops. The sync protocol is
 * pull/push with last-write-wins keyed by `updatedAt`, and deletions propagate
 * as soft-deletes (`deletedAt`).
 */

const STORES: SyncStoreName[] = ['plans', 'groups', 'tasks', 'dailyRecords', 'timeRecords'];

export const SYNC_API_BASE: string =
  (import.meta.env.VITE_SYNC_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

async function authDevice(token?: string | null, deviceId?: string | null): Promise<string> {
  if (token) return token;
  const id = deviceId ?? uuid();
  const res = await fetch(`${SYNC_API_BASE}/api/auth/device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: id }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  await saveSettings({ deviceId: id, deviceToken: data.token });
  return data.token;
}

async function pushChanges(token: string, since: string | null): Promise<void> {
  const changes: { store: SyncStoreName; entity: unknown }[] = [];
  for (const store of STORES) {
    const rows = (await getAllForStore(store)) as Array<{
      updatedAt?: string;
      deletedAt?: string | null;
    }>;
    for (const entity of rows) {
      const changed =
        !since || (entity.updatedAt != null && entity.updatedAt > since) || Boolean(entity.deletedAt);
      if (changed) changes.push({ store, entity });
    }
  }
  if (changes.length === 0) return;
  const res = await fetch(`${SYNC_API_BASE}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ changes }),
  });
  if (!res.ok) throw new Error(`push failed: ${res.status}`);
  await res.json(); // { now }
}

async function pullChanges(token: string, since: string | null): Promise<string> {
  const url = `${SYNC_API_BASE}/api/sync?since=${encodeURIComponent(since ?? '')}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  const data = (await res.json()) as { changes: { store: SyncStoreName; entity: unknown }[]; now: string };
  await applySyncChanges(data.changes);
  return data.now;
}

export interface SyncResult {
  ok: boolean;
  error?: string;
  lastSync: string | null;
}

/** Push local changes, then pull remote changes, then record lastSync. */
export async function performSync(): Promise<SyncResult> {
  const settings = await getSettings();
  if (!SYNC_API_BASE) {
    return { ok: false, error: '未配置同步服务器', lastSync: settings.lastSync };
  }
  try {
    const token = await authDevice(settings.deviceToken, settings.deviceId);
    await pushChanges(token, settings.lastSync);
    const now = await pullChanges(token, settings.lastSync);
    await saveSettings({ lastSync: now, syncEnabled: true });
    return { ok: true, lastSync: now };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, lastSync: settings.lastSync };
  }
}
