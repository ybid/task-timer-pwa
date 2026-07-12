// 下拉刷新（pull-to-refresh）hook：在滚动容器顶部下拉触发刷新。
// 用原生 touch 监听（touchmove 设 passive:false）以便在顶部下拉时拦截默认滚动；
// 仅在「竖向下拉 + 几乎位于顶部 + 竖向位移大于横向位移」时生效，避免劫持甘特图的横向平移。
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface Options {
  onRefresh: () => void | Promise<void>;
  /** 触发刷新所需的下拉距离（px） */
  threshold?: number;
  /** 是否启用（如未登录时可关闭） */
  enabled?: boolean;
  /** 两次刷新之间的最小间隔（ms），默认 10000（10 秒） */
  cooldownMs?: number;
}

export function usePullToRefresh({ onRefresh, threshold = 64, enabled = true, cooldownMs = 10000 }: Options) {
  const ref = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const pulling = useRef(false);
  const distRef = useRef(0);
  const refreshingRef = useRef(false);
  const lastDoneRef = useRef(0); // 上次成功刷新完成的时间戳
  const onRefreshRef = useRef(onRefresh);
  const enabledRef = useRef(enabled);
  const cooldownRef = useRef(cooldownMs);
  onRefreshRef.current = onRefresh;
  enabledRef.current = enabled;
  cooldownRef.current = cooldownMs;

  const [dist, setDistState] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [coolLeft, setCoolLeft] = useState(0); // 冷却剩余秒数，0 表示不在冷却期
  const cooling = coolLeft > 0;

  const setDist = (d: number) => {
    distRef.current = d;
    setDistState(d);
  };
  const setRefRefreshing = (b: boolean) => {
    refreshingRef.current = b;
    setRefreshing(b);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (el.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        startX.current = e.touches[0].clientX;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current === null || refreshingRef.current) return;
      const y = e.touches[0].clientY;
      const x = e.touches[0].clientX;
      const dy = y - startY.current;
      const dx = x - (startX.current ?? x);
      // 仅竖向下拉、且位于顶部、竖向位移占主导时拦截
      if (dy > 0 && Math.abs(dy) > Math.abs(dx) && el.scrollTop <= 0) {
        pulling.current = true;
        const d = Math.min(dy * 0.5, threshold * 1.4);
        setDist(d);
        if (e.cancelable) e.preventDefault();
      } else if (dy <= 0) {
        // 向上滚动 → 取消下拉
        startY.current = null;
        setDist(0);
        pulling.current = false;
      }
    };

    const onEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pulling.current && distRef.current >= threshold) {
        pulling.current = false;
        const now = Date.now();
        // 冷却期内：不触发刷新，提示倒计时后归位
        if (now - lastDoneRef.current < cooldownRef.current) {
          setCoolLeft(Math.ceil((cooldownRef.current - (now - lastDoneRef.current)) / 1000));
          setDist(0);
          return;
        }
        setRefRefreshing(true);
        setDist(threshold);
        try {
          await onRefreshRef.current();
        } finally {
          lastDoneRef.current = Date.now();
          setRefRefreshing(false);
          setDist(0);
        }
      } else {
        pulling.current = false;
        setDist(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [threshold, enabled]);

  // 冷却倒计时：进入冷却（coolLeft>0）后每秒递减，归零即结束
  useEffect(() => {
    if (!cooling) return;
    const t = setInterval(() => {
      setCoolLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [cooling]);

  const indicator: ReactNode = dist > 0 || refreshing || cooling
    ? (
      <div
        className="absolute left-0 right-0 top-0 flex flex-col items-center justify-end pointer-events-none z-20"
        style={{ height: cooling && dist === 0 ? 40 : dist, transition: refreshing || cooling ? 'height 200ms ease' : pulling.current ? 'none' : 'height 200ms ease' }}
      >
        <div className="pb-2 flex flex-col items-center text-gray-400">
          <svg
            className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            style={{ transform: refreshing ? 'none' : `rotate(${(dist / threshold) * 180}deg)`, transition: refreshing ? 'none' : 'transform 80ms linear' }}
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[11px] mt-1">
            {refreshing
              ? '刷新中…'
              : cooling
                ? `${coolLeft}s 后可刷新`
                : dist >= threshold
                  ? '释放刷新'
                  : '下拉刷新'}
          </span>
        </div>
      </div>
    )
    : null;

  return { ref, indicator };
}
