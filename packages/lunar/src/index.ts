/// <reference path="./solarlunar.d.ts" />
/* ============================================================
 * @plumora/lunar —— 农历转换适配层
 *
 * 实现 @plumora/core 定义的 LunarProvider 端口（Web 端实现）。
 * 底层为 solarlunar（MIT，内置 1900–2100 农历数据表）。
 *
 * 已知口径（与 03 文档 §6.1 一致）：
 *   - 闰月按本月份数（lMonth 即为本月份数，绝对值化后返回，不加 0.5 / 不加 1）
 *   - monthCn 已含「闰」前缀（如「闰四月」），调用方不要重复拼接
 *   - **年支与干支年标签一律由 `lYear` 派生**（农历年口径，正月初一为年界），
 *     不使用 solarlunar 的 `gzYear`（立春为界，两者每年约 13 天不一致）。
 *     详见 @plumora/core 的 `modulus.ts`「年支口径」段与 `lunar.ts` 端口注释。
 *
 * 金标准校验：2026-09-25 = 丙午年 八月十五（07 文档 TC-LC01）。
 * ============================================================ */

import { ganzhiYearOf, type LunarDate, type LunarProvider } from '@plumora/core';
import solarlunar from 'solarlunar';

/** solarlunar 支持范围 */
export const LUNAR_MIN_YEAR = 1900;
export const LUNAR_MAX_YEAR = 2100;

export const solarlunarProvider: LunarProvider = {
  solar2lunar(year: number, month: number, day: number): LunarDate | null {
    if (year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) return null;
    const raw = solarlunar.solar2lunar(year, month, day);
    if (!raw || raw === -1) return null;
    return {
      lYear: raw.lYear,
      // 端口约定 lMonth 恒为正的本月份数；此处绝对值化以消除上游用负数表示闰月的可能
      lMonth: Math.abs(raw.lMonth),
      lDay: raw.lDay,
      isLeap: raw.isLeap,
      gzYear: raw.gzYear,
      // solarlunar 的 monthCn 在闰月时已返回「闰四月」，此处原样透传
      monthCn: raw.monthCn,
      dayCn: raw.dayCn,
    };
  },
};

/** 默认导出：直接作为 LunarProvider 使用 */
export default solarlunarProvider;

/**
 * 取某时刻的农历标签（非时间起卦时，04 文档 §2.2 要求 lunarLabel 存当前时刻农历）。
 *
 * 干支年由 `lYear` 派生而非取 `gzYear` —— 与时间起卦的 `cast.label` 同源，
 * 否则「正月初一 → 立春」之间起卦页会显示「乙巳年 正月初一」而列表页显示
 * 「甲辰年 正月初一」，同一时刻两个年号。
 *
 * @returns 如「丙午年 八月十五」；超范围时返回 '—'
 */
export function lunarLabelOf(date: Date): string {
  const lu = solarlunarProvider.solar2lunar(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  if (!lu) return '—';
  return `${ganzhiYearOf(lu.lYear)}年 ${lu.monthCn}${lu.dayCn}`;
}

/** 取某时刻的完整农历对象（UI 时间预览用） */
export function lunarAt(date: Date): LunarDate | null {
  return solarlunarProvider.solar2lunar(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/* ============================================================
 * 手动时间输入辅助（时间起卦的手工录入）—— 纯数据、无 I/O。
 * 全部由 @plumora/lunar 直接导出，Web 端自行引用，不经过 LunarProvider 端口。
 * ============================================================ */

/** 公历日期三元组（可直接喂 `new Date(y, m - 1, d)`） */
export interface SolarDate {
  readonly y: number;
  readonly m: number;
  readonly d: number;
}

/**
 * 农历 → 公历反向换算（手动录入农历日期时用）。
 *
 * @param lYear 农历年（1900–2100）
 * @param lMonth 农历月 1–12，**按本月份数**（闰月也传本数，靠 isLeapMonth 区分）
 * @param lDay 农历日 1–30
 * @param isLeapMonth 是否闰月
 * @returns 归一化公历 `{ y, m, d }`；任一非法输入返回 `null`（绝不透出底层 `-1` 哨兵）
 *
 * 自挡的非法输入（底层对其中一部分会静默给出错误结果，必须在前面拦掉）：
 *   - 非整数 / 年越界 / 月不在 1–12 / 日不在 1–30（底层对 `d ≤ 0` 会算成「前一天」）
 *   - `isLeapMonth=true` 但该年闰月不是 lMonth、或该年无闰月（0 ≠ lMonth）
 *   - 闰月日数按 `leapDays` 上限（闰月可比本月短：2025 闰六月 29 天、六月 30 天；
 *     反向若按本月天数放行会造出不存在的日期）
 *   - 农历 1900 正月（底层限制 `d < 31` 即 -1，该月无法反查）与 2100 腊月初二及以后
 *     超出底层数据范围
 *
 * ⚠️ 已知上游缺陷（07 文档 TC-LC08，穷举实测 17 例）：闰月 30 天而本月 29 天时
 * （如 1941 闰六月三十），底层用**本月**天数校验闰月日，误判越界返回 -1 ——
 * 此处如实返回 `null`，不伪造成功结果。
 */
export function lunar2solar(
  lYear: number,
  lMonth: number,
  lDay: number,
  isLeapMonth = false,
): SolarDate | null {
  if (!Number.isInteger(lYear) || !Number.isInteger(lMonth) || !Number.isInteger(lDay)) return null;
  if (lYear < LUNAR_MIN_YEAR || lYear > LUNAR_MAX_YEAR) return null;
  if (lMonth < 1 || lMonth > 12) return null;
  if (lDay < 1 || lDay > 30) return null;
  if (isLeapMonth && solarlunar.leapMonth(lYear) !== lMonth) return null; // 闰月不匹配 / 该年无闰月
  const maxDay = isLeapMonth ? solarlunar.leapDays(lYear) : solarlunar.monthDays(lYear, lMonth);
  if (maxDay <= 0 || lDay > maxDay) return null;
  const raw = solarlunar.lunar2solar(lYear, lMonth, lDay, isLeapMonth);
  if (!raw || raw === -1) return null;
  return { y: raw.cYear, m: raw.cMonth, d: raw.cDay };
}

/**
 * 农历 lYear 年的闰月月份（1–12）；无闰月返回 0。
 * 年份非整数或越界同样返回 0（视为「无法确定闰月」，不抛错）。
 * 用途：UI 据此决定是否展示闰月开关。
 */
export function leapMonth(lYear: number): number {
  if (!Number.isInteger(lYear) || lYear < LUNAR_MIN_YEAR || lYear > LUNAR_MAX_YEAR) return 0;
  return solarlunar.leapMonth(lYear);
}

/**
 * 农历 lYear 年 lMonth 月（**非闰月**）的天数（29 或 30）。
 * 参数非法（年非整数/越界、月非整数/越界）返回 -1，沿用底层 monthDays 的哨兵口径。
 * 闰月天数请用 `leapDays`。用途：UI 据此封顶「日」输入框。
 */
export function monthDays(lYear: number, lMonth: number): number {
  if (!Number.isInteger(lYear) || lYear < LUNAR_MIN_YEAR || lYear > LUNAR_MAX_YEAR) return -1;
  if (!Number.isInteger(lMonth) || lMonth < 1 || lMonth > 12) return -1;
  return solarlunar.monthDays(lYear, lMonth);
}

/**
 * 农历 lYear 年闰月的天数（29 或 30）；该年无闰月或年份非法返回 0。
 * 用途：闰月开关打开时，UI 用它替代 `monthDays` 封顶「日」输入框。
 */
export function leapDays(lYear: number): number {
  if (!Number.isInteger(lYear) || lYear < LUNAR_MIN_YEAR || lYear > LUNAR_MAX_YEAR) return 0;
  return solarlunar.leapDays(lYear);
}

/**
 * 校验公历日期是否为 1900–2100 内的真实日历日（手动「公历日期」输入用）。
 *
 * 三个入参须为整数，年在支持范围内，且 Date 往返后年月日不变 ——
 * 据此天然排除 2026-02-29（平年）、2026-04-31 这类「月有 30/31 天」的错值。
 * 纯 Date 运算，不依赖 solarlunar。
 */
export function isValidSolarDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < LUNAR_MIN_YEAR || y > LUNAR_MAX_YEAR) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(y, m - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d;
}
