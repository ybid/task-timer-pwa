// haoxue 云同步桥：复用 task-timer 后端 /api/sync 契约（store 前缀 hx_，按 accountId 隔离）。
// 同步时间戳独立存于 haoxue 自有 kv（'haoxue:sync'），不污染主项目 settings.lastSync。
import { getSettings } from '../../db';
import { getKV, setKV } from '../store/db';
import { exportAllChanges, importChange } from '../store/profiles';

const SYNC_API_BASE: string =
  (import.meta.env.VITE_SYNC_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

const SYNC_META_KEY = 'haoxue:sync';

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;

function stripMeta(e: Record<string, unknown>): Record<string, unknown> {
  const { id, updatedAt, deletedAt, _ts, ...rest } = e;
  return rest;
}

async function getLastSync(): Promise<string> {
  const meta = await getKV<{ lastSync?: string }>(SYNC_META_KEY);
  return meta?.lastSync ?? '';
}

async function setLastSync(ts: string): Promise<void> {
  await setKV(SYNC_META_KEY, { lastSync: ts });
}

export type SyncOutcome = { ok: boolean; error?: string; needsAuth?: boolean };

/** 本地变更后防抖调度 push（1.5s） */
export function scheduleSync(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void pushNow();
  }, 1500);
}

export async function pushNow(): Promise<SyncOutcome> {
  if (pushing) return { ok: true };
  pushing = true;
  try {
    const settings = await getSettings();
    if (!SYNC_API_BASE) return { ok: false, error: '未配置同步服务器' };
    if (!settings.accountToken) return { ok: false, error: '需要登录', needsAuth: true };
    const changes = await exportAllChanges();
    if (changes.length === 0) return { ok: true };
    const payload = changes.map((c) => ({
      store: c.store,
      entity: { id: c.id, ...(c.data as Record<string, unknown>), updatedAt: c.updatedAt },
    }));
    const res = await fetch(`${SYNC_API_BASE}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.accountToken}` },
      body: JSON.stringify({ changes: payload }),
    });
    if (!res.ok) return { ok: false, error: `push failed: ${res.status}` };
    await res.json();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  } finally {
    pushing = false;
  }
}

export async function pullNow(): Promise<SyncOutcome> {
  try {
    const settings = await getSettings();
    if (!SYNC_API_BASE) return { ok: false, error: '未配置同步服务器' };
    if (!settings.accountToken) return { ok: false, error: '需要登录', needsAuth: true };
    const since = await getLastSync();
    const url = `${SYNC_API_BASE}/api/sync?since=${encodeURIComponent(since)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${settings.accountToken}` } });
    if (!res.ok) return { ok: false, error: `pull failed: ${res.status}` };
    const data = (await res.json()) as {
      changes: { store: string; entity: Record<string, unknown> }[];
      now: string;
    };
    for (const ch of data.changes || []) {
      if (!ch.store?.startsWith('hx_')) continue; // 只处理 haoxue 数据
      const id = ch.entity?.id as string | undefined;
      if (!id) continue;
      await importChange(
        id,
        ch.store,
        stripMeta(ch.entity),
        (ch.entity?.updatedAt as string) ?? new Date().toISOString(),
      );
    }
    await setLastSync(data.now);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
}

/** 完整同步：先 push 本地，再 pull 云端（供 UI 按钮调用） */
export async function syncNow(): Promise<SyncOutcome> {
  const push = await pushNow();
  if (!push.ok) return push;
  const pull = await pullNow();
  return pull;
}
