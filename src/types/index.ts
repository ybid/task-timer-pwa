export interface Plan {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Group {
  id: string;
  planId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Task {
  id: string;
  planId: string;
  groupId: string | null;
  name: string;
  targetCount: number;
  completedCount: number;
  /** 进度汇总方式：cumulative=每日增量求和（打卡/练习）；absolute=取最远到达值（看书/看剧到第几） */
  progressMode?: 'cumulative' | 'absolute';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DailyRecord {
  id: string;
  taskId: string;
  date: string;       // "2026-07-05"
  completedCount: number;
  note?: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TimeRecord {
  id: string;
  taskId: string;
  startTime: string;
  endTime: string;
  duration: number;
  date: string;       // "2026-07-05"
  note?: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** View helper: daily progress with target info */
export interface TaskDailyView {
  task: Task;
  dailyRecords: DailyRecord[];
}

/** In-progress timer snapshot so a refresh can resume it. Singleton (id: 'current'). */
export interface TimerDraft {
  id: 'current';
  taskId: string;
  taskName: string;
  date: string;
  /** ISO time the timer originally started (for stats attribution) */
  originStart: string;
  /** seconds already counted, excluding the current running segment */
  accumulated: number;
  /** ISO start of the current running segment, or null if paused */
  segmentStart: string | null;
  updatedAt: string;
}

/** UI + sync preferences. Singleton (id: 'ui'). */
export interface Settings {
  id: 'ui';
  datePreset: 7 | 30 | 'custom';
  customFrom: string;
  customTo: string;
  taskColWidth: number;
  /** ISO timestamp of last successful sync, or null */
  lastSync: string | null;
  /** account id of the signed-in sync user */
  accountId: string | null;
  /** HMAC token for the sync API */
  accountToken: string | null;
  /** display username of the signed-in sync user */
  username: string | null;
  syncEnabled: boolean;
}

/** The five synced entity types, union for the sync layer. */
export type SyncEntity = Plan | Group | Task | DailyRecord | TimeRecord;
export type SyncStoreName = 'plans' | 'groups' | 'tasks' | 'dailyRecords' | 'timeRecords';
