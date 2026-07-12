// 口算训练核心算法（移植自 haoxue 原 generator / smartDifficulty / mastery 模块）
// 全部为纯函数：接收当前状态，返回更新后的新状态（不可变更新），由 store hook 负责持久化。

import type {
  ErrorSets,
  LevelConfig,
  LevelMastery,
  Mastery,
  Operator,
  Progress,
  Question,
  SmartStat,
  SmartStats,
} from '../types';
import { getLevel } from './levels';
import { pick, randInt, shuffle } from './utils';

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

// =================================================================
// 出题 / 选项生成（generator）
// =================================================================
function isCarry(a: number, b: number): boolean {
  return (a % 10) + (b % 10) >= 10;
}
function isBorrow(a: number, b: number): boolean {
  return (a % 10) < (b % 10);
}

function genAddition(config: LevelConfig, _op: '+'): Question {
  for (let i = 0; i < 100; i++) {
    const a = randInt(config.range.a[0], config.range.a[1]);
    const b = randInt(config.range.b[0], config.range.b[1]);
    if (config.filter?.type === 'carry' && !isCarry(a, b)) continue;
    if (config.filter?.type === 'noCarry' && isCarry(a, b)) continue;
    return { a, op: '+', b, answer: a + b, expr: `${a}+${b}` };
  }
  const a = randInt(config.range.a[0], config.range.a[1]);
  const b = randInt(config.range.b[0], config.range.b[1]);
  return { a, op: '+', b, answer: a + b, expr: `${a}+${b}` };
}

function genSubtraction(config: LevelConfig, _op: '-'): Question {
  for (let i = 0; i < 100; i++) {
    const sub = config.range;
    const a = randInt(sub.a[0], sub.a[1]);
    const b = randInt(sub.b[0], sub.b[1]);
    if (a < b) continue;
    if (config.filter?.type === 'borrow' && !isBorrow(a, b)) continue;
    if (config.filter?.type === 'noBorrow' && isBorrow(a, b)) continue;
    return { a, op: '-', b, answer: a - b, expr: `${a}-${b}` };
  }
  const a = randInt(20, 99);
  const b = randInt(1, 9);
  return { a, op: '-', b: Math.min(a, b), answer: a - b, expr: `${a}-${b}` };
}

function genMultiplication(_config: LevelConfig): Question {
  const a = randInt(1, 9);
  const b = randInt(1, 9);
  return { a, op: '×', b, answer: a * b, expr: `${a}×${b}` };
}

function genDivision(_config: LevelConfig): Question {
  for (let i = 0; i < 100; i++) {
    const b = randInt(1, 9);
    const q = randInt(1, 9);
    const a = b * q;
    if (a < 1 || a > 81) continue;
    return { a, op: '÷', b, answer: q, expr: `${a}÷${b}` };
  }
  return { a: 6, op: '÷', b: 2, answer: 3, expr: '6÷2' };
}

function weightedPick(operators: Operator[], weights?: Partial<Record<Operator, number>>): Operator {
  if (!weights) return pick(operators);
  const entries = operators.map((op) => [op, weights[op] ?? 1] as const);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [op, w] of entries) {
    if (r < w) return op;
    r -= w;
  }
  return operators[0];
}

export function generate(config: LevelConfig): Question {
  const op = config.operators.length === 1 ? config.operators[0] : weightedPick(config.operators, config.weights);
  if (op === '+') return genAddition(config, '+');
  if (op === '-') return genSubtraction(config, '-');
  if (op === '×') return genMultiplication(config);
  if (op === '÷') return genDivision(config);
  return genAddition(config, '+');
}

export function generateByExpr(expr: string, config: LevelConfig): Question {
  const m = expr.match(/^(\d+)\s*([+\-×÷])\s*(\d+)$/);
  if (!m) return generate(config);
  const a = parseInt(m[1], 10);
  const op = m[2] as Operator;
  const b = parseInt(m[3], 10);
  const answer = op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : Math.floor(a / b);
  return { a, op, b, answer, expr };
}

export function generateOptions(correctAnswer: number, expr: string): number[] {
  const options = new Set<number>([correctAnswer]);
  const op = expr.match(/([+\-×÷])/)?.[1];
  const isMulDiv = op === '×' || op === '÷';

  const strategies = [
    () => correctAnswer + randInt(1, 3),
    () => correctAnswer - randInt(1, 3),
    () => correctAnswer + (Math.random() < 0.5 ? 1 : -1) * randInt(2, 5),
    () => (isMulDiv ? correctAnswer + randInt(-3, 3) || correctAnswer + 1 : correctAnswer + 10),
    () => (isMulDiv ? correctAnswer - randInt(-3, 3) || correctAnswer - 1 : correctAnswer - 10),
    () => correctAnswer + randInt(1, 9),
    () => correctAnswer - randInt(1, 9),
  ];

  let attempts = 0;
  while (options.size < 4 && attempts < 100) {
    const candidate = strategies[Math.floor(Math.random() * strategies.length)]();
    if (candidate >= 0 && Number.isInteger(candidate) && candidate !== correctAnswer && candidate < 1000) {
      options.add(candidate);
    }
    attempts++;
  }

  let extra = 1;
  while (options.size < 4) {
    if (!options.has(correctAnswer + extra) && correctAnswer + extra >= 0) options.add(correctAnswer + extra);
    if (!options.has(correctAnswer - extra) && correctAnswer - extra >= 0) options.add(correctAnswer - extra);
    extra++;
    if (extra > 100) break;
  }
  return shuffle([...options]);
}

// =================================================================
// 智能难度（smartDifficulty）—— 纯函数
// =================================================================
function emptySmartStat(): SmartStat {
  return {
    recentResults: [],
    totalAttempts: 0,
    totalCorrect: 0,
    totalTimeout: 0,
    avgResponseMs: 0,
    accuracyRate: 0,
    trendDirection: 'stable',
    dynamicTimeoutMs: null,
    suggestion: null,
  };
}

export function getOrInitSmart(smartStats: SmartStats, levelId: number): SmartStats {
  if (smartStats.byLevel[levelId]) return smartStats;
  const next = clone(smartStats);
  next.byLevel[levelId] = emptySmartStat();
  return next;
}

function recalcStats(stats: SmartStat, levelId: number): SmartStat {
  const recent = stats.recentResults;
  if (recent.length < 5) return stats;

  const avgMs = Math.round(recent.reduce((s, r) => s + r.responseMs, 0) / recent.length);
  const accuracy = recent.filter((r) => r.correct).length / recent.length;

  const next: SmartStat = { ...stats, avgResponseMs: avgMs, accuracyRate: accuracy };

  if (recent.length >= 10) {
    const recent10 = recent.slice(-10);
    const prev10 = recent.slice(-20, -10);
    const rAvg = recent10.reduce((s, r) => s + r.responseMs, 0) / 10;
    const pAvg = prev10.reduce((s, r) => s + r.responseMs, 0) / 10;
    if (rAvg < pAvg * 0.9 && accuracy >= 0.8) next.trendDirection = 'improving';
    else if (rAvg > pAvg * 1.1 || accuracy < 0.6) next.trendDirection = 'declining';
    else next.trendDirection = 'stable';
  }

  const config = getLevel(levelId);
  const baseTimeout = (config ? config.timeoutSec : 10) * 1000;

  if (accuracy >= 0.9 && next.avgResponseMs < baseTimeout * 0.6) {
    next.dynamicTimeoutMs = Math.max(3000, Math.round(baseTimeout * 0.75));
    next.suggestion = null;
  } else if (accuracy < 0.6 && next.totalAttempts >= 10) {
    next.dynamicTimeoutMs = Math.min(30000, Math.round(baseTimeout * 1.4));
    next.suggestion = 'easier';
  } else if (accuracy >= 0.95 && next.trendDirection === 'improving' && next.totalAttempts >= 20) {
    next.dynamicTimeoutMs = Math.max(3000, Math.round(baseTimeout * 0.7));
    next.suggestion = 'harder';
  } else {
    next.dynamicTimeoutMs = baseTimeout;
    next.suggestion = null;
  }
  return next;
}

export function recordAttempt(
  smartStats: SmartStats,
  levelId: number,
  correct: boolean,
  responseMs: number,
  timeouted: boolean,
): SmartStats {
  let stats = getOrInitSmart(smartStats, levelId);
  const s = clone(stats.byLevel[levelId]);
  s.totalAttempts++;
  if (correct) s.totalCorrect++;
  if (timeouted) s.totalTimeout++;
  s.recentResults.push({ timestamp: Date.now(), correct, responseMs, timeouted });
  if (s.recentResults.length > 30) s.recentResults.shift();
  const recalced = recalcStats(s, levelId);
  const next = clone(stats);
  next.byLevel[levelId] = recalced;
  return next;
}

export function getTimeoutMs(smartStats: SmartStats, levelId: number): number {
  const stats = smartStats.byLevel[levelId];
  if (stats?.dynamicTimeoutMs) return stats.dynamicTimeoutMs;
  const config = getLevel(levelId);
  return (config ? config.timeoutSec : 10) * 1000;
}

export function getSmartLabel(smartStats: SmartStats, levelId: number): string {
  const stats = smartStats.byLevel[levelId];
  if (!stats) return '';
  if (stats.suggestion === 'easier') return '💪 需要更多练习';
  if (stats.suggestion === 'harder') return '⚡ 可以挑战更难关卡';
  if (stats.trendDirection === 'improving') return '📈 进步中！';
  if (stats.trendDirection === 'declining') return '💪 加油~';
  return '';
}

// =================================================================
// 精熟判定 + 错集（mastery）—— 纯函数
// =================================================================
function emptyLevelMastery(): LevelMastery {
  return { questions: {}, stats: { mastered: 0, pending: 0, sessionAttempted: 0 } };
}

function ensureLevel(mastery: Mastery, levelId: number): Mastery {
  if (mastery.byLevel[levelId]) return mastery;
  const next = clone(mastery);
  next.byLevel[levelId] = emptyLevelMastery();
  return next;
}

export function isInCooldown(mastery: Mastery, levelId: number, expr: string): boolean {
  const q = mastery.byLevel[levelId]?.questions[expr];
  if (!q?.cooldownUntil) return false;
  return Date.now() < q.cooldownUntil;
}

/** 错题：进度清零，进入错集，连错过多触发冷却 */
export function markError(
  mastery: Mastery,
  errorSets: ErrorSets,
  settings: { requiredCorrect: number; cooldownMinutes: number; cooldownThreshold: number },
  levelId: number,
  expr: string,
  reason: 'wrong' | 'timeout',
): { mastery: Mastery; errorSets: ErrorSets } {
  let m = ensureLevel(mastery, levelId);
  const level = clone(m.byLevel[levelId]);
  let es = clone(errorSets);
  if (!es.byLevel[levelId]) es.byLevel[levelId] = [];

  const existing = level.questions[expr];
  if (existing?.status === 'mastered') {
    level.stats.mastered = Math.max(0, (level.stats.mastered || 0) - 1);
  }

  level.questions[expr] = {
    status: 'learning',
    correctCount: 0,
    errorCount: (existing?.errorCount || 0) + 1,
    attempts: (existing?.attempts || 0) + 1,
    timeoutCount: (existing?.timeoutCount || 0) + (reason === 'timeout' ? 1 : 0),
    hintPending: true,
    lastErrorAt: Date.now(),
    cooldownUntil: existing?.cooldownUntil || null,
  };
  if (!es.byLevel[levelId].includes(expr)) es.byLevel[levelId].push(expr);

  if (level.questions[expr].errorCount >= settings.cooldownThreshold) {
    const q = level.questions[expr];
    q.cooldownUntil = Date.now() + settings.cooldownMinutes * 60 * 1000;
    q.errorCount = 0;
    es.byLevel[levelId] = es.byLevel[levelId].filter((e) => e !== expr);
    level.stats.pending = Math.max(0, (level.stats.pending || 0) - 1);
  }

  const out = clone(m);
  out.byLevel[levelId] = level;
  const outEs = clone(es);
  return { mastery: out, errorSets: outEs };
}

/** 答对：连对计数 +1，达到 requiredCorrect 即 mastered，移出错集 */
export function markMastered(
  mastery: Mastery,
  errorSets: ErrorSets,
  settings: { requiredCorrect: number },
  levelId: number,
  expr: string,
): { mastery: Mastery; errorSets: ErrorSets } {
  let m = ensureLevel(mastery, levelId);
  const level = clone(m.byLevel[levelId]);
  let es = clone(errorSets);
  if (!es.byLevel[levelId]) es.byLevel[levelId] = [];

  const existing = level.questions[expr];
  const correctCount = (existing?.correctCount || 0) + 1;
  const nowMastered = correctCount >= settings.requiredCorrect;

  level.questions[expr] = {
    status: nowMastered ? 'mastered' : 'learning',
    correctCount,
    attempts: (existing?.attempts || 0) + 1,
    errorCount: existing?.errorCount || 0,
    timeoutCount: existing?.timeoutCount || 0,
    hintPending: false,
    lastCorrectAt: Date.now(),
  };

  if (nowMastered) {
    if (existing?.status !== 'mastered') {
      level.stats.mastered = (level.stats.mastered || 0) + 1;
    }
    es.byLevel[levelId] = es.byLevel[levelId].filter((e) => e !== expr);
    level.questions[expr].cooldownUntil = null;
  } else {
    if (!es.byLevel[levelId].includes(expr)) es.byLevel[levelId].push(expr);
  }

  const out = clone(m);
  out.byLevel[levelId] = level;
  const outEs = clone(es);
  return { mastery: out, errorSets: outEs };
}

function emptyLevelProgress(): Progress['levels'][number] {
  return { unlocked: false, passed: false, passedAt: null, totalShown: 0, totalCorrect: 0, firstCorrectRate: 0, currentSession: 0 };
}

export function updateShown(progress: Progress, levelId: number): Progress {
  const next = clone(progress);
  if (!next.levels[levelId]) next.levels[levelId] = emptyLevelProgress();
  next.levels[levelId].totalShown = (next.levels[levelId].totalShown || 0) + 1;
  next.levels[levelId].currentSession = (next.levels[levelId].currentSession || 0) + 1;
  return next;
}

export function updateProgress(progress: Progress, levelId: number): Progress {
  const next = clone(progress);
  if (!next.levels[levelId]) next.levels[levelId] = emptyLevelProgress();
  next.levels[levelId].totalCorrect = (next.levels[levelId].totalCorrect || 0) + 1;
  next.levels[levelId].firstCorrectRate =
    next.levels[levelId].totalShown > 0 ? next.levels[levelId].totalCorrect / next.levels[levelId].totalShown : 0;
  return next;
}

/** 关卡是否通过：错集为空 且 (覆盖集全掌握 | 综合关至少 30 道已掌握) */
export function checkLevelPassed(mastery: Mastery, errorSets: ErrorSets, levelId: number): boolean {
  const config = getLevel(levelId);
  const es = errorSets.byLevel[levelId];
  const noErrors = !(es && es.length > 0);
  if (!noErrors) return false;

  if (config?.coverageSet && config.coverageSet.length > 0) {
    const m = mastery.byLevel[levelId];
    return config.coverageSet.every((expr) => m?.questions?.[expr]?.status === 'mastered');
  }
  const masteredCount = mastery.byLevel[levelId]?.stats?.mastered || 0;
  return masteredCount >= 30;
}

export function getMasteredInCoverage(mastery: Mastery, levelId: number): number {
  const config = getLevel(levelId);
  const m = mastery.byLevel[levelId];
  if (!m?.questions) return 0;
  if (!config?.coverageSet) return m.stats?.mastered || 0;
  return config.coverageSet.filter((expr) => m.questions[expr]?.status === 'mastered').length;
}

export function getTotalRequired(levelId: number): number {
  const config = getLevel(levelId);
  if (config?.coverageSet && config.coverageSet.length > 0) return config.coverageSet.length;
  return 30;
}

/** 标记关卡通过并解锁下一关 */
export function markLevelPassed(progress: Progress, levelId: number): Progress {
  const next = clone(progress);
  if (!next.levels[levelId]) next.levels[levelId] = emptyLevelProgress();
  next.levels[levelId].passed = true;
  next.levels[levelId].passedAt = Date.now();
  if (next.levels[levelId + 1]) next.levels[levelId + 1].unlocked = true;
  return next;
}

export function resetLevel(
  mastery: Mastery,
  errorSets: ErrorSets,
  progress: Progress,
  levelId: number,
): { mastery: Mastery; errorSets: ErrorSets; progress: Progress } {
  const m = clone(mastery);
  delete m.byLevel[levelId];
  const es = clone(errorSets);
  delete es.byLevel[levelId];
  const p = clone(progress);
  if (p.levels[levelId]) {
    p.levels[levelId] = { ...emptyLevelProgress(), unlocked: isUnlockedForReset(p, levelId) };
    for (let i = levelId + 1; i <= 12; i++) {
      if (p.levels[i]) {
        p.levels[i].unlocked = false;
        p.levels[i].passed = false;
      }
    }
  }
  return { mastery: m, errorSets: es, progress: p };
}

function isUnlockedForReset(progress: Progress, levelId: number): boolean {
  if (levelId === 1) return true;
  const prev = progress.levels[levelId - 1];
  return Boolean(prev && prev.passed);
}
