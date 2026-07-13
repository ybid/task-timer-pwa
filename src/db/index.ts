import { openDB, DBSchema } from 'idb';
import { Plan, Group, Task, DailyRecord, TimeRecord, TimerDraft, Settings, SyncStoreName } from '../types';

interface PlanTimerDB extends DBSchema {
  plans: {
    key: string;
    value: Plan;
  };
  groups: {
    key: string;
    value: Group;
    indexes: { 'by-plan': string };
  };
  tasks: {
    key: string;
    value: Task;
    indexes: { 'by-plan': string; 'by-group': string };
  };
  dailyRecords: {
    key: string;
    value: DailyRecord;
    indexes: { 'by-task': string; 'by-date': string; 'by-task-date': [string, string] };
  };
  timeRecords: {
    key: string;
    value: TimeRecord;
    indexes: { 'by-task': string; 'by-date': string };
  };
  settings: {
    key: string;
    value: Settings;
  };
  timerDrafts: {
    key: string;
    value: TimerDraft;
  };
}

const DB_NAME = 'PlanTimerDB';
const DB_VERSION = 2;

let _db: ReturnType<typeof openDB<PlanTimerDB>> | null = null;

function now(): string {
  return new Date().toISOString();
}

async function getDB() {
  if (!_db) {
    _db = openDB<PlanTimerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('plans')) {
          db.createObjectStore('plans', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('groups')) {
          const store = db.createObjectStore('groups', { keyPath: 'id' });
          store.createIndex('by-plan', 'planId');
        }
        if (!db.objectStoreNames.contains('tasks')) {
          const store = db.createObjectStore('tasks', { keyPath: 'id' });
          store.createIndex('by-plan', 'planId');
          store.createIndex('by-group', 'groupId');
        }
        if (!db.objectStoreNames.contains('dailyRecords')) {
          const store = db.createObjectStore('dailyRecords', { keyPath: 'id' });
          store.createIndex('by-task', 'taskId');
          store.createIndex('by-date', 'date');
          store.createIndex('by-task-date', ['taskId', 'date']);
        }
        if (!db.objectStoreNames.contains('timeRecords')) {
          const store = db.createObjectStore('timeRecords', { keyPath: 'id' });
          store.createIndex('by-task', 'taskId');
          store.createIndex('by-date', 'date');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('timerDrafts')) {
          db.createObjectStore('timerDrafts', { keyPath: 'id' });
        }
      },
    });
  }
  return _db;
}

const alive = <T extends { deletedAt?: string | null }>(rows: T[]): T[] =>
  rows.filter((r) => !r.deletedAt);

// ─── Settings ───

const DEFAULT_SETTINGS: Settings = {
  id: 'ui',
  datePreset: 7,
  customFrom: '',
  customTo: '',
  taskColWidth: 160,
  lastSync: null,
  accountId: null,
  accountToken: null,
  username: null,
  syncEnabled: false,
};

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const s = await db.get('settings', 'ui');
  return s ?? { ...DEFAULT_SETTINGS };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = await getDB();
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, id: 'ui' };
  await db.put('settings', next);
  return next;
}

// ─── Timer draft (resume support) ───

export async function saveTimerDraft(draft: TimerDraft): Promise<void> {
  const db = await getDB();
  await db.put('timerDrafts', draft);
}

export async function getTimerDraft(): Promise<TimerDraft | undefined> {
  const db = await getDB();
  return db.get('timerDrafts', 'current');
}

export async function clearTimerDraft(): Promise<void> {
  const db = await getDB();
  await db.delete('timerDrafts', 'current');
}

// ─── Plan CRUD ───

export async function addPlan(plan: Omit<Plan, 'updatedAt' | 'deletedAt'>) {
  const db = await getDB();
  const ts = now();
  await db.put('plans', { ...plan, updatedAt: ts, deletedAt: null });
}

export async function updatePlan(plan: Plan) {
  const db = await getDB();
  await db.put('plans', { ...plan, updatedAt: now() });
}

export async function deletePlan(id: string) {
  // Cascade soft-delete: mark plan + all children as deleted (last-write-wins friendly).
  const db = await getDB();
  const ts = now();
  const tx = db.transaction(
    ['plans', 'groups', 'tasks', 'dailyRecords', 'timeRecords'],
    'readwrite',
  );
  const plan = await tx.objectStore('plans').get(id);
  if (plan) {
    plan.deletedAt = ts;
    plan.updatedAt = ts;
    await tx.objectStore('plans').put(plan);
  }
  const cascade = async (store: SyncStoreName, index: string, key: string) => {
    interface CursorLike {
      value: unknown;
      continue(): Promise<CursorLike | null>;
      update(value: unknown): Promise<unknown>;
    }
    const os = tx.objectStore(store) as unknown as {
      index(name: string): { openCursor(range?: IDBKeyRange | null): Promise<CursorLike | null> };
    };
    const idx = os.index(index);
    let cur = await idx.openCursor(IDBKeyRange.only(key));
    while (cur) {
      const v = cur.value as { deletedAt?: string | null; updatedAt?: string };
      v.deletedAt = ts;
      v.updatedAt = ts;
      await cur.update(v);
      cur = await cur.continue();
    }
  };
  await cascade('groups', 'by-plan', id);
  await cascade('tasks', 'by-plan', id);
  // daily & time records belong to tasks of this plan
  const taskIds = (await db.getAllFromIndex('tasks', 'by-plan', id)).map((t) => t.id);
  for (const taskId of taskIds) {
    await cascade('dailyRecords', 'by-task', taskId);
    await cascade('timeRecords', 'by-task', taskId);
  }
  await tx.done;
}

export async function getPlans(): Promise<Plan[]> {
  const db = await getDB();
  return alive(await db.getAll('plans'));
}

export async function getPlan(id: string): Promise<Plan | undefined> {
  const db = await getDB();
  const p = await db.get('plans', id);
  return p && !p.deletedAt ? p : undefined;
}

// ─── Group CRUD ───

export async function addGroup(group: Omit<Group, 'updatedAt' | 'deletedAt'>) {
  const db = await getDB();
  const ts = now();
  await db.put('groups', {
    ...group,
    createdAt: group.createdAt || ts,
    updatedAt: ts,
    deletedAt: null,
  });
}

export async function updateGroup(group: Group) {
  const db = await getDB();
  await db.put('groups', { ...group, updatedAt: now() });
}

export async function deleteGroup(id: string) {
  const db = await getDB();
  const g = await db.get('groups', id);
  if (g) {
    g.deletedAt = now();
    g.updatedAt = now();
    await db.put('groups', g);
  }
}

export async function getGroupsByPlan(planId: string): Promise<Group[]> {
  const db = await getDB();
  return alive(await db.getAllFromIndex('groups', 'by-plan', planId));
}

// ─── Task CRUD ───

export async function addTask(task: Omit<Task, 'updatedAt' | 'deletedAt'>) {
  const db = await getDB();
  const ts = now();
  await db.put('tasks', {
    ...task,
    createdAt: task.createdAt || ts,
    updatedAt: ts,
    deletedAt: null,
  });
}

export async function updateTask(task: Task) {
  const db = await getDB();
  await db.put('tasks', { ...task, updatedAt: now() });
}

export async function deleteTask(id: string) {
  const db = await getDB();
  const t = await db.get('tasks', id);
  if (t) {
    t.deletedAt = now();
    t.updatedAt = now();
    await db.put('tasks', t);
  }
}

export async function getTasksByPlan(planId: string): Promise<Task[]> {
  const db = await getDB();
  return alive(await db.getAllFromIndex('tasks', 'by-plan', planId));
}

export async function getTasksByGroup(groupId: string): Promise<Task[]> {
  const db = await getDB();
  return alive(await db.getAllFromIndex('tasks', 'by-group', groupId));
}

// ─── DailyRecord CRUD ───

export async function upsertDailyRecord(record: Omit<DailyRecord, 'updatedAt' | 'deletedAt'>) {
  const db = await getDB();
  const ts = now();
  const existing = await db.getAllFromIndex('dailyRecords', 'by-task-date', [record.taskId, record.date]);
  if (existing.length > 0) {
    const rec = existing[0];
    rec.completedCount = record.completedCount;
    if (record.note !== undefined) rec.note = record.note;
    rec.updatedAt = ts;
    rec.deletedAt = null;
    await db.put('dailyRecords', rec);
    return rec;
  }
  const rec: DailyRecord = { ...record, updatedAt: ts, deletedAt: null };
  await db.put('dailyRecords', rec);
  return rec;
}

export async function deleteDailyRecord(id: string) {
  const db = await getDB();
  const r = await db.get('dailyRecords', id);
  if (r) {
    r.deletedAt = now();
    r.updatedAt = now();
    await db.put('dailyRecords', r);
  }
}

export async function getDailyRecordsByTask(taskId: string): Promise<DailyRecord[]> {
  const db = await getDB();
  return alive(await db.getAllFromIndex('dailyRecords', 'by-task', taskId));
}

export async function getDailyRecordsByDateRange(from: string, to: string): Promise<DailyRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('dailyRecords', 'by-date', IDBKeyRange.bound(from, to));
  return alive(all);
}

export async function getDailyRecord(taskId: string, date: string): Promise<DailyRecord | undefined> {
  const db = await getDB();
  const records = await db.getAllFromIndex('dailyRecords', 'by-task-date', [taskId, date]);
  return records.find((r) => !r.deletedAt);
}

export async function getDailyRecordsForPlan(planId: string, dateFrom: string, dateTo: string): Promise<DailyRecord[]> {
  const tasks = await getTasksByPlan(planId);
  const taskIds = tasks.map((t) => t.id);
  if (taskIds.length === 0) return [];

  const db = await getDB();
  const results: DailyRecord[] = [];
  for (const taskId of taskIds) {
    const records = await db.getAllFromIndex('dailyRecords', 'by-task-date',
      IDBKeyRange.bound([taskId, dateFrom], [taskId, dateTo + '￿'])
    );
    for (const r of records) if (!r.deletedAt) results.push(r);
  }
  return results;
}

// ─── TimeRecord CRUD ───

export async function addTimeRecord(record: Omit<TimeRecord, 'updatedAt' | 'deletedAt'>) {
  const db = await getDB();
  const ts = now();
  await db.put('timeRecords', { ...record, updatedAt: ts, deletedAt: null });
}

export async function getTimeRecordsByTask(taskId: string): Promise<TimeRecord[]> {
  const db = await getDB();
  return alive(await db.getAllFromIndex('timeRecords', 'by-task', taskId));
}

export async function getTimeRecordsByDate(date: string): Promise<TimeRecord[]> {
  const db = await getDB();
  return alive(await db.getAllFromIndex('timeRecords', 'by-date', date));
}

/** All time records of a plan's tasks (used for per-date time aggregation). */
export async function getTimeRecordsForPlan(planId: string): Promise<TimeRecord[]> {
  const tasks = await getTasksByPlan(planId);
  const taskIds = tasks.map((t) => t.id);
  if (taskIds.length === 0) return [];
  const db = await getDB();
  const results: TimeRecord[] = [];
  for (const taskId of taskIds) {
    const records = await db.getAllFromIndex('timeRecords', 'by-task', taskId);
    for (const r of records) if (!r.deletedAt) results.push(r);
  }
  return results;
}

export async function getTotalDurationByTask(taskId: string): Promise<number> {
  const records = await getTimeRecordsByTask(taskId);
  return records.reduce((sum, r) => sum + r.duration, 0);
}

// ─── Sync helpers (B5) ───

/** Return every entity (including soft-deleted) for full/initial push. */
export async function getAllForStore(store: SyncStoreName): Promise<unknown[]> {
  const db = await getDB();
  return db.getAll(store);
}

/**
 * Apply remote changes with last-write-wins on `updatedAt`. Used by the sync
 * client after a pull. Soft-deleted remote rows are written as-is (their
 * `deletedAt` makes them invisible to the rest of the app).
 */
export async function applySyncChanges(changes: { store: SyncStoreName; entity: unknown }[]): Promise<void> {
  const db = await getDB();
  for (const { store, entity } of changes) {
    const rec = entity as { id: string; updatedAt?: string; deletedAt?: string | null };
    const existing = (await db.get(store, rec.id)) as { updatedAt?: string } | undefined;
    const incomingTs = rec.updatedAt ?? '0';
    const existingTs = existing?.updatedAt ?? '0';
    if (incomingTs >= existingTs) {
      await db.put(store, entity as never);
    }
  }
}

// ─── helpers ───

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDateRange(daysBack: number, daysForward = 0): { from: string; to: string } {
  const now0 = new Date();
  const from = new Date(now0);
  from.setDate(now0.getDate() - daysBack);
  const to = new Date(now0);
  to.setDate(now0.getDate() + daysForward);
  return { from: formatDate(from), to: formatDate(to) };
}

export function generateDateList(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  // Guard against inverted range
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return dates;
  const current = new Date(start);
  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
