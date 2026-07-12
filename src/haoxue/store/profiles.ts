// 多孩子档案管理 + 实体读写（基于 db.ts 的独立 IndexedDB）
import { delByPrefix, getKV, setKV, getAllKV } from './db';
import type {
  Achievements,
  Challenges,
  Daily,
  ErrorSets,
  Errors,
  Mastery,
  ProfileData,
  ProfileMeta,
  ProfilesList,
  Progress,
  HaoxueSettings,
  SmartStats,
} from '../types';

const SCHEMA_VERSION = 4;
const APP_VERSION = '1.0.0';
const PROFILES_KEY = 'profiles';

export const ENTITY_KEYS = [
  'profile',
  'settings',
  'progress',
  'mastery',
  'errorSets',
  'errors',
  'achievements',
  'challenges',
  'daily',
  'smartStats',
] as const;
export type EntityKey = (typeof ENTITY_KEYS)[number];

function defaultEntity(key: EntityKey): unknown {
  switch (key) {
    case 'profile':
      return {
        schemaVer: SCHEMA_VERSION,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalActiveMs: 0,
        appVersion: APP_VERSION,
        xp: 0,
        maxCombo: 0,
        streakBest: 0,
      } as ProfileData;
    case 'settings':
      return {
        schemaVer: SCHEMA_VERSION,
        sound: true,
        motion: true,
        fontSize: 'normal',
        timeoutSecByType: { single: 5, double: 10 },
        timeoutWarnSec: 3,
        cooldownMinutes: 5,
        cooldownThreshold: 5,
        challengeDurationSec: 60,
        gentleTiming: true,
        requiredCorrect: 3,
        hintEnabled: true,
      } as HaoxueSettings;
    case 'progress':
      return { schemaVer: SCHEMA_VERSION, levels: {} } as Progress;
    case 'mastery':
      return { schemaVer: SCHEMA_VERSION, byLevel: {} } as Mastery;
    case 'errorSets':
      return { schemaVer: SCHEMA_VERSION, byLevel: {} } as ErrorSets;
    case 'errors':
      return { schemaVer: SCHEMA_VERSION, items: [] } as Errors;
    case 'achievements':
      return { schemaVer: SCHEMA_VERSION, unlocked: [], totalUnlocked: 0 } as Achievements;
    case 'challenges':
      return { schemaVer: SCHEMA_VERSION, byLevel: {} } as Challenges;
    case 'daily':
      return { schemaVer: SCHEMA_VERSION, byDate: {} } as Daily;
    case 'smartStats':
      return { schemaVer: SCHEMA_VERSION, byLevel: {} } as SmartStats;
  }
}

export const entityKey = (pid: string, key: EntityKey): string => `${pid}:${key}`;

export async function loadProfiles(): Promise<ProfilesList> {
  let list = await getKV<ProfilesList>(PROFILES_KEY);
  if (!list || !list.list || list.list.length === 0) {
    list = createDefaultList();
    await setKV(PROFILES_KEY, list);
  }
  return list;
}

function createDefaultList(): ProfilesList {
  const id = 'p_default_' + Date.now().toString(36);
  return {
    schemaVer: SCHEMA_VERSION,
    activeProfileId: id,
    list: [{ id, name: '小朋友', avatar: '👦', createdAt: Date.now(), lastActiveAt: Date.now() }],
  };
}

export async function getActiveId(): Promise<string> {
  const list = await loadProfiles();
  return list.activeProfileId;
}

export async function getEntity<T>(pid: string, key: EntityKey): Promise<T> {
  const v = await getKV<T>(entityKey(pid, key));
  if (v === null) {
    const def = defaultEntity(key) as T;
    await setKV(entityKey(pid, key), def);
    return def;
  }
  return v;
}

export async function setEntity<T>(pid: string, key: EntityKey, value: T): Promise<string> {
  return setKV(entityKey(pid, key), value);
}

export async function createProfile(name: string, avatar: string): Promise<ProfilesList> {
  const list = await loadProfiles();
  const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const meta: ProfileMeta = {
    id,
    name,
    avatar: avatar || '👦',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  list.list.push(meta);
  list.activeProfileId = id;
  await setKV(PROFILES_KEY, list);
  for (const key of ENTITY_KEYS) {
    await setKV(entityKey(id, key), defaultEntity(key));
  }
  return list;
}

export async function switchProfile(id: string): Promise<ProfilesList> {
  const list = await loadProfiles();
  const found = list.list.find((p) => p.id === id);
  if (!found) return list;
  list.activeProfileId = id;
  await setKV(PROFILES_KEY, list);
  return list;
}

export async function removeProfile(id: string): Promise<ProfilesList> {
  const list = await loadProfiles();
  if (list.list.length <= 1) return list;
  list.list = list.list.filter((p) => p.id !== id);
  if (list.activeProfileId === id) list.activeProfileId = list.list[0].id;
  await setKV(PROFILES_KEY, list);
  await delByPrefix(`${id}:`);
  return list;
}

export async function initProfileData(pid: string): Promise<void> {
  for (const key of ENTITY_KEYS) {
    const existing = await getKV(entityKey(pid, key));
    if (existing === null) await setKV(entityKey(pid, key), defaultEntity(key));
  }
}

/** 导出全部 haoxue 数据为 changes（用于同步）：每个 kv 行 = 一个 {id, store, data, updatedAt} */
export async function exportAllChanges(): Promise<
  { id: string; store: string; data: unknown; updatedAt: string }[]
> {
  const rows = await getAllKV();
  return rows
    .filter((r) => r.k !== PROFILES_KEY && r.k !== 'haoxue:sync')
    .map((r) => {
      const [, entity] = r.k.split(':');
      return {
        id: r.k,
        store: `hx_${entity}`,
        data: r.v,
        updatedAt: r._ts ?? new Date().toISOString(),
      };
    })
    .concat({
      id: PROFILES_KEY,
      store: 'hx_profiles',
      data: await getKV(PROFILES_KEY),
      updatedAt: new Date().toISOString(),
    });
}

export async function importChange(id: string, _store: string, data: unknown, _updatedAt: string): Promise<void> {
  // P0：pull 时云端为最近状态，直接覆盖本地（last-write-wins 已在后端按 updatedAt 处理）
  await setKV(id, data);
}
