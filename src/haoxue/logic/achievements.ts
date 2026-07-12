// 成就系统：预定义成就目录 + 纯函数 evaluateAchievements（给定上下文判定解锁）
import type { Achievements, Achievement, Daily, Mastery, Progress, ProfileData } from '../types';

interface AchievementCtx {
  xp: number;
  maxCombo: number;
  totalQuestions: number;
  totalMastered: number;
  passedCount: number;
  streakBest: number;
}

interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  check: (ctx: AchievementCtx) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'combo10', name: '连击达人', icon: '🔥', desc: '连续答对 10 题', check: (c) => c.maxCombo >= 10 },
  { id: 'combo20', name: '连击大师', icon: '🌟', desc: '连续答对 20 题', check: (c) => c.maxCombo >= 20 },
  { id: 'questions100', name: '百题斩', icon: '💯', desc: '累计完成 100 题', check: (c) => c.totalQuestions >= 100 },
  { id: 'questions500', name: '五百强', icon: '🏅', desc: '累计完成 500 题', check: (c) => c.totalQuestions >= 500 },
  {
    id: 'mastered100',
    name: '熟能生巧',
    icon: '🎯',
    desc: '累计掌握 100 道算式',
    check: (c) => c.totalMastered >= 100,
  },
  { id: 'streak7', name: '坚持不懈', icon: '📅', desc: '连续训练 7 天', check: (c) => c.streakBest >= 7 },
  { id: 'levels_all', name: '通关王者', icon: '👑', desc: '通过全部 12 关', check: (c) => c.passedCount >= 12 },
];

function buildCtx(
  profile: ProfileData,
  progress: Progress,
  daily: Daily,
  mastery: Mastery,
): AchievementCtx {
  const totalQuestions = Object.values(daily.byDate).reduce((s, d) => s + (d.questions || 0), 0);
  const totalMastered = Object.values(mastery.byLevel).reduce(
    (s, l) => s + (l.stats?.mastered || 0),
    0,
  );
  const passedCount = Object.values(progress.levels).filter((l) => l.passed).length;
  return {
    xp: profile.xp,
    maxCombo: profile.maxCombo,
    totalQuestions,
    totalMastered,
    passedCount,
    streakBest: profile.streakBest,
  };
}

export function evaluateAchievements(
  profile: ProfileData,
  progress: Progress,
  daily: Daily,
  mastery: Mastery,
  current: Achievements,
): { next: Achievements; unlockedNow: Achievement[] } {
  const ctx = buildCtx(profile, progress, daily, mastery);
  const existing = new Set(current.unlocked.map((a) => a.id));
  const unlocked = [...current.unlocked];
  const unlockedNow: Achievement[] = [];

  for (const def of ACHIEVEMENTS) {
    if (!existing.has(def.id) && def.check(ctx)) {
      const a: Achievement = {
        id: def.id,
        name: def.name,
        icon: def.icon,
        desc: def.desc,
        unlockedAt: Date.now(),
        seen: false,
      };
      unlocked.push(a);
      unlockedNow.push(a);
    }
  }

  const next: Achievements = {
    schemaVer: current.schemaVer,
    unlocked,
    totalUnlocked: unlocked.length,
  };
  return { next, unlockedNow };
}

export function achievementsProgress(current: Achievements): { unlocked: number; total: number } {
  return { unlocked: current.unlocked.length, total: ACHIEVEMENTS.length };
}
