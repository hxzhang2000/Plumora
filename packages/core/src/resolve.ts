/* ============================================================
 * 卦象推导：本卦 / 互卦 / 变卦 / 体用 —— 对应 03 文档 §三
 * ============================================================ */

import {
  type Hexagram,
  type TrigramNumber,
  binaryToLines,
  getHexagram,
  linesToBinary,
  trigram,
  trigramByBinary,
  trigramLines,
} from '@plumora/knowledge';
import { judge } from './judge.js';
import { lineName } from './line.js';
import { assertTrigramNumber } from './modulus.js';
import type { ResolvedHexagram, TiYongRule } from './types.js';

/**
 * 六爻推导。
 *
 * @param upper 上卦先天数
 * @param lower 下卦先天数
 * @param moving 动爻 1–6
 * @param tiYongRule 体用判定流派（默认 MOVING_LINE，03 文档 §3.6）
 */
export function resolve(
  upper: TrigramNumber,
  lower: TrigramNumber,
  moving: number,
  tiYongRule: TiYongRule = 'MOVING_LINE',
): ResolvedHexagram {
  assertTrigramNumber(upper, '上卦先天数');
  assertTrigramNumber(lower, '下卦先天数');
  if (!Number.isInteger(moving) || moving < 1 || moving > 6) {
    throw new Error(`动爻必须在 1–6 之间，实际 ${moving}`);
  }

  // 本卦六爻，自下而上（index 0 = 初爻）
  const lines = [...trigramLines(lower), ...trigramLines(upper)];

  // 变卦：动爻取反，其余五爻不变（03 §3.3）
  const changedLines = [...lines];
  changedLines[moving - 1] = 1 - changedLines[moving - 1];

  // 互卦：第 2,3,4 爻为互下卦、第 3,4,5 爻为互上卦（03 §3.4，注意 3、4 爻复用）
  const huLower = trigramByBinary(linesToBinary(lines.slice(1, 4)));
  const huUpper = trigramByBinary(linesToBinary(lines.slice(2, 5)));

  const bianLower = trigramByBinary(linesToBinary(changedLines.slice(0, 3)));
  const bianUpper = trigramByBinary(linesToBinary(changedLines.slice(3, 6)));

  // 体用判定（03 §3.6）
  let ti: TrigramNumber;
  let yong: TrigramNumber;
  if (tiYongRule === 'UPPER_YONG_LOWER_TI') {
    ti = lower;
    yong = upper;
  } else if (moving >= 4) {
    // 动爻在上卦 → 上卦为用、下卦为体
    ti = lower;
    yong = upper;
  } else {
    // 动爻在下卦 → 下卦为用、上卦为体
    ti = upper;
    yong = lower;
  }

  const ben: Hexagram = getHexagram(upper, lower);
  const hu: Hexagram = getHexagram(huUpper, huLower);
  const bian: Hexagram = getHexagram(bianUpper, bianLower);

  return {
    lines,
    changedLines,
    upper,
    lower,
    moving,
    movingLineName: lineName(moving, lines[moving - 1] === 1),
    ben,
    hu,
    bian,
    ti,
    yong,
    tiYongRule,
    judge: judge(trigram(ti), trigram(yong)),
  };
}

/** 互卦六爻（自下而上）——用于 UI 绘制互卦卦符 */
export function huLines(lines: readonly number[]): number[] {
  return [...lines.slice(1, 4), ...lines.slice(2, 5)];
}

/** 由六爻（自下而上）直接推导，供卦例回放使用 */
export function resolveFromLines(
  lines: readonly number[],
  moving: number,
  tiYongRule: TiYongRule = 'MOVING_LINE',
): ResolvedHexagram {
  const lower = trigramByBinary(linesToBinary(lines.slice(0, 3)));
  const upper = trigramByBinary(linesToBinary(lines.slice(3, 6)));
  return resolve(upper, lower, moving, tiYongRule);
}

/** 由本卦六爻取变卦六爻（供 UI 单独绘制） */
export function changedOf(lines: readonly number[], moving: number): number[] {
  const out = [...lines];
  out[moving - 1] = 1 - out[moving - 1];
  return out;
}

/** 三爻位编码 → 三爻（自下而上），重导出便于 UI 使用 */
export { binaryToLines };
