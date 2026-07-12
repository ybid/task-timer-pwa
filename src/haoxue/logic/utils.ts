// 口算训练工具函数（移植自 haoxue 原 utils 模块）

export const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const randFloat = (): number => Math.random();

export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const formatTime = (ms: number): string => {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}秒`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  return `${min}分${s}秒`;
};

export const formatDate = (ts: number): string => {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const escapeHtml = (s: string): string =>
  String(s).replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

/** 格式化算式用于显示（在算子两边加空格） */
export const formatExprForDisplay = (expr: string): string =>
  expr.replace(/([+\-×÷])/g, ' $1 ');
