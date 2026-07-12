// 口算训练统计 / 连续天数 / 每日任务 / XP 等级（纯函数，契合 React 状态模型）
import type { Daily, Progress } from '../types';
import { formatDate } from './utils';

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

// =================================================================
// 每日统计（Daily）—— 用于连续天数与每日任务
// =================================================================
export function bumpDaily(daily: Daily, date: string, isCorrect: boolean): Daily {
  const next = clone(daily);
  const cur =
    next.byDate[date] ?? { activeMs: 0, sessions: 0, questions: 0, firstCorrect: 0 };
  cur.questions += 1;
  if (isCorrect) cur.firstCorrect += 1;
  next.byDate[date] = cur;
  return next;
}

export function bumpDailySession(daily: Daily, date: string, activeMs: number): Daily {
  const next = clone(daily);
  const cur =
    next.byDate[date] ?? { activeMs: 0, sessions: 0, questions: 0, firstCorrect: 0 };
  cur.sessions += 1;
  cur.activeMs += activeMs;
  next.byDate[date] = cur;
  return next;
}

// =================================================================
// 连续训练天数（从今天往前数，直到某天无练习记录）
// =================================================================
export function computeStreak(daily: Daily, from = Date.now()): number {
  let streak = 0;
  const d = new Date(from);
  // 限制最多回看 366 天，避免极端情况下死循环
  for (let i = 0; i < 366; i++) {
    const key = formatDate(d.getTime());
    const stat = daily.byDate[key];
    if (stat && stat.questions > 0) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// =================================================================
// XP 等级
// =================================================================
export interface XpLevel {
  level: number;
  title: string;
  into: number; // 当前等级已积累 XP
  need: number; // 升下一级所需 XP
}

const XP_TITLES = ['新手', '学徒', '能手', '高手', '大师', '宗师', '传奇'];
const XP_PER_LEVEL = 100;

export function getXpLevel(xp: number): XpLevel {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const title = XP_TITLES[Math.min(level - 1, XP_TITLES.length - 1)];
  const into = xp % XP_PER_LEVEL;
  return { level, title, into, need: XP_PER_LEVEL };
}

// =================================================================
// 每日任务（按日期确定性生成 3 个任务，进度实时计算）
// =================================================================
export interface DailyTask {
  id: string;
  label: string;
  current: number;
  goal: number;
  done: boolean;
}

// 每日目标题数随星期轮换，避免单调
const DAILY_GOAL_BY_WDAY = [20, 30, 25, 40, 30, 20, 15];

function countPassedToday(progress: Progress, date: string): number {
  let n = 0;
  for (const lv of Object.values(progress.levels)) {
    if (lv.passed && lv.passedAt) {
      if (formatDate(lv.passedAt) === date) n += 1;
    }
  }
  return n;
}

export function getDailyTasks(date: string, daily: Daily, progress: Progress): DailyTask[] {
  const wday = new Date(date).getDay();
  const goalQuestions = DAILY_GOAL_BY_WDAY[wday] ?? 20;
  const todayStat = daily.byDate[date];
  const questions = todayStat?.questions ?? 0;
  const passedToday = countPassedToday(progress, date);
  const streak = computeStreak(daily, Date.now());

  return [
    {
      id: 'questions',
      label: `今日完成 ${goalQuestions} 道题`,
      current: questions,
      goal: goalQuestions,
      done: questions >= goalQuestions,
    },
    {
      id: 'passLevel',
      label: '今日通关 1 个关卡',
      current: passedToday,
      goal: 1,
      done: passedToday >= 1,
    },
    {
      id: 'streak',
      label: '连续训练 3 天',
      current: streak,
      goal: 3,
      done: streak >= 3,
    },
  ];
}
