// 家长面板逻辑：弱项分析 / 趋势数据 / 周报 CSV（纯函数）
import type { Daily, ErrorSets, Mastery, ProfileData, Progress } from '../types';
import { formatDate } from './utils';

// =================================================================
// 弱项分析：汇总所有关卡中仍有错误/超时的算式，按严重程度排序
// =================================================================
export interface WeakItem {
  levelId: number;
  expr: string;
  errorCount: number;
  timeoutCount: number;
  inErrorSet: boolean;
  cooldownUntil: number | null;
}

export function getWeakItems(mastery: Mastery, errorSets: ErrorSets, limit = 8): WeakItem[] {
  const items: WeakItem[] = [];
  for (const [lid, level] of Object.entries(mastery.byLevel)) {
    const levelId = Number(lid);
    const es = errorSets.byLevel[levelId] ?? [];
    for (const [expr, q] of Object.entries(level.questions)) {
      if (q.errorCount > 0 || es.includes(expr) || q.cooldownUntil || q.timeoutCount > 0) {
        items.push({
          levelId,
          expr,
          errorCount: q.errorCount || 0,
          timeoutCount: q.timeoutCount || 0,
          inErrorSet: es.includes(expr),
          cooldownUntil: q.cooldownUntil ?? null,
        });
      }
    }
  }
  items.sort((a, b) => b.errorCount + b.timeoutCount * 2 - (a.errorCount + a.timeoutCount * 2));
  return items.slice(0, limit);
}

// =================================================================
// 趋势数据：最近 days 天每日正确率
// =================================================================
export interface TrendPoint {
  date: string;
  accuracy: number; // 0~1
  questions: number;
}

export function getTrend(daily: Daily, days = 14): TrendPoint[] {
  const out: TrendPoint[] = [];
  const d = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    const key = formatDate(dd.getTime());
    const stat = daily.byDate[key];
    const questions = stat?.questions ?? 0;
    const accuracy = questions > 0 && stat ? (stat.firstCorrect ?? 0) / questions : 0;
    out.push({ date: key, accuracy, questions });
  }
  return out;
}

// =================================================================
// 周报 CSV：最近 days 天每日统计 + 合计行（days=7 时按本周一~周日）
// =================================================================
export interface WeeklyReport {
  csv: string;
  start: string;
  end: string;
}

export function buildWeeklyReport(
  daily: Daily,
  _profile: ProfileData,
  _progress: Progress,
  days = 7,
): WeeklyReport {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(now);
  if (days === 7) {
    // 本周一 ~ 周日
    const day = now.getDay(); // 0=周日
    const diffToMon = day === 0 ? -6 : 1 - day;
    start.setDate(now.getDate() + diffToMon);
  } else {
    // 最近 N 天（含今天）
    start.setDate(now.getDate() - (days - 1));
  }

  const rows: { date: string; questions: number; firstCorrect: number; sessions: number; activeMs: number }[] = [];
  for (let i = 0; i < days; i++) {
    const dd = new Date(start);
    dd.setDate(start.getDate() + i);
    const key = formatDate(dd.getTime());
    const s = daily.byDate[key];
    rows.push({
      date: key,
      questions: s?.questions ?? 0,
      firstCorrect: s?.firstCorrect ?? 0,
      sessions: s?.sessions ?? 0,
      activeMs: s?.activeMs ?? 0,
    });
  }

  const header = '日期,做题数,首次正确,正确率,会话数,练习时长(秒)';
  const lines = rows.map((r) => {
    const acc = r.questions > 0 ? Math.round((r.firstCorrect / r.questions) * 100) : 0;
    return `${r.date},${r.questions},${r.firstCorrect},${acc}%,${r.sessions},${Math.round(r.activeMs / 1000)}`;
  });

  const tQ = rows.reduce((s, r) => s + r.questions, 0);
  const tC = rows.reduce((s, r) => s + r.firstCorrect, 0);
  const tS = rows.reduce((s, r) => s + r.sessions, 0);
  const tMs = rows.reduce((s, r) => s + r.activeMs, 0);
  const tAcc = tQ > 0 ? Math.round((tC / tQ) * 100) : 0;
  const label = days === 7 ? '本周合计' : `近${days}天合计`;
  const summary = `${label},${tQ},${tC},${tAcc}%,${tS},${Math.round(tMs / 1000)}`;

  const csv = [header, ...lines, summary].join('\r\n');
  return {
    csv: '﻿' + csv, // BOM 便于 Excel 正确识别 UTF-8 中文
    start: formatDate(start.getTime()),
    end: formatDate(start.getTime() + (days - 1) * 86400000),
  };
}
