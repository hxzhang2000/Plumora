/* ============================================================
 * 取余规则与时辰序数 —— 对应 03 文档 §1.2、§6.2
 * ============================================================ */

import type { TrigramNumber } from '@plumora/knowledge';

/**
 * 上卦 / 下卦取余：数值 mod 8，**余 0 取 8**（03 文档 §1.2）。
 * 入参用 number，但实现按大整数安全处理（输入上限 999,999,999，两数之和 < 2^31 亦安全；
 * 为防日后放宽上限，此处显式取整并避免浮点误差）。
 */
export function modTrigram(n: number): TrigramNumber {
  const r = Math.trunc(n) % 8;
  return (r === 0 ? 8 : r < 0 ? r + 8 : r) as TrigramNumber;
}

/** 动爻取余：数值 mod 6，**余 0 取 6**（03 文档 §1.2） */
export function modMoving(n: number): number {
  const r = Math.trunc(n) % 6;
  return r === 0 ? 6 : r < 0 ? r + 6 : r;
}

/**
 * 时辰序数：子时=1 … 亥时=12（03 文档 §6.2）。
 * 23:00–00:59 为子时；23:00 后按次日子时处理，本函数只负责「小时 → 序数」映射。
 */
export function hourNumber(hour: number): number {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  if (h >= 23) return 1;
  return Math.floor((h + 1) / 2) + 1;
}

/** 十二地支（时辰序数 → 地支字），index 0 = 子 */
export const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

/** 十天干，index 0 = 甲 */
export const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;

/** 时辰序数 → 地支字（1 → 子） */
export function hourBranchName(hourNo: number): string {
  return EARTHLY_BRANCHES[(((hourNo - 1) % 12) + 12) % 12];
}

/* ------------------------------------------------------------------
 * 年支口径（**唯一定义点**，勿在别处另算）
 *
 * 03 文档 §6.1 / §2.1 裁定：时间起卦的「年数 Y」= **农历年**地支序数
 * （子=1 … 亥=12），即以**正月初一**为年界。
 *
 * ⚠️ 这与「立春为界」的干支纪年（命理派口径，农历库的 gzYear 字段）
 *    每年在「正月初一 → 立春」之间约 13 天不一致，例如：
 *      2026-02-10  gzYear=丙午（立春已过），农历仍是乙巳年腊月廿三
 *    若标签取 gzYear、算法取 lYear，界面会写「丙午年」而实际按巳=6 计算，
 *    用户按标签手算必然对不上（同一卦两个答案）。
 *
 * 故**年支与干支年标签必须由同一个函数派生**，见下方两个函数。
 * ------------------------------------------------------------------ */

/** 农历年 → 年支序数（子=1 … 亥=12）。以正月初一为年界，非立春。 */
export function yearBranchNoOf(lYear: number): number {
  return ((((lYear - 4) % 12) + 12) % 12) + 1;
}

/**
 * 农历年 → 干支年字符串（如 2026 → 「丙午」）。
 * 与 {@link yearBranchNoOf} 同源，供时间起卦标签使用。
 */
export function ganzhiYearOf(lYear: number): string {
  const stem = HEAVENLY_STEMS[(((lYear - 4) % 10) + 10) % 10];
  const branch = EARTHLY_BRANCHES[(((lYear - 4) % 12) + 12) % 12];
  return `${stem}${branch}`;
}

/** 数值合法性：03 文档 §6.3 —— 0 视为无效输入，正整数上限 999,999,999 */
export const NUMBER_MAX = 999_999_999;

export function isValidNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= NUMBER_MAX;
}

/**
 * 断言入参是合法的先天八卦数（1–8）。
 *
 * 用于领域入口处的**显式校验**：过去这些位置直接写 `TRIGRAMS[n]`，脏数据要到
 * 属性访问时才以 `TypeError: Cannot read properties of undefined` 崩溃，
 * 报错信息与真实原因（哪来的脏值）完全脱节。
 */
export function assertTrigramNumber(n: number, field = '先天八卦数'): TrigramNumber {
  if (!Number.isInteger(n) || n < 1 || n > 8) {
    throw new Error(`${field}非法：${n}（须为 1–8 的整数）`);
  }
  return n as TrigramNumber;
}
