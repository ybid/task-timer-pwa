// 训练会话：出题 / 答题 / 计时 / 即时反馈 / 连击 / 进度回写
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EntitiesState } from '../store/useHaoxueStore';
import {
  checkLevelPassed,
  generate,
  generateByExpr,
  generateOptions,
  getTimeoutMs,
  isInCooldown,
  markError,
  markLevelPassed,
  markMastered,
  recordAttempt,
  updateProgress,
  updateShown,
} from '../logic/engine';
import { getLevel } from '../logic/levels';
import { bumpDaily, bumpDailySession, computeStreak } from '../logic/stats';
import { evaluateAchievements } from '../logic/achievements';
import { formatDate, formatExprForDisplay, pick } from '../logic/utils';
import type { ProfileData, Question, TrainingQuestion } from '../types';

interface Props {
  levelId: number;
  entities: EntitiesState;
  update: <K extends keyof EntitiesState>(key: K, value: EntitiesState[K]) => void;
  onExit: () => void;
}

type Feedback = null | 'correct' | 'wrong' | 'timeout';

export function Training({ levelId, entities, update, onExit }: Props) {
  const config = getLevel(levelId)!;
  const [q, setQ] = useState<TrainingQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [combo, setCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [timeLeft, setTimeLeft] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(Date.now());
  const lockedRef = useRef(false);
  const sessionCountedRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  const nextQuestion = useCallback(() => {
    const es = entities.errorSets.byLevel[levelId] || [];
    const eligible = es.filter((expr) => !isInCooldown(entities.mastery, levelId, expr));
    let question: Question;
    if (eligible.length > 0) {
      question = generateByExpr(pick(eligible), config);
    } else {
      question = generate(config);
    }
    const options = generateOptions(question.answer, question.expr);
    setQ({ question, options, levelId });
    setSelected(null);
    setFeedback(null);
    lockedRef.current = false;
    startRef.current = Date.now();

    const ms = getTimeoutMs(entities.smartStats, levelId);
    setTimeLeft(1);
    if (tickRef.current) clearInterval(tickRef.current);
    const startedAt = Date.now();
    tickRef.current = setInterval(() => {
      const left = 1 - (Date.now() - startedAt) / ms;
      setTimeLeft(left > 0 ? left : 0);
    }, 100);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => handleTimeout(), ms);
  }, [entities, levelId, config]);

  const finish = useCallback(
    (isCorrect: boolean, reason: 'wrong' | 'timeout' | null) => {
      if (lockedRef.current || !q) return;
      lockedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      setTimeLeft(0);

      const expr = q.question.expr;
      const responseMs = Date.now() - startRef.current;

      const smartStats = recordAttempt(
        entities.smartStats,
        levelId,
        isCorrect,
        responseMs,
        reason === 'timeout',
      );
      let mastery = entities.mastery;
      let errorSets = entities.errorSets;
      if (isCorrect) {
        const r = markMastered(mastery, errorSets, { requiredCorrect: entities.settings.requiredCorrect }, levelId, expr);
        mastery = r.mastery;
        errorSets = r.errorSets;
      } else {
        const r = markError(
          mastery,
          errorSets,
          {
            requiredCorrect: entities.settings.requiredCorrect,
            cooldownMinutes: entities.settings.cooldownMinutes,
            cooldownThreshold: entities.settings.cooldownThreshold,
          },
          levelId,
          expr,
          reason === 'timeout' ? 'timeout' : 'wrong',
        );
        mastery = r.mastery;
        errorSets = r.errorSets;
      }

      let progress = updateShown(entities.progress, levelId);
      if (isCorrect) progress = updateProgress(progress, levelId);
      const passed = checkLevelPassed(mastery, errorSets, levelId);
      let justPassed = false;
      if (passed && !progress.levels[levelId]?.passed) {
        progress = markLevelPassed(progress, levelId);
        justPassed = true;
      }

      void update('mastery', mastery);
      void update('errorSets', errorSets);
      void update('progress', progress);
      void update('smartStats', smartStats);

      // ---- 游戏化：XP / 连击 / 每日统计 / 成就 ----
      const today = formatDate(Date.now());
      const comboAfter = isCorrect ? combo + 1 : 0;
      const gained = isCorrect ? 10 + (responseMs < 2000 ? 5 : 0) : 0;
      const dailyBase = sessionCountedRef.current
        ? entities.daily
        : bumpDailySession(entities.daily, today, 0);
      sessionCountedRef.current = true;
      const newDaily = bumpDaily(dailyBase, today, isCorrect);
      const streak = computeStreak(newDaily);
      const newProfile: ProfileData = {
        ...entities.profile,
        xp: entities.profile.xp + gained,
        maxCombo: Math.max(entities.profile.maxCombo, comboAfter),
        streakBest: Math.max(entities.profile.streakBest, streak),
      };
      const { next: newAch, unlockedNow } = evaluateAchievements(
        newProfile,
        progress,
        newDaily,
        mastery,
        entities.achievements,
      );
      void update('daily', newDaily);
      void update('profile', newProfile);
      if (unlockedNow.length > 0) {
        void update('achievements', newAch);
        setToast(`🏆 解锁成就：${unlockedNow.map((a) => a.name).join('、')}`);
        setTimeout(() => setToast(null), 2200);
      }

      setTotal((t) => t + 1);
      if (isCorrect) {
        setCorrect((c) => c + 1);
        setCombo((c) => c + 1);
      } else {
        setCombo(0);
      }
      setFeedback(isCorrect ? 'correct' : reason === 'timeout' ? 'timeout' : 'wrong');

      const delay = justPassed ? 1600 : 900;
      setTimeout(() => {
        if (justPassed) onExit();
        else nextQuestion();
      }, delay);
    },
    [q, entities, levelId, update, onExit, nextQuestion],
  );

  const handleTimeout = useCallback(() => {
    if (lockedRef.current || !q) return;
    finish(false, 'timeout');
  }, [finish, q]);

  const onSelect = (opt: number) => {
    if (lockedRef.current || selected !== null || !q) return;
    setSelected(opt);
    finish(opt === q.question.answer, opt === q.question.answer ? null : 'wrong');
  };

  // 首次进入生成第一题
  useEffect(() => {
    nextQuestion();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passed = entities.progress.levels[levelId]?.passed;
  const masteredCount = entities.mastery.byLevel[levelId]?.stats?.mastered ?? 0;

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* 训练顶栏 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button
          onClick={onExit}
          className="min-h-[40px] px-3 rounded-xl text-gray-500 active:bg-gray-100 text-sm"
        >
          ✕ 退出
        </button>
        <div className="text-center flex-1">
          <div className="text-subhead font-semibold text-gray-800">{config.name}</div>
          <div className="text-[11px] text-gray-400">
            {passed ? '✓ 已通过 · ' : ''}本次 {correct}/{total} · 连击 {combo}
          </div>
        </div>
        <div className="text-xs text-gray-400 w-12 text-right">已掌握 {masteredCount}</div>
      </div>

      {/* 计时条 */}
      <div className="h-1.5 bg-gray-200">
        <div
          className={`h-full transition-[width] duration-100 ${timeLeft < 0.3 ? 'bg-red-500' : 'bg-blue-600'}`}
          style={{ width: `${timeLeft * 100}%` }}
        />
      </div>

      {/* 题目区 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        {q && (
          <div
            className={`text-5xl font-bold text-gray-800 tabular-nums ${
              feedback === 'correct' ? 'text-green-600' : feedback ? 'text-red-600' : ''
            }`}
          >
            {formatExprForDisplay(q.question.expr)} = ?
          </div>
        )}

        {/* 选项（仅通过颜色变化反馈对错，不展示成功/失败文字提示，避免页面晃动） */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          {q?.options.map((opt, i) => {
            const isCorrectOpt = q.question.answer === opt;
            const isPicked = selected === opt;
            let cls = 'bg-white border-gray-200 text-gray-800 hover:bg-blue-50';
            if (feedback && isCorrectOpt) cls = 'bg-green-500 border-green-500 text-white';
            else if (feedback && isPicked) cls = 'bg-red-500 border-red-500 text-white';
            return (
              <button
                key={i}
                onClick={() => onSelect(opt)}
                disabled={selected !== null}
                className={`min-h-[72px] rounded-2xl border-2 text-3xl font-bold active:scale-95 transition-all ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* 成就解锁提示 */}
      {toast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-yellow-500 text-white text-sm font-semibold shadow-lg animate-fade-in">
            {toast}
          </div>
      )}
    </div>
  );
}
