import React, { useState, useEffect, useRef } from 'react';
import { addTimeRecord, getTimeRecordsByTask, saveTimerDraft, clearTimerDraft, formatDate } from '../db';
import { TimeRecord } from '../types';
import { uuid } from '../utils/uuid';

interface TimerProps {
  taskId: string;
  taskName: string;
  date: string;
  /** ISO start time to resume from (skips the countdown). */
  initialStartTime?: string;
  onClose: () => void;
  onEnd?: (taskId: string, startTime: Date, endTime: Date) => void;
}

export const Timer: React.FC<TimerProps> = ({
  taskId,
  taskName,
  date,
  initialStartTime,
  onClose,
  onEnd,
}) => {
  const [isRunning, setIsRunning] = useState(Boolean(initialStartTime));
  const [startTime, setStartTime] = useState<Date | null>(initialStartTime ? new Date(initialStartTime) : null);
  const [elapsed, setElapsed] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [weekTotal, setWeekTotal] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [showCountdown, setShowCountdown] = useState(!initialStartTime);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(startTime);
  startTimeRef.current = startTime;

  /* Countdown 3-2-1 */
  useEffect(() => {
    if (!showCountdown) return;
    if (countdown <= 0) {
      const start = new Date();
      setStartTime(start);
      setIsRunning(true);
      setShowCountdown(false);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [countdown, showCountdown]);

  useEffect(() => {
    if (!isRunning || !startTime) return;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, startTime]);

  /* Persist an in-progress timer so a refresh / close can resume it. */
  const persistDraft = () => {
    const st = startTimeRef.current;
    if (!st) return;
    saveTimerDraft({
      id: 'current',
      taskId,
      taskName,
      date,
      startTime: st.toISOString(),
      elapsed: 0,
      updatedAt: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (!isRunning || !startTime) return;
    const id = setInterval(persistDraft, 5000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') persistDraft();
    };
    const onBeforeUnload = () => persistDraft();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, startTime]);

  /* Load stats — scoped to today and this week (C7 fix) */
  useEffect(() => {
    (async () => {
      const all = await getTimeRecordsByTask(taskId);
      const today = formatDate(new Date());
      const todaySum = all.filter((r) => r.date === today).reduce((s, r) => s + r.duration, 0);
      setTodayTotal(todaySum);

      // This week: Monday 00:00 -> now
      const now = new Date();
      const dow = (now.getDay() + 6) % 7; // 0 = Monday
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dow);
      weekStart.setHours(0, 0, 0, 0);
      const weekSum = all
        .filter((r) => new Date(r.startTime) >= weekStart)
        .reduce((s, r) => s + r.duration, 0);
      setWeekTotal(weekSum);
    })();
  }, [taskId]);

  /* ─── controls ─── */
  const handlePause = () => {
    persistDraft();
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleResume = () => {
    if (!startTime) return;
    setIsRunning(true);
  };

  const finish = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const st = startTimeRef.current;
    if (st) {
      const end = new Date();
      const dur = Math.floor((Date.now() - st.getTime()) / 1000);
      setElapsed(dur);
      const record: Omit<TimeRecord, 'updatedAt' | 'deletedAt'> = {
        id: uuid(),
        taskId,
        startTime: st.toISOString(),
        endTime: end.toISOString(),
        duration: dur,
        date: end.toISOString().split('T')[0],
      };
      await addTimeRecord(record);
      try {
        navigator.vibrate?.(200);
      } catch {
        /* ignore */
      }
      if (onEnd) await onEnd(taskId, st, end);
    }
    await clearTimerDraft();
    onClose();
  };

  const handleCancel = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    await clearTimerDraft();
    onClose();
  };

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  /* ─── countdown screen ─── */
  if (showCountdown) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-indigo-900"
        style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
        <h2 className="text-white/60 text-lg font-medium mb-8">{taskName}</h2>
        <div className="text-white text-[120px] font-bold tabular-nums leading-none animate-pulse-subtle">
          {countdown}
        </div>
        <p className="text-white/40 text-sm mt-8">准备开始...</p>
        <button
          onClick={handleCancel}
          className="mt-10 px-6 py-3 rounded-xl bg-white/10 text-white/80 text-sm font-medium active:bg-white/20 transition-colors"
          aria-label="取消计时"
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-900 to-gray-900"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>
      <p className="text-indigo-200/60 text-sm mb-2 tracking-wide">{taskName}</p>
      <div className={`text-white text-[80px] md:text-[100px] font-bold tabular-nums leading-none mb-10 ${isRunning ? 'animate-pulse-subtle' : ''}`}>
        {fmt(elapsed)}
      </div>

      <div className="flex gap-6 mb-12">
        <div className="text-center">
          <div className="text-indigo-200/80 text-2xl font-semibold tabular-nums">{Math.floor(todayTotal / 60)}</div>
          <div className="text-indigo-300/50 text-xs mt-1">今日累计(分钟)</div>
        </div>
        <div className="w-px bg-indigo-500/20" />
        <div className="text-center">
          <div className="text-indigo-200/80 text-2xl font-semibold tabular-nums">{Math.floor(weekTotal / 60)}</div>
          <div className="text-indigo-300/50 text-xs mt-1">本周累计(分钟)</div>
        </div>
      </div>

      <div className="flex gap-5 items-center">
        {!isRunning ? (
          <button onClick={handleResume}
            className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-semibold flex items-center justify-center active:scale-90 transition-transform border border-white/20"
            aria-label="继续">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>
        ) : (
          <button onClick={handlePause}
            className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-semibold flex items-center justify-center active:scale-90 transition-transform border border-white/20"
            aria-label="暂停">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          </button>
        )}
        <button onClick={finish}
          className="w-24 h-24 rounded-full bg-red-500 text-white shadow-xl shadow-red-500/30 text-sm font-semibold flex flex-col items-center justify-center active:scale-90 transition-transform"
          aria-label="结束计时">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
          <span className="text-[10px] mt-0.5">结束</span>
        </button>
      </div>

      <button onClick={handleCancel}
        className="absolute top-[calc(16px+var(--safe-top))] left-4 w-10 h-10 flex items-center justify-center text-white/50 active:text-white/80 transition-colors"
        aria-label="关闭">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
};
