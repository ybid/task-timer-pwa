// 家长面板：聚合「任务系统（主）」与「口算训练（子系统）」的统计
import { useEffect, useState } from 'react';
import { getLevel } from '../logic/levels';
import { formatExprForDisplay, formatDate } from '../logic/utils';
import { buildWeeklyReport, getTrend, getWeakItems } from '../logic/weakness';
import type { EntitiesState } from '../store/useHaoxueStore';
import {
  getPlans,
  getTasksByPlan,
  getDailyRecordsByDateRange,
  getTimeRecordsByDate,
} from '../../db';

interface Props {
  entities: EntitiesState;
  onStartLevel: (levelId: number) => void;
  onBack: () => void;
}

type Range = 7 | 14 | 30 | 'all';
const RANGES: { value: Range; label: string }[] = [
  { value: 7, label: '7天' },
  { value: 14, label: '14天' },
  { value: 30, label: '30天' },
  { value: 'all', label: '全部' },
];

interface MainStats {
  plans: number;
  tasks: number;
  completions: number;
  todayCompletions: number;
  todayMs: number;
}

function MainCard({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-gray-200 text-center">
      <div className="text-xl font-bold text-gray-800 tabular-nums">
        {value}
        {suffix && <span className="text-xs font-normal text-gray-400 ml-0.5">{suffix}</span>}
      </div>
      <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

function TrendChart({ data }: { data: { accuracy: number; date: string }[] }) {
  const W = 320;
  const H = 130;
  const pad = 18;
  const n = data.length;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / Math.max(1, n - 1);
  const y = (a: number) => H - pad - a * (H - 2 * pad);
  const pts = data.map((d, i) => `${x(i)},${y(d.accuracy)}`).join(' ');
  const lastIdx = Math.max(0, n - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="正确率趋势">
      {/* 网格线 */}
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={pad} y1={y(g)} x2={W - pad} y2={y(g)} stroke="#e5e7eb" strokeWidth={1} />
          <text x={2} y={y(g) + 4} fontSize={9} fill="#9ca3af">
            {Math.round(g * 100)}%
          </text>
        </g>
      ))}
      {/* 折线 */}
      <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" />
      {/* 末点高亮 */}
      <circle cx={x(lastIdx)} cy={y(data[lastIdx].accuracy)} r={3} fill="#2563eb" />
    </svg>
  );
}

export function ParentPanel({ entities, onStartLevel, onBack }: Props) {
  const [range, setRange] = useState<Range>(14);
  const weak = getWeakItems(entities.mastery, entities.errorSets, 8);
  const dateCount = Object.keys(entities.daily.byDate).length;
  const trendDays = range === 'all' ? Math.max(14, dateCount) : range;
  const trend = getTrend(entities.daily, trendDays);
  const reportDays = range === 'all' ? Math.min(90, Math.max(7, dateCount)) : range;
  const report = buildWeeklyReport(entities.daily, entities.profile, entities.progress, reportDays);

  // 聚合主系统（任务）数据
  const [main, setMain] = useState<MainStats | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const plans = await getPlans();
      let tasks = 0;
      for (const p of plans) tasks += (await getTasksByPlan(p.id)).length;
      const today = formatDate(Date.now());
      const recs = await getDailyRecordsByDateRange('2000-01-01', today);
      let completions = 0;
      let todayCompletions = 0;
      for (const r of recs) {
        completions += r.completedCount ?? 0;
        if (r.date === today) todayCompletions += r.completedCount ?? 0;
      }
      const timeRecs = await getTimeRecordsByDate(today);
      const todayMs = timeRecs.reduce((s, r) => s + (r.duration ?? 0), 0);
      if (alive) setMain({ plans: plans.length, tasks, completions, todayCompletions, todayMs });
    })();
    return () => {
      alive = false;
    };
  }, []);

  const exportCsv = () => {
    const blob = new Blob([report.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `口算周报_${report.start}_${report.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const avgAccuracy =
    trend.reduce((s, d) => s + d.accuracy, 0) / Math.max(1, trend.length);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button onClick={onBack} className="min-h-[40px] px-2 rounded-xl text-gray-500 active:bg-gray-100 text-sm">
          ‹ 返回
        </button>
        <div className="text-subhead font-semibold text-gray-800">家长面板</div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
        {/* 任务进度（主系统） */}
        <section>
          <div className="text-xs text-gray-400 mb-2 px-1">任务进度（主系统）</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MainCard label="计划" value={main ? main.plans : '—'} />
            <MainCard label="任务" value={main ? main.tasks : '—'} />
            <MainCard label="累计完成" value={main ? main.completions : '—'} suffix="次" />
            <MainCard label="今日完成" value={main ? main.todayCompletions : '—'} suffix="次" />
            <MainCard
              label="今日计时"
              value={main ? Math.floor(main.todayMs / 60) : '—'}
              suffix="分"
            />
          </div>
        </section>

        {/* 口算训练（子系统） */}
        <div className="text-xs text-gray-400 px-1 pt-1">口算训练（子系统）</div>

        {/* 时间范围筛选（作用于趋势图与周报） */}
        <div className="flex items-center gap-1 bg-white rounded-2xl p-1 border border-gray-200">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`flex-1 min-h-[36px] rounded-xl text-xs font-medium transition-colors ${
                range === r.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 active:bg-gray-100'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">
              正确率趋势（近 {range === 'all' ? '全部' : `${range} 天`}）
            </div>
            <div className="text-xs text-gray-400">均值 {Math.round(avgAccuracy * 100)}%</div>
          </div>
          <TrendChart data={trend} />
        </div>

        {/* 弱项分析 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200">
          <div className="text-sm font-semibold text-gray-700 mb-3">弱项分析</div>
          {weak.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">暂无薄弱算式，保持得很好！🎉</div>
          ) : (
            <div className="space-y-2">
              {weak.map((w) => {
                const lv = getLevel(w.levelId);
                return (
                  <div key={`${w.levelId}:${w.expr}`} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-base font-bold text-gray-800 tabular-nums">
                        {formatExprForDisplay(w.expr)}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {lv?.name ?? `关卡${w.levelId}`}
                        {w.inErrorSet && ' · 错集中'}
                        {w.timeoutCount > 0 && ` · 超时${w.timeoutCount}次`}
                      </div>
                    </div>
                    <div className="text-xs text-red-500 font-semibold tabular-nums">错{w.errorCount}</div>
                    <button
                      onClick={() => onStartLevel(w.levelId)}
                      className="min-h-[36px] px-3 rounded-xl bg-blue-600 text-white text-xs font-medium active:scale-95"
                    >
                      去练习
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 周报导出 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200">
          <div className="text-sm font-semibold text-gray-700 mb-1">每周报告</div>
          <div className="text-[11px] text-gray-400 mb-3">
            {report.start} ~ {report.end}
          </div>
          <button
            onClick={exportCsv}
            className="w-full min-h-[48px] bg-gray-100 text-gray-700 rounded-2xl text-sm font-medium active:bg-gray-200 transition-colors"
          >
            导出报告 CSV
          </button>
        </div>
      </div>
    </div>
  );
}
