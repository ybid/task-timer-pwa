// 首页：欢迎 / 游戏化概览 / 今日任务 / 连续日历 / 成就 / 快速开始 / 关卡入口
import { LEVELS, isUnlocked } from '../logic/levels';
import type { EntitiesState } from '../store/useHaoxueStore';
import { formatDate } from '../logic/utils';
import { computeStreak, getDailyTasks, getXpLevel } from '../logic/stats';
import { achievementsProgress } from '../logic/achievements';

interface Props {
  entities: EntitiesState;
  username: string | null;
  onStartLevel: (levelId: number) => void;
  onOpenLevels: () => void;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-gray-200 text-center">
      <div className="text-2xl font-bold text-blue-600 tabular-nums">{value}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

export function Home({ entities, username, onStartLevel, onOpenLevels }: Props) {
  const today = formatDate(Date.now());
  const dayStat = entities.daily.byDate[today];
  const nextLevel =
    LEVELS.find((lv) => isUnlocked(lv.id, entities.progress) && !entities.progress.levels[lv.id]?.passed) ||
    LEVELS[0];
  const totalMastered = LEVELS.reduce(
    (s, lv) => s + (entities.mastery.byLevel[lv.id]?.stats?.mastered ?? 0),
    0,
  );
  const passedCount = LEVELS.filter((lv) => entities.progress.levels[lv.id]?.passed).length;

  // ---- 游戏化 ----
  const xp = getXpLevel(entities.profile.xp);
  const streak = computeStreak(entities.daily);
  const tasks = getDailyTasks(today, entities.daily, entities.progress);
  const ach = achievementsProgress(entities.achievements);

  // 连续日历：今天往前 7 天
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = formatDate(d.getTime());
    const stat = entities.daily.byDate[key];
    return { key, wday: d.getDay(), done: !!(stat && stat.questions > 0) };
  });
  const WDOW_LABEL = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl p-5 border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="text-4xl">🧮</div>
          <div>
            <div className="text-heading font-semibold text-gray-800">
              {username ?? '你'} 的口算训练
            </div>
            <div className="text-sm text-gray-400 mt-0.5">
              今日练习 {dayStat?.questions ?? 0} 题
            </div>
          </div>
        </div>
      </div>

      {/* 游戏化概览：XP 等级 + 连续天数 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-80">
              Lv.{xp.level} · {xp.title}
            </div>
            <div className="text-2xl font-bold tabular-nums">{entities.profile.xp} XP</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80">连续训练</div>
            <div className="text-2xl font-bold tabular-nums">🔥 {streak} 天</div>
          </div>
        </div>
        <div className="mt-3 h-2 bg-white/25 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full" style={{ width: `${(xp.into / xp.need) * 100}%` }} />
        </div>
        <div className="text-[11px] opacity-80 mt-1">距下一级还需 {xp.need - xp.into} XP</div>
      </div>

      {/* 连续日历 */}
      <div className="bg-white rounded-2xl p-3 border border-gray-200">
        <div className="text-[11px] text-gray-400 mb-2">最近 7 天</div>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d) => (
            <div key={d.key} className="flex flex-col items-center gap-1">
              <div
                className={`w-full aspect-square rounded-lg flex items-center justify-center text-sm ${
                  d.done ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-300'
                }`}
              >
                {d.done ? '✓' : ''}
              </div>
              <div className="text-[10px] text-gray-400">{WDOW_LABEL[d.wday]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 每日任务 */}
      <div className="bg-white rounded-2xl p-3 border border-gray-200">
        <div className="text-[11px] text-gray-400 mb-2">今日任务</div>
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                  t.done ? 'bg-green-500 text-white' : 'border-2 border-gray-300 text-gray-400'
                }`}
              >
                {t.done ? '✓' : ''}
              </div>
              <div className="flex-1">
                <div className={`text-sm ${t.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {t.label}
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, (t.current / t.goal) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-[11px] text-gray-400 tabular-nums">
                {Math.min(t.current, t.goal)}/{t.goal}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => onStartLevel(nextLevel.id)}
        className="w-full min-h-[64px] bg-blue-600 text-white rounded-2xl text-lg font-semibold active:scale-95 transition-all"
      >
        开始训练 · {nextLevel.name}
      </button>

      <button
        onClick={onOpenLevels}
        className="w-full min-h-[48px] bg-gray-100 text-gray-700 rounded-2xl text-sm font-medium active:bg-gray-200 transition-colors"
      >
        选择关卡
      </button>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="已掌握" value={totalMastered} />
        <Stat label="通过关卡" value={`${passedCount}/12`} />
        <Stat label="成就" value={`${ach.unlocked}/${ach.total}`} />
      </div>
    </div>
  );
}
