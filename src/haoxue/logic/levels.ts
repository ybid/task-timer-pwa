// 口算训练关卡体系（移植自 haoxue 原 levels 模块）
// 12 关：一位数加减 → 表内乘除 → 两位加减 → 混合 → 综合。
// coverageSet 为必须掌握的关键算式列表；null 表示综合关（按"至少 30 道"判定）。

import type { LevelConfig, Operator, Progress } from '../types';

// ---- 全覆盖题集生成 ----
function generateFullCoverageSet(
  operators: Operator[],
  range: { a: [number, number]; b: [number, number] },
  filter?: { type: string },
): string[] {
  const set: string[] = [];
  const isAdd = operators.includes('+');
  const isSub = operators.includes('-');

  if (isAdd && !isSub) {
    for (let a = range.a[0]; a <= range.a[1]; a++) {
      for (let b = range.b[0]; b <= range.b[1]; b++) {
        if (filter?.type === 'carry' && (a % 10) + (b % 10) < 10) continue;
        if (filter?.type === 'noCarry' && (a % 10) + (b % 10) >= 10) continue;
        set.push(`${a}+${b}`);
      }
    }
  } else if (isSub && !isAdd) {
    for (let a = range.a[0]; a <= range.a[1]; a++) {
      for (let b = range.b[0]; b <= range.b[1]; b++) {
        if (a < b) continue;
        if (filter?.type === 'borrow' && (a % 10) >= (b % 10)) continue;
        if (filter?.type === 'noBorrow' && (a % 10) < (b % 10)) continue;
        set.push(`${a}-${b}`);
      }
    }
  } else {
    for (let a = range.a[0]; a <= range.a[1]; a++) {
      for (let b = range.b[0]; b <= range.b[1]; b++) {
        if (isAdd) set.push(`${a}+${b}`);
        if (isSub && a >= b) set.push(`${a}-${b}`);
      }
    }
  }
  return set;
}

const singleDigitAddAll = generateFullCoverageSet(['+'], { a: [0, 9], b: [0, 9] }); // 100
const singleDigitSubAll = generateFullCoverageSet(['-'], { a: [0, 9], b: [0, 9] }); // 55
const tableMulAll = generateFullCoverageSet(['×'], { a: [1, 9], b: [1, 9] }); // 81
const tableDivAll: string[] = []; // 1~9 除法，每商 1~9 × 除数 1~9 = 81
for (let q = 1; q <= 9; q++) {
  for (let b = 1; b <= 9; b++) {
    tableDivAll.push(`${b * q}÷${b}`);
  }
}

const twoDigitAddSet = (() => {
  const set = new Set<string>();
  const tens = [11, 23, 35, 47, 58, 69];
  for (const a of tens) {
    for (let u1 = 0; u1 <= 9; u1++) {
      for (let u2 = 0; u2 <= 9; u2++) {
        const aa = a + u1;
        const bb = a + u2;
        if (aa <= 99 && bb <= 99) set.add(`${aa}+${bb}`);
      }
    }
  }
  return [...set];
})();

const twoDigitSubSet = (() => {
  const set = new Set<string>();
  const tens = [11, 23, 35, 47, 58, 69];
  for (const a of tens) {
    for (let u1 = 0; u1 <= 9; u1++) {
      for (let u2 = 0; u2 <= 9; u2++) {
        const aa = a + u1;
        const bb = a + u2;
        if (aa > bb) set.add(`${aa}-${bb}`);
      }
    }
  }
  return [...set];
})();

// 注意：原 level 9~12 未声明 range，会导致混合运算选到 +/- 时崩溃。
// 此处补上合理范围（移植修复）。
export const LEVELS: LevelConfig[] = [
  // 一位数阶段
  { id: 1, name: '一位数加法', icon: '🍎', desc: '10 以内的加法（全覆盖）', operators: ['+'], range: { a: [0, 9], b: [0, 9] }, filter: { type: 'mixed' }, timeoutSec: 5, coverageSet: singleDigitAddAll },
  { id: 2, name: '一位数减法', icon: '🍌', desc: '10 以内的减法（全覆盖）', operators: ['-'], range: { a: [0, 9], b: [0, 9] }, filter: { type: 'mixed' }, timeoutSec: 5, coverageSet: singleDigitSubAll },
  // 表内乘除法
  { id: 3, name: '表内乘法', icon: '🎲', desc: '1~9 乘法表（全覆盖）', operators: ['×'], range: { a: [1, 9], b: [1, 9] }, filter: { type: 'mixed' }, timeoutSec: 10, coverageSet: tableMulAll },
  { id: 4, name: '表内除法', icon: '🍰', desc: '表内整除（全覆盖）', operators: ['÷'], range: { a: [1, 81], b: [1, 9] }, filter: { type: 'exact' }, timeoutSec: 10, coverageSet: tableDivAll },
  // 一位+两位混合
  { id: 5, name: '两位数加法', icon: '🌳', desc: '100 以内加法（关键题）', operators: ['+'], range: { a: [10, 99], b: [10, 99] }, filter: { type: 'mixed' }, timeoutSec: 10, coverageSet: twoDigitAddSet },
  { id: 6, name: '两位数减法', icon: '🌲', desc: '100 以内减法（关键题）', operators: ['-'], range: { a: [10, 99], b: [10, 99] }, filter: { type: 'mixed' }, timeoutSec: 10, coverageSet: twoDigitSubSet },
  // 混合
  { id: 7, name: '一位加减混合', icon: '🎈', desc: '一位数加+减（全覆盖）', operators: ['+', '-'], range: { a: [0, 9], b: [0, 9] }, filter: { type: 'mixed' }, timeoutSec: 5, coverageSet: [...singleDigitAddAll, ...singleDigitSubAll] },
  { id: 8, name: '两位加减混合', icon: '🎉', desc: '两位数加+减（关键题）', operators: ['+', '-'], range: { a: [10, 99], b: [10, 99] }, filter: { type: 'mixed' }, timeoutSec: 10, coverageSet: [...twoDigitAddSet, ...twoDigitSubSet] },
  // 进阶
  { id: 9, name: '乘加混合', icon: '🚀', desc: '乘法与加法混合', operators: ['+', '×'], range: { a: [0, 9], b: [0, 9] }, weights: { '+': 0.5, '×': 0.5 }, filter: { type: 'mixed' }, timeoutSec: 10, coverageSet: null },
  { id: 10, name: '乘减混合', icon: '🚁', desc: '乘法与减法混合', operators: ['-', '×'], range: { a: [0, 9], b: [0, 9] }, weights: { '-': 0.5, '×': 0.5 }, filter: { type: 'mixed' }, timeoutSec: 10, coverageSet: null },
  // 综合挑战
  { id: 11, name: '加减乘混合', icon: '⚡', desc: '加减乘混合', operators: ['+', '-', '×'], range: { a: [0, 9], b: [0, 9] }, weights: { '+': 0.4, '-': 0.4, '×': 0.2 }, filter: { type: 'mixed' }, timeoutSec: 10, coverageSet: null },
  { id: 12, name: '四则综合', icon: '🌟', desc: '加减乘除混合', operators: ['+', '-', '×', '÷'], range: { a: [0, 99], b: [0, 9] }, weights: { '+': 0.3, '-': 0.3, '×': 0.2, '÷': 0.2 }, filter: { type: 'mixed' }, timeoutSec: 10, coverageSet: null },
];

export const getLevel = (id: number): LevelConfig | undefined => LEVELS.find((l) => l.id === id);

/** 第 N 关需第 N-1 关通过 */
export function isUnlocked(levelId: number, progress: Progress | null): boolean {
  if (levelId === 1) return true;
  const prev = progress?.levels[levelId - 1];
  return Boolean(prev && prev.passed);
}
