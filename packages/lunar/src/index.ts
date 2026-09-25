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
