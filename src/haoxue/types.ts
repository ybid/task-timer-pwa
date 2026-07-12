// 口算训练（haoxue）子模块 — 实体类型定义
// 数据经当前项目账户并入云端同步（store 前缀 hx_，按 accountId 隔离）。

export type Operator = '+' | '-' | '×' | '÷';

export type QuestionState2 = 'learning' | 'mastered';

/** 多孩子档案元数据（全局列表） */
export interface ProfileMeta {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface ProfilesList {
  schemaVer: number;
  activeProfileId: string;
  list: ProfileMeta[];
}

/** 单孩子作用域数据：profile 元信息 */
export interface ProfileData {
  schemaVer: number;
  createdAt: number;
  lastActiveAt: number;
  totalActiveMs: number;
  appVersion: string;
  xp: number;
  maxCombo: number;
  streakBest: number;
}

export interface HaoxueSettings {
  schemaVer: number;
  sound: boolean;
  motion: boolean;
  fontSize: 'normal' | 'large';
  timeoutSecByType: { single: number; double: number };
  timeoutWarnSec: number;
  cooldownMinutes: number;
  cooldownThreshold: number;
  challengeDurationSec: number;
  gentleTiming: boolean;
  requiredCorrect: number;
  hintEnabled: boolean;
}

export interface LevelProgress {
  unlocked: boolean;
  passed: boolean;
  passedAt: number | null;
  totalShown: number;
  totalCorrect: number;
  firstCorrectRate: number;
  currentSession: number;
}

export interface Progress {
  schemaVer: number;
  levels: Record<number, LevelProgress>;
}

export interface QuestionState {
  status: QuestionState2;
  correctCount: number;
  errorCount: number;
  attempts: number;
  timeoutCount: number;
  hintPending: boolean;
  lastErrorAt?: number;
  cooldownUntil?: number | null;
  lastCorrectAt?: number;
}

export interface LevelMastery {
  questions: Record<string, QuestionState>;
  stats: { mastered: number; pending: number; sessionAttempted: number };
}

export interface Mastery {
  schemaVer: number;
  byLevel: Record<number, LevelMastery>;
}

export interface ErrorSets {
  schemaVer: number;
  byLevel: Record<number, string[]>;
}

export interface ErrorItem {
  id: string;
  levelId: number;
  expr: string;
  answer: number;
  wrongFirst: number | null;
  recordedAt: number;
  hitCount: number;
  removedAt: number | null;
  totalAttempts: number;
  timeoutCount: number;
}

export interface Errors {
  schemaVer: number;
  items: ErrorItem[];
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  unlockedAt: number;
  seen: boolean;
}

export interface Achievements {
  schemaVer: number;
  unlocked: Achievement[];
  totalUnlocked: number;
}

export interface ChallengeLevel {
  bestScore: number;
  bestCorrect: number;
  plays: number;
  lastPlayedAt: number | null;
}

export interface Challenges {
  schemaVer: number;
  byLevel: Record<number, ChallengeLevel>;
}

export interface DailyStat {
  activeMs: number;
  sessions: number;
  questions: number;
  firstCorrect: number;
}

export interface Daily {
  schemaVer: number;
  byDate: Record<string, DailyStat>;
}

export type TrendDirection = 'stable' | 'improving' | 'declining';
export type Suggestion = 'easier' | 'harder' | null;

export interface SmartStat {
  recentResults: { timestamp: number; correct: boolean; responseMs: number; timeouted: boolean }[];
  totalAttempts: number;
  totalCorrect: number;
  totalTimeout: number;
  avgResponseMs: number;
  accuracyRate: number;
  trendDirection: TrendDirection;
  dynamicTimeoutMs: number | null;
  suggestion: Suggestion;
}

export interface SmartStats {
  schemaVer: number;
  byLevel: Record<number, SmartStat>;
}

/** 关卡配置 */
export interface LevelConfig {
  id: number;
  name: string;
  icon: string;
  desc: string;
  operators: Operator[];
  range: {
    a: [number, number];
    b: [number, number];
    add?: { a: [number, number]; b: [number, number] };
    sub?: { a: [number, number]; b: [number, number] };
  };
  filter?: { type: 'mixed' | 'carry' | 'noCarry' | 'borrow' | 'noBorrow' | 'exact' };
  timeoutSec: number;
  weights?: Partial<Record<Operator, number>>;
  coverageSet: string[] | null;
}

/** 一道题 */
export interface Question {
  a: number;
  op: Operator;
  b: number;
  answer: number;
  expr: string;
}

export interface TrainingQuestion {
  question: Question;
  options: number[];
  levelId: number;
}

/** 本地 KV 实体统一携带 updatedAt 用于同步 last-write-wins */
export interface Syncable {
  updatedAt?: string;
}
