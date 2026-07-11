import { getAllForStore, applySyncChanges, getSettings, saveSettings } from '../db';
import { SyncStoreName } from '../types';

/**
 * Account-based cloud-sync client (local-first).
 *
 * The backend is a tiny Hono serverless API (see /server). The user signs in
 * with a username + password (see `login`/`register`), receives an HMAC token,
 * and from then on every device sharing that account reads/writes the same
 * cloud dataset. When unreachable, the app keeps working fully offline; sync
 * just no-ops. The sync protocol is pull/push with last-write-wins keyed by
 * `updatedAt`, and deletions propagate as soft-deletes (`deletedAt`).
 */

const STORES: SyncStoreName[] = ['plans', 'groups', 'tasks', 'dailyRecords', 'timeRecords'];

export const SYNC_API_BASE: string =
  (import.meta.env.VITE_SYNC_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export type AuthSuccess = { ok: true; token: string; accountId: string };
export type AuthFailure = { ok: false; error: string; status: number };
export type AuthResult = AuthSuccess | AuthFailure;

async function postAuth(
  path: string,
  username: string,
  password: string,
): Promise<AuthResult> {
  try {
    const res = await fetch(`${SYNC_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string; accountId?: string; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `请求失败 (${res.status})`, status: res.status };
    if (!data.token || !data.accountId) return { ok: false, error: '服务端返回异常', status: 502 };
    return { ok: true, token: data.token, accountId: data.accountId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误', status: 0 };
  }
}

/** Register a new account and persist the returned token locally. */
export async function register(username: string, password: string): Promise<AuthResult> {
  const res = await postAuth('/api/auth/register', username, password);
  if (res.ok) {
    await saveSettings({ username, accountId: res.accountId, accountToken: res.token, syncEnabled: true });
  }
  return res;
}

/** Log in to an existing account and persist the returned token locally. */
export async function login(username: string, password: string): Promise<AuthResult> {
  const res = await postAuth('/api/auth/login', username, password);
  if (res.ok) {
    await saveSettings({ username, accountId: res.accountId, accountToken: res.token, syncEnabled: true });
  }
  return res;
}

/** Clear local credentials (keeps lastSync so re-login can resume incrementally). */
export async function logout(): Promise<void> {
  await saveSettings({ accountToken: null, accountId: null, username: null });
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
  /** true when the call failed only because no account is signed in */
  needsAuth?: boolean;
  lastSync: string | null;
}

/** Push local changes, then pull remote changes, then record lastSync. */
export async function performSync(): Promise<SyncResult> {
  const settings = await getSettings();
  if (!SYNC_API_BASE) {
    return { ok: false, error: '未配置同步服务器', lastSync: settings.lastSync };
  }
  if (!settings.accountToken) {
    return { ok: false, error: '需要登录', needsAuth: true, lastSync: settings.lastSync };
  }
  try {
    const token = settings.accountToken;
    await pushChanges(token, settings.lastSync);
    const now = await pullChanges(token, settings.lastSync);
    await saveSettings({ lastSync: now });
    return { ok: true, lastSync: now };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, lastSync: settings.lastSync };
  }
}
