/* ============================================================
 * 手动时间输入：农历 → 公历反向换算 + 公历日期校验
 *
 * 时间起卦的手工录入（04 文档）依赖这组纯函数：
 *   lunar2solar / leapMonth / monthDays / leapDays / isValidSolarDate
 * 本文件对拍的是它们与 solar2lunar（既有方向）的自洽性，以及非法输入的收敛行为。
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import {
  isValidSolarDate,
  leapDays,
  leapMonth,
  lunar2solar,
  monthDays,
  solarlunarProvider,
} from '../src/index.js';

describe('往返：公历 → 农历 → 公历 回到原日期', () => {
  /**
   * 抽样覆盖：数据起点之后、多个春节（年界当天/前一天）、金标准算例、闰月、世纪末、上限年。
   * 注：农历 1900 正月无法反查（底层限制 `y==1900 && m==1 && d < 31` 即 -1，即公历
   * 1900-01-31 ~ 1900-03-01 这一段），故首例取 1900-03-01（农历 1900 二月初一）之后。
   */
  const cases: [number, number, number][] = [
    [1900, 3, 1], // 数据起点次月（农历 1900 二月初一）
    [1999, 12, 31], // 世纪末
    [2000, 2, 5], // 春节
    [2024, 2, 10], // 春节
    [2025, 1, 29], // 春节
    [2026, 2, 16], // 年界前一天（农历 2025 腊月廿九）
    [2026, 2, 17], // 年界当天（正月初一）
    [2026, 9, 25], // 金标准算例 A（丙午年八月十五）
    [2025, 8, 1], // 闰六月初八（闰月）
    [2100, 12, 31], // 底层上限
  ];

  it.each(cases)('%i-%i-%i 往返回到原日期', (y, m, d) => {
    const lu = solarlunarProvider.solar2lunar(y, m, d);
    expect(lu, `${y}-${m}-${d} 正向转换失败`).not.toBeNull();
    const back = lunar2solar(lu!.lYear, lu!.lMonth, lu!.lDay, lu!.isLeap);
    expect(back).toEqual({ y, m, d });
  });
});

describe('闰月：leapMonth / leapDays / monthDays', () => {
  it('查询值与底层一致（2023 闰二月、2025 闰六月、2026 无闰月）', () => {
    expect([leapMonth(2023), leapDays(2023)]).toEqual([2, 29]);
    expect([leapMonth(2025), leapDays(2025)]).toEqual([6, 29]);
    expect(leapMonth(2026)).toBe(0);
    expect(leapDays(2026)).toBe(0); // 无闰月 → 0
  });

  it('monthDays 给出的是「本月」天数，闰月须另用 leapDays', () => {
    expect(monthDays(2025, 6)).toBe(30); // 六月 30 天
    expect(monthDays(2025, 7)).toBe(30); // 七月 30 天
    expect(monthDays(2023, 2)).toBe(30); // 二月 30 天
    expect(leapDays(2023)).toBe(29); // 闰二月只有 29 天 —— 与本月不同，故不可混用
    expect(leapDays(2025)).toBe(29); // 闰六月 29 天，本月（六月）30 天
  });

  it('参数非法时：monthDays → -1，leapMonth / leapDays → 0', () => {
    expect(monthDays(1899, 1)).toBe(-1);
    expect(monthDays(2101, 1)).toBe(-1);
    expect(monthDays(2025.5, 1)).toBe(-1);
    expect(monthDays(2025, 0)).toBe(-1);
    expect(monthDays(2025, 13)).toBe(-1);
    expect(leapMonth(1899)).toBe(0);
    expect(leapMonth(2101)).toBe(0);
    expect(leapMonth(2025.5)).toBe(0);
    expect(leapDays(1899)).toBe(0);
    expect(leapDays(2101)).toBe(0);
  });
});

describe('闰月换算：isLeap=true / false 双向正确', () => {
  it('2025 闰六月初一 → 2025-07-25；六月初一 → 2025-06-25', () => {
    expect(lunar2solar(2025, 6, 1, true)).toEqual({ y: 2025, m: 7, d: 25 });
    expect(lunar2solar(2025, 6, 1, false)).toEqual({ y: 2025, m: 6, d: 25 });
  });

  it('2023 闰二月初一 → 2023-03-22；二月初一 → 2023-02-20', () => {
    expect(lunar2solar(2023, 2, 1, true)).toEqual({ y: 2023, m: 3, d: 22 });
    expect(lunar2solar(2023, 2, 1, false)).toEqual({ y: 2023, m: 2, d: 20 });
  });

  it('闰月日 > leapDays → null（2025 闰六月只有 29 天，第 30 天不存在）', () => {
    expect(leapDays(2025)).toBe(29);
    expect(lunar2solar(2025, 6, 30, true)).toBeNull();
    expect(leapDays(2023)).toBe(29);
    expect(lunar2solar(2023, 2, 30, true)).toBeNull();
    // 对照：本月第 30 天仍合法（六月 30 天）
    expect(lunar2solar(2025, 6, 30, false)).toEqual({ y: 2025, m: 7, d: 24 });
  });

  it('isLeap=true 但该年无闰月 → null', () => {
    expect(leapMonth(2026)).toBe(0);
    expect(lunar2solar(2026, 6, 1, true)).toBeNull();
    expect(lunar2solar(2026, 1, 1, true)).toBeNull();
  });

  it('isLeap=true 但闰月不是该月 → null', () => {
    expect(leapMonth(2023)).toBe(2);
    expect(lunar2solar(2023, 3, 1, true)).toBeNull(); // 2023 闰的是二月，不是三月
    expect(leapMonth(2025)).toBe(6);
    expect(lunar2solar(2025, 5, 1, true)).toBeNull();
  });

  it('闰月从正向转换取值后可原路返回', () => {
    const lu = solarlunarProvider.solar2lunar(2025, 8, 1);
    expect(lu!.isLeap).toBe(true);
    expect(lunar2solar(lu!.lYear, lu!.lMonth, lu!.lDay, lu!.isLeap)).toEqual({ y: 2025, m: 8, d: 1 });
  });

  it('⚠️ 已知上游缺陷：闰月 30 天而本月 29 天时第 30 天反查失败（07 TC-LC08 的 17 例之一）', () => {
    // 1941 年闰六月有 30 天（leapDays=30），六月只有 29 天（monthDays=29）。
    // 底层 lunar2solar 用**本月**天数校验闰月日，误判 `30 > 29` 返回 -1。
    // 因此这里如实断言 null（绝不透出 -1），**不是**说 1941-08-22 这天不存在 ——
    // 正向转换证明它是真实的「闰六月三十」：solar2lunar(1941, 8, 22) → 闰六月三十。
    // 若上游修复此缺陷，本条应改为断言 { y: 1941, m: 8, d: 22 }。
    expect([leapDays(1941), monthDays(1941, 6)]).toEqual([30, 29]);
    expect(lunar2solar(1941, 6, 30, true)).toBeNull();
    expect(lunar2solar(1941, 6, 29, true)).toEqual({ y: 1941, m: 8, d: 21 }); // 第 29 天仍可反查
  });
});

describe('非法输入一律返回 null（绝不透出 -1 哨兵 / 不返回错日期）', () => {
  it('非整数', () => {
    expect(lunar2solar(2025.5, 1, 1)).toBeNull();
    expect(lunar2solar(2025, 1.5, 1)).toBeNull();
    expect(lunar2solar(2025, 1, 1.5)).toBeNull();
    expect(lunar2solar(NaN, 1, 1)).toBeNull();
  });

  it('年份越界（1900–2100 之外）', () => {
    expect(lunar2solar(1899, 1, 1)).toBeNull();
    expect(lunar2solar(2101, 1, 1)).toBeNull();
  });

  it('月份越界', () => {
    expect(lunar2solar(2025, 0, 1)).toBeNull();
    expect(lunar2solar(2025, 13, 1)).toBeNull();
    expect(lunar2solar(2025, -1, 1)).toBeNull();
  });

  it('日 0 / 31（底层对 d=0 会静默算成前一天，必须由包装层挡掉）', () => {
    expect(lunar2solar(2025, 1, 0)).toBeNull();
    expect(lunar2solar(2025, 1, 31)).toBeNull();
    expect(lunar2solar(2025, 1, -1)).toBeNull();
    // 对照：d=1 合法
    expect(lunar2solar(2025, 1, 1)).toEqual({ y: 2025, m: 1, d: 29 });
  });

  it('底层数据边界：农历 1900 正月、2100 腊月初二及以后不可反查', () => {
    expect(lunar2solar(1900, 1, 1)).toBeNull();
    expect(lunar2solar(1900, 1, 30)).toBeNull();
    expect(lunar2solar(2100, 12, 2)).toBeNull();
    expect(lunar2solar(2100, 12, 1)).toEqual({ y: 2100, m: 12, d: 31 }); // 仅此一天可反查
  });
});

describe('isValidSolarDate 公历日期校验', () => {
  const cases: [number, number, number, boolean][] = [
    [2024, 2, 29, true], // 闰年 2 月 29 日
    [2026, 2, 29, false], // 平年无 2 月 29 日
    [2100, 2, 29, false], // 逢百年不闰
    [2026, 4, 31, false], // 4 月无 31 日
    [2026, 1, 31, true],
    [2026, 9, 25, true], // 算例 A
    [1900, 1, 31, true], // 支持范围下界当天
    [1900, 1, 1, true], // 合法公历日（虽无法反查农历，但本函数只管公历）
    [1899, 12, 31, false], // 越下界
    [2101, 1, 1, false], // 越上界
    [2026, 0, 1, false], // 月 0
    [2026, 13, 1, false], // 月 13
    [2026, 1, 0, false], // 日 0
    [2026, 1, 32, false], // 日 32
    [2025.5, 1, 1, false], // 非整数
    [2026, 1, 1.5, false], // 非整数
    [NaN, 1, 1, false],
  ];

  it.each(cases)('%i-%i-%i → %s', (y, m, d, expected) => {
    expect(isValidSolarDate(y, m, d)).toBe(expected);
  });
});
