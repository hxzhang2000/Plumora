/* ============================================================
 * 农历转换 + 时间起卦端到端 —— 07 文档 §3.4 LunarTest
 *
 * 这是「文档说的」与「实现做的」在日历维度上的对拍：
 * 金标准算例 A 的公历日期必须真的落在丙午年八月十五。
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { TRIGRAMS } from '@plumora/knowledge';
import { castByTime, hourNumber, yearBranchNoOf } from '@plumora/core';
import solarlunar from 'solarlunar';
import { lunarLabelOf, solarlunarProvider } from '../src/index.js';

describe('TC-LC01 公历 2026-09-25 = 丙午年八月十五（算例 A 场景）', () => {
  const lu = solarlunarProvider.solar2lunar(2026, 9, 25);

  it('农历年月日正确', () => {
    expect(lu).not.toBeNull();
    expect([lu!.lYear, lu!.lMonth, lu!.lDay]).toEqual([2026, 8, 15]);
  });

  it('干支年为丙午', () => {
    expect(lu!.gzYear).toBe('丙午');
  });

  it('月日中文名正确', () => {
    expect(lu!.monthCn).toBe('八月');
    expect(lu!.dayCn).toBe('十五');
  });

  it('lunarLabelOf 输出「丙午年 八月十五」', () => {
    expect(lunarLabelOf(new Date(2026, 8, 25, 12, 0, 0))).toBe('丙午年 八月十五');
  });
});

describe('时间起卦端到端：公历 2026-09-25 午时 → 金标准算例 A', () => {
  const cast = castByTime(new Date(2026, 8, 25, 12, 0, 0), solarlunarProvider);

  it('上卦坎 / 下卦巽 / 动爻 1', () => {
    expect([cast.upper, cast.lower, cast.moving]).toEqual([6, 5, 1]);
  });

  it('中间量 S1 = 30、S2 = 37', () => {
    expect([cast.params.s1, cast.params.s2]).toEqual([30, 37]);
    expect([cast.params.yearBranchNo, cast.params.lunarMonth, cast.params.lunarDay, cast.params.hourNo])
      .toEqual([7, 8, 15, 7]);
  });

  it('起卦标签 = 「丙午年 八月十五 午时」，且不出现重复的「闰」', () => {
    expect(cast.label).toBe('丙午年 八月十五 午时');
    expect(cast.label).not.toContain('闰闰');
  });

  it('卦名 = 水风井', () => {
    expect(`${TRIGRAMS[cast.upper].name}上${TRIGRAMS[cast.lower].name}下`).toBe('坎上巽下');
  });
});

describe('TC-LC03 晚子时（23:00 后按次日日数 + 子时起卦）', () => {
  const late = castByTime(new Date(2026, 8, 25, 23, 30, 0), solarlunarProvider);

  it('shifted 标记为真，时辰序数为 1（子时）', () => {
    expect(late.params.shifted).toBe(true);
    expect(late.params.hourNo).toBe(1);
  });

  it('农历日按次日（八月十六）计算', () => {
    expect(late.params.lunarDay).toBe(16);
  });

  it('与「当日 23:30」直接按十五算的结果不同（证明确实切换了日期）', () => {
    const naive = 7 + 8 + 15 + 1;
    expect(late.params.s2).not.toBe(naive);
  });
});

describe('TC-LC05 时辰边界', () => {
  it('01:00→2、03:00→3、22:00→12、23:00→1', () => {
    expect([hourNumber(1), hourNumber(3), hourNumber(22), hourNumber(23)]).toEqual([2, 3, 12, 1]);
  });

  it('每一时辰的两小时映射一致', () => {
    const pairs: [number, number][] = [
      [23, 0], [1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12],
      [13, 14], [15, 16], [17, 18], [19, 20], [21, 22],
    ];
    pairs.forEach(([a, b], i) => {
      const expected = i === 0 ? 1 : i + 1;
      expect(hourNumber(a), `${a} 时`).toBe(expected);
      expect(hourNumber(b), `${b} 时`).toBe(expected);
    });
  });
});

describe('TC-LC04 春节抽查（公历 → 农历跨年边界）', () => {
  const cases: [number, number, number, string][] = [
    [2024, 2, 10, '正月初一'],
    [2025, 1, 29, '正月初一'],
    [2026, 2, 17, '正月初一'],
    [2020, 1, 25, '正月初一'],
    [2000, 2, 5, '正月初一'],
  ];

  it.each(cases)('%i-%i-%i 为春节（%s）', (y, m, d) => {
    const lu = solarlunarProvider.solar2lunar(y, m, d);
    expect(lu).not.toBeNull();
    expect([lu!.lMonth, lu!.lDay]).toEqual([1, 1]);
  });

  it('春节前一天仍是上一农历年的腊月', () => {
    const eve = solarlunarProvider.solar2lunar(2026, 2, 16);
    expect(eve).not.toBeNull();
    expect(eve!.lYear).toBe(2025);
    expect(eve!.lMonth).toBe(12);
  });
});

describe('超范围与闰月口径', () => {
  it('超出 1900–2100 返回 null（而非抛错）', () => {
    expect(solarlunarProvider.solar2lunar(1899, 1, 1)).toBeNull();
    expect(solarlunarProvider.solar2lunar(2101, 1, 1)).toBeNull();
  });

  it('TC-LC06 闰月按本月份数（03 §6.1）：2025-08-01 = 闰六月初八', () => {
    // 2025 年闰六月。此前这里写成 `monthCn.startsWith('闰') ? 计数 : 1`，
    // 功能坏掉（不以「闰」开头）时三元取常数 1，断言恒真 —— 现已改为直接断言值。
    const lu = solarlunarProvider.solar2lunar(2025, 8, 1);
    expect(lu).not.toBeNull();
    expect(lu!.lYear).toBe(2025);
    expect(lu!.lMonth).toBe(6); // 闰月按**本月份数**，不是 7、不是 6.5
    expect(lu!.lDay).toBe(8);
    expect(lu!.isLeap).toBe(true);
    expect(lu!.monthCn).toBe('闰六月');
    expect(lu!.dayCn).toBe('初八');
    // 月名里的「闰」只出现一次（防「闰闰六月」）
    expect(lu!.monthCn.match(/闰/g)).toHaveLength(1);
  });

  it('闰月与本月的农历月数相同，靠 isLeap 区分', () => {
    const leap = solarlunarProvider.solar2lunar(2025, 8, 1);
    const plain = solarlunarProvider.solar2lunar(2025, 7, 1); // 六月初七
    expect(plain!.lMonth).toBe(6);
    expect(plain!.isLeap).toBe(false);
    expect(leap!.lMonth).toBe(plain!.lMonth);
  });

  it('lMonth 恒为正数（端口约定；负数表示闰月的实现须在此归一）', () => {
    for (const [y, m, d] of [
      [2025, 7, 1],
      [2025, 8, 1],
      [2026, 9, 25],
      [2023, 3, 22], // 2023 年闰二月
    ]) {
      const lu = solarlunarProvider.solar2lunar(y, m, d);
      expect(lu!.lMonth, `${y}-${m}-${d}`).toBeGreaterThan(0);
    }
  });
});

describe('TC-LC07 年支口径：农历年（正月初一为界），非立春干支年', () => {
  /**
   * 立春（约 2/3–2/5）晚于正月初一（约 1/21–2/20），故每年都有一段
   * 「已进农历新年、未到立春」的窗口（约 13 天）。此窗口内 solarlunar 的
   * `gzYear`（立春口径）与本项目采用的 `lYear`（农历年口径）不一致。
   *
   * 起卦算法取 lYear，起卦标签也必须取 lYear 派生的干支年，否则
   * 界面年号与算法年支互相矛盾（同一卦两个答案）。
   */
  const cases: [number, number, number, number, string][] = [
    // 公历年月日, 农历年, 该农历年的干支年（= 标签应显示的年号）
    [2026, 2, 10, 2025, '乙巳'], // 腊月廿三：立春已过(2/4)，农历年仍是乙巳
    [2025, 1, 29, 2025, '乙巳'], // 正月初一：农历年已换，立春未到(2/3)
    [2026, 2, 16, 2025, '乙巳'], // 腊月廿九：农历年乙巳
    [2026, 2, 17, 2026, '丙午'], // 正月初一：进入丙午年
    [2026, 1, 20, 2025, '乙巳'], // 一致区间（对照组）
    [2026, 9, 25, 2026, '丙午'], // 算例 A（对照组）
  ];

  it.each(cases)('%i-%i-%i → 农历年 %i（%s 年）', (y, m, d, lYear) => {
    const lu = solarlunarProvider.solar2lunar(y, m, d);
    expect(lu).not.toBeNull();
    expect(lu!.lYear).toBe(lYear);
  });

  it('标签年号由 lYear 派生，与时间起卦的 cast.label 同源', () => {
    // 2026-02-10：solarlunar 的 gzYear 是「丙午」（立春口径），但农历标签必须是「乙巳」
    const raw = solarlunarProvider.solar2lunar(2026, 2, 10);
    expect(raw!.gzYear).toBe('丙午'); // 原始字段保持立春口径，仅作数据保留
    expect(lunarLabelOf(new Date(2026, 1, 10, 12, 0, 0))).toBe('乙巳年 腊月廿三');

    const cast = castByTime(new Date(2026, 1, 10, 12, 0, 0), solarlunarProvider);
    expect(cast.params.yearBranchNo).toBe(6); // 巳 = 6
    expect(cast.label).toBe('乙巳年 腊月廿三 午时');
    // 关键不变式：标签年号与算法年支必须同源
    expect(cast.label.startsWith('乙巳')).toBe(true);
  });

  it('「甲辰年 正月初一」这类自相矛盾的年号不会再出现', () => {
    // 2025-01-29 是乙巳年正月初一；甲辰年的正月初一在 2024-02-10
    const label = lunarLabelOf(new Date(2025, 0, 29, 12, 0, 0));
    expect(label).toBe('乙巳年 正月初一');
    expect(label).not.toContain('甲辰');
  });

  it('跨立春当天（2025-02-03）标签不变，算法结果不变', () => {
    const before = castByTime(new Date(2025, 1, 2, 12, 0, 0), solarlunarProvider);
    const after = castByTime(new Date(2025, 1, 4, 12, 0, 0), solarlunarProvider);
    // 2/2 与 2/4 分属正月初五、正月初七，年支同为巳
    expect(before.params.yearBranchNo).toBe(6);
    expect(after.params.yearBranchNo).toBe(6);
    expect(before.label.startsWith('乙巳')).toBe(true);
    expect(after.label.startsWith('乙巳')).toBe(true);
  });
});

/**
 * TC-LC08 —— 全范围不变量扫描（1900-01-31 → 2100-12-31，逐日）。
 *
 * 取代 07 文档早期含糊的「抽样 200 条对拍」承诺：这里**穷举全部 73,384 天**，
 * 对每一天做两件事——
 *   ① 不变量断言：农历字段恒在合法域内、闰月月名恰含一个「闰」、干支年两字；
 *   ② **往返一致性**：公历 → 农历 → 公历必须回到原日期（等价于与数据表自洽对拍）。
 * 这比抽 200 条强得多，且不依赖外部实现。跨实现（lunar-java）对拍留待 Android 阶段。
 */
describe('TC-LC08 全范围不变量 + 往返一致性（1900–2100 逐日穷举）', () => {
  /**
   * ⚠️ 扫描发现的上游库缺陷（solarlunar 1.x，本项目只用到 solar→lunar 方向，不影响功能）：
   *
   * `lunar2solar(y, m, d, isLeap)` 内部用 `monthDays(y, m)` 取**本月**天数校验 d，
   * 而 `monthDays` 不区分闰月 —— 当闰月有 30 天、其本月份只有 29 天时，
   * 该闰月的第 30 天会被判为 `d > 本月天数` 而返回 -1。
   *
   * 全范围穷举实测正好 17 例，全部形如「闰月 + 第 30 天」：
   * 1906 闰四月、1914/1952/2047 闰五月、1919/1938/2093 闰七月、1925/1944 闰四月、
   * 1936/1955 闰三月、1941/2017/2036/2055 闰六月、2050 闰三月、2058 闰四月。
   * 抽 200 条样本永远碰不到，逐日穷举才暴露 —— 这正是本条用例存在的理由。
   */
  const ROUND_TRIP_LIB_BUG = 17;

  it('73,384 天逐日扫描：字段合法、闰月标注正确、公↔农往返一致', () => {
    const issues: string[] = [];
    const roundTripFailures: string[] = [];
    let days = 0;
    let leapDays = 0;
    const leapYears = new Set<number>();

    for (let y = 1900; y <= 2100; y += 1) {
      for (let m = 1; m <= 12; m += 1) {
        const dim = new Date(y, m, 0).getDate();
        for (let d = 1; d <= dim; d += 1) {
          // 库下限：1900-01-01 至 01-30 无数据（solarlunar 返回 -1）
          if (y === 1900 && m === 1 && d < 31) continue;

          const lu = solarlunarProvider.solar2lunar(y, m, d);
          const at = `${y}-${m}-${d}`;
          if (!lu) {
            issues.push(`${at} 返回 null`);
            continue;
          }
          days += 1;

          if (!(lu.lYear >= 1900 && lu.lYear <= 2100)) issues.push(`${at} lYear=${lu.lYear}`);
          if (!Number.isInteger(lu.lMonth) || lu.lMonth < 1 || lu.lMonth > 12) {
            issues.push(`${at} lMonth=${lu.lMonth}`);
          }
          if (!Number.isInteger(lu.lDay) || lu.lDay < 1 || lu.lDay > 30) {
            issues.push(`${at} lDay=${lu.lDay}`);
          }
          if (lu.gzYear.length !== 2) issues.push(`${at} gzYear=${lu.gzYear}`);
          if (!lu.monthCn || !lu.dayCn) issues.push(`${at} 月/日中文名为空`);

          const leapCount = (lu.monthCn.match(/闰/g) ?? []).length;
          if (lu.isLeap) {
            leapDays += 1;
            leapYears.add(lu.lYear);
            if (leapCount !== 1) issues.push(`${at} 闰月月名「${lu.monthCn}」的「闰」出现 ${leapCount} 次`);
          } else if (leapCount !== 0) {
            issues.push(`${at} 非闰月但月名含「闰」：${lu.monthCn}`);
          }

          // 年支序数与农历年自洽
          const branchNo = yearBranchNoOf(lu.lYear);
          if (branchNo < 1 || branchNo > 12) issues.push(`${at} 年支序数越界：${branchNo}`);

          // 往返一致性（跳过库下限所在的 1900 年正月）
          if (!(lu.lYear === 1900 && lu.lMonth === 1)) {
            const back = solarlunar.lunar2solar(lu.lYear, lu.lMonth, lu.lDay, lu.isLeap);
            if (!back || back === -1) {
              roundTripFailures.push(`${at} → 农历 ${lu.lYear}-${lu.lMonth}-${lu.lDay}(leap=${lu.isLeap})`);
            } else if (back.cYear !== y || back.cMonth !== m || back.cDay !== d) {
              issues.push(`${at} 往返不一致 → ${back.cYear}-${back.cMonth}-${back.cDay}`);
            }
          }
        }
      }
    }

    // 不变量：一处都不许破
    expect(issues.slice(0, 20)).toEqual([]);
    expect(days).toBe(73384);

    // 往返：只允许上述上游缺陷这一种形态（闰月 + 第 30 天），且数量固定
    expect(roundTripFailures).toHaveLength(ROUND_TRIP_LIB_BUG);
    expect(roundTripFailures.filter((s) => !/leap=true\)$/.test(s))).toEqual([]);
    expect(roundTripFailures.filter((s) => !/-\d+-30\(leap=true\)$/.test(s))).toEqual([]);

    expect(leapDays).toBeGreaterThan(2000);
    // 1900–2100 共 201 年，闰月年数应在合理区间（约每 2–3 年一次）
    expect(leapYears.size).toBeGreaterThan(60);
    expect(leapYears.size).toBeLessThan(120);
  }, 60_000);
});
