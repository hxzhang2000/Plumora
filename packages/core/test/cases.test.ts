/* ============================================================
 * 单元测试用例 —— 07 文档 §3.1–§3.5 逐条对拍
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { TRIGRAMS, lookupStrokes } from '@plumora/knowledge';
import {
  castByCharacter,
  castByNumber,
  castByRandom,
  castByTimeParts,
  ganzhiYearOf,
  inputParamsOf,
  modMoving,
  modTrigram,
  hourNumber,
  yearBranchNoOf,
} from '../src/index.js';
import { resolve } from '../src/resolve.js';
import { lineNames } from '../src/line.js';
import { judge } from '../src/judge.js';
import { CastInputError } from '../src/casters.js';

const T = (u: number, l: number, m: number) =>
  `${TRIGRAMS[u as 1].name}/${TRIGRAMS[l as 1].name}/${m}`;

describe('§3.1 起卦计算', () => {
  it('TC-T01 Y7 M8 D15 H7（算例 A）→ 坎/巽/1', () => {
    const r = castByTimeParts(7, 8, 15, 7);
    expect(T(r.upper, r.lower, r.moving)).toBe('坎/巽/1');
    expect([r.params.s1, r.params.s2]).toEqual([30, 37]);
  });

  it('TC-T02 Y1 M1 D1 H1 → S1=3 离；S2=4 震；动爻 4', () => {
    const r = castByTimeParts(1, 1, 1, 1);
    expect(r.params.s1).toBe(3);
    expect(r.params.s2).toBe(4);
    expect(T(r.upper, r.lower, r.moving)).toBe('离/震/4');
  });

  it('TC-T03 Y12 M12 D30 H12（最大常规）→ S1=54 坎；S2=66 兑；动爻 6', () => {
    const r = castByTimeParts(12, 12, 30, 12);
    expect([r.params.s1, r.params.s2]).toEqual([54, 66]);
    expect(T(r.upper, r.lower, r.moving)).toBe('坎/兑/6');
  });

  it('TC-N01 两数 3、8 → 离/坤/动爻 5', () => {
    const r = castByNumber(3, 8);
    expect(T(r.upper, r.lower, r.moving)).toBe('离/坤/5');
    expect(r.params.mode).toBe('TWO');
  });

  it('TC-N02 两数 8、8 → 坤/坤/动爻 4', () => {
    expect(T(...pick(castByNumber(8, 8)))).toBe('坤/坤/4');
  });

  it('TC-N03 两数 24、24 → 坤（0 取 8）/坤/动爻 6（0 取 6）', () => {
    expect(T(...pick(castByNumber(24, 24)))).toBe('坤/坤/6');
  });

  it('TC-N04 一数起卦已移除：仅传一个数（第二数缺失）→ CastInputError', () => {
    expect(() => castByNumber(9, null as unknown as number)).toThrow(CastInputError);
    expect(() => castByNumber(9, undefined as unknown as number)).toThrow(/第二数无效/);
  });

  it('TC-C01 梅(11)/花(8) 繁体，S=6（算例 B）→ 离/坤/动爻 1', () => {
    const r = castByCharacter({
      strokes: [11, 8], chars: ['梅', '花'], standard: 'TRADITIONAL', second: 6,
    });
    expect(T(r.upper, r.lower, r.moving)).toBe('离/坤/1');
  });

  it('TC-C02 笔画 8/8，S=0 → 坤/坤/动爻 4', () => {
    const r = castByCharacter({ strokes: [8, 8], chars: ['甲', '乙'], standard: 'SIMPLIFIED', second: 0 });
    expect(T(r.upper, r.lower, r.moving)).toBe('坤/坤/4');
    expect(r.params.sum).toBe(16);
  });

  it('TC-C03 一字起卦已移除：单字输入 → CastInputError（汉字数须为 2 个）', () => {
    expect(() => castByCharacter({ strokes: [16], chars: ['甲'], standard: 'SIMPLIFIED' }))
      .toThrow(CastInputError);
    expect(() => castByCharacter({ strokes: [16], chars: ['甲'], standard: 'SIMPLIFIED' }))
      .toThrow(/汉字数须为 2 个/);
  });

  it('TC-C04 两字 A=2、B=2，S=2 → 动爻 6（6 mod 6 = 0 取 6）', () => {
    expect(castByCharacter({ strokes: [2, 2], chars: ['甲', '乙'], standard: 'SIMPLIFIED', second: 2 }).moving).toBe(6);
  });

  it('TC-C05 两字 A=1、B=1，S=59 → 动爻 1，秒钟边界不溢出', () => {
    expect(castByCharacter({ strokes: [1, 1], chars: ['甲', '乙'], standard: 'SIMPLIFIED', second: 59 }).moving).toBe(1);
  });

  it('TC-C06 同一组字（11/8）S=1 与 S=6 → 动爻分别 2 与 1', () => {
    const a = castByCharacter({ strokes: [11, 8], chars: ['梅', '花'], standard: 'TRADITIONAL', second: 1 });
    const b = castByCharacter({ strokes: [11, 8], chars: ['梅', '花'], standard: 'TRADITIONAL', second: 6 });
    expect(a.moving).toBe(2);
    expect(b.moving).toBe(1);
    // inputParams 必须记录 second 才能复现
    expect((inputParamsOf(a) as { second: number }).second).toBe(1);
  });

  it('TC-B01 大数 999999999、999999999 不溢出，结果确定', () => {
    const r = castByNumber(999_999_999, 999_999_999);
    expect(r.params.sum).toBe(1_999_999_998);
    expect(r.moving).toBe(modMoving(1_999_999_998));
    expect(r.moving).toBe(6);
  });

  it('输入边界：0 / 负数 / 超上限 / 非整数一律拒绝（03 §6.3）', () => {
    expect(() => castByNumber(0, 8)).toThrow(CastInputError);
    expect(() => castByNumber(-3, 8)).toThrow(CastInputError);
    expect(() => castByNumber(1_000_000_000, 8)).toThrow(CastInputError);
    expect(() => castByNumber(1.5, 8)).toThrow(CastInputError);
    // 第二数同样受约束（原由声音起卦的用例覆盖，声音移除后补在这里）
    expect(() => castByNumber(8, 0)).toThrow(CastInputError);
    expect(() => castByNumber(8, -3)).toThrow(CastInputError);
    expect(() => castByNumber(8, 1.5)).toThrow(CastInputError);
  });
});

describe('§3.2 卦象推导', () => {
  it('TC-TY01 动爻 3 → 下卦为用、上卦为体', () => {
    const r = resolve(1, 8, 3);
    expect(r.ti).toBe(1);
    expect(r.yong).toBe(8);
  });

  it('TC-TY02 动爻 4 → 上卦为用、下卦为体', () => {
    const r = resolve(1, 8, 4);
    expect(r.ti).toBe(8);
    expect(r.yong).toBe(1);
  });

  it('TC-LN01 六爻 [1,0,0,1,0,0] → 初九、六二、六三、九四、六五、上六', () => {
    expect(lineNames([1, 0, 0, 1, 0, 0]).join('、')).toBe('初九、六二、六三、九四、六五、上六');
  });

  it('变卦六爻 = 动爻取反，其余不变', () => {
    const r = resolve(6, 5, 1);
    expect(r.lines).toEqual([0, 1, 1, 0, 1, 0]);
    expect(r.changedLines).toEqual([1, 1, 1, 0, 1, 0]);
  });
});

describe('§3.3 五行生克', () => {
  const J = (a: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, b: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) => {
    const r = judge(TRIGRAMS[a], TRIGRAMS[b]);
    return `${r.relation}/${r.degreeCn}`;
  };

  it('TC-F01 坎(水)/巽(木) → 体生用 / 小凶', () => expect(J(6, 5)).toBe('TI_SHENG_YONG/小凶'));
  it('TC-F02 巽(木)/坎(水) → 用生体 / 大吉', () => expect(J(5, 6)).toBe('YONG_SHENG_TI/大吉'));
  it('TC-F03 乾(金)/巽(木) → 体克用 / 小吉', () => expect(J(1, 5)).toBe('TI_KE_YONG/小吉'));
  it('TC-F04 巽(木)/乾(金) → 用克体 / 大凶', () => expect(J(5, 1)).toBe('YONG_KE_TI/大凶'));
  it('TC-F05 坎/坎 → 比和 / 吉', () => expect(J(6, 6)).toBe('BI_HE/吉'));

  it('TC-F07 切为「上用下体」后重算算例 A → 体巽、用坎，用生体 / 大吉', () => {
    const r = resolve(6, 5, 1, 'UPPER_YONG_LOWER_TI');
    expect(TRIGRAMS[r.ti].name).toBe('巽');
    expect(TRIGRAMS[r.yong].name).toBe('坎');
    expect(`${r.judge.relation}/${r.judge.degreeCn}`).toBe('YONG_SHENG_TI/大吉');
  });

  it('TC-F06 全 25 组合穷举无遗漏分支', () => {
    const elems = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as const;
    const seen = new Set<string>();
    for (const a of elems) {
      for (const b of elems) {
        const r = judge({ element: a } as never, { element: b } as never);
        seen.add(r.relation);
        expect(['DA_JI', 'XIAO_JI', 'JI', 'XIAO_XIONG', 'DA_XIONG']).toContain(r.degree);
      }
    }
    expect(seen.size).toBe(5);
  });
});

describe('§3.5 笔画查询（05 文档 §4.1 口径）', () => {
  it('TC-ST01 梅（繁体）→ 11', () => {
    expect(lookupStrokes('梅', 'TRADITIONAL')?.strokes).toBe(11);
  });
  it('TC-ST02 花（繁体）→ 8', () => {
    expect(lookupStrokes('花', 'TRADITIONAL')?.strokes).toBe(8);
  });
  it('TC-ST03 观 / 觀 → 简体 6 / 繁体 25', () => {
    expect(lookupStrokes('观', 'SIMPLIFIED')?.strokes).toBe(6);
    expect(lookupStrokes('观', 'TRADITIONAL')?.strokes).toBe(25);
  });
  it('TC-ST04 收字域之外的字返回 null，不抛异常', () => {
    // 收字域 = URO + 扩展 A（域内已全量收录）；扩展 B 的 𠀀 不在域内 → null
    expect(lookupStrokes('𠀀', 'SIMPLIFIED')).toBeNull();
    expect(lookupStrokes('龘', 'SIMPLIFIED')).not.toBeNull(); // 域内字（原 MVP 表 miss 用例，现全量收录）
  });
  it('繁体缺省时回退简体并打标', () => {
    const r = lookupStrokes('山', 'TRADITIONAL');
    expect(r?.strokes).toBe(3);
    expect(r?.fellBackToSimplified).toBe(true);
  });
});

describe('取余与时辰边界（03 §1.2 / §6.2）', () => {
  it('modTrigram 余 0 取 8', () => {
    expect([modTrigram(8), modTrigram(16), modTrigram(9), modTrigram(1)]).toEqual([8, 8, 1, 1]);
  });
  it('modMoving 余 0 取 6', () => {
    expect([modMoving(6), modMoving(12), modMoving(7), modMoving(1)]).toEqual([6, 6, 1, 1]);
  });
  it('TC-LC05 时辰序数边界：01:00→2、03:00→3、22:00→12、23:00→1、00:00→1', () => {
    expect([hourNumber(1), hourNumber(3), hourNumber(22), hourNumber(23), hourNumber(0)]).toEqual([2, 3, 12, 1, 1]);
  });
});

/** 从 CastResult 里取 [upper, lower, moving] 三元组 */
function pick(r: { upper: number; lower: number; moving: number }): [number, number, number] {
  return [r.upper, r.lower, r.moving];
}

/* ============================================================
 * 代码审查修复回归（报告 2026-09-25）
 * ============================================================ */

describe('C-1 年支与干支年标签同源（农历年口径，非立春）', () => {
  it('yearBranchNoOf：子=1 … 亥=12', () => {
    expect(yearBranchNoOf(2026)).toBe(7); // 丙午 → 午 = 7
    expect(yearBranchNoOf(2025)).toBe(6); // 乙巳 → 巳 = 6
    expect(yearBranchNoOf(2024)).toBe(5); // 甲辰 → 辰 = 5
    expect(yearBranchNoOf(2020)).toBe(1); // 庚子 → 子 = 1
  });

  it('ganzhiYearOf 与 yearBranchNoOf 同源（地支必须一致）', () => {
    const ZHI = '子丑寅卯辰巳午未申酉戌亥';
    for (let y = 1900; y <= 2100; y += 1) {
      const gz = ganzhiYearOf(y);
      expect(gz).toHaveLength(2);
      expect(ZHI.indexOf(gz[1]) + 1, `${y} → ${gz}`).toBe(yearBranchNoOf(y));
    }
  });

  it('已知年份的干支年正确', () => {
    expect(ganzhiYearOf(2026)).toBe('丙午');
    expect(ganzhiYearOf(2025)).toBe('乙巳');
    expect(ganzhiYearOf(2024)).toBe('甲辰');
    expect(ganzhiYearOf(1984)).toBe('甲子');
    expect(ganzhiYearOf(2000)).toBe('庚辰');
  });
});

describe('C-5 随机起卦：随机源越界时响亮失败，不再被 as 断言掩盖', () => {
  it('合法随机源产出恒在 1–8 / 1–6 区间', () => {
    for (let i = 0; i < 200; i += 1) {
      const r = castByRandom(Math.random);
      expect(r.upper).toBeGreaterThanOrEqual(1);
      expect(r.upper).toBeLessThanOrEqual(8);
      expect(r.lower).toBeGreaterThanOrEqual(1);
      expect(r.lower).toBeLessThanOrEqual(8);
      expect(r.moving).toBeGreaterThanOrEqual(1);
      expect(r.moving).toBeLessThanOrEqual(6);
    }
  });

  it('边界值 0 与 0.999… 分别取到 1 与 max', () => {
    const lo = castByRandom(() => 0);
    expect([lo.upper, lo.lower, lo.moving]).toEqual([1, 1, 1]);
    const hi = castByRandom(() => 0.9999999);
    expect([hi.upper, hi.lower, hi.moving]).toEqual([8, 8, 6]);
  });

  it('随机源返回 1 / 越界 / NaN 一律拒绝（旧实现会产出 upper=9、moving=7）', () => {
    expect(() => castByRandom(() => 1)).toThrow(CastInputError);
    expect(() => castByRandom(() => 1.5)).toThrow(CastInputError);
    expect(() => castByRandom(() => -0.1)).toThrow(CastInputError);
    expect(() => castByRandom(() => Number.NaN)).toThrow(CastInputError);
    expect(() => castByRandom(() => Number.POSITIVE_INFINITY)).toThrow(CastInputError);
  });
});

describe('C-6 非整数一律拒绝（不再静默截断）', () => {
  it('时间起卦：月 / 日 / 时 / 年支非整数均拒绝', () => {
    expect(() => castByTimeParts(7, 8, 15.5, 7)).toThrow(CastInputError);
    expect(() => castByTimeParts(7, 8.5, 15, 7)).toThrow(CastInputError);
    expect(() => castByTimeParts(7, 8, 15, 7.5)).toThrow(CastInputError);
    expect(() => castByTimeParts(7.5, 8, 15, 7)).toThrow(CastInputError);
  });

  it('合法整数仍照常通过（防过度收紧）', () => {
    expect(() => castByTimeParts(7, 8, 15, 7)).not.toThrow();
    expect(() => castByNumber(9, 7)).not.toThrow();
  });
});

describe('C-7 castByCharacter：chars 与 strokes 必须一一对应', () => {
  it('长度不一致拒绝（合法两字输入 + 笔画数不等长 → 旧实现会静默丢字或渲染 undefined）', () => {
    expect(() =>
      castByCharacter({ strokes: [11, 8], chars: ['梅'], standard: 'TRADITIONAL', second: 0 }),
    ).toThrow(CastInputError);
    expect(() =>
      castByCharacter({ strokes: [16], chars: ['梅', '花'], standard: 'SIMPLIFIED', second: 0 }),
    ).toThrow(CastInputError);
    expect(() =>
      castByCharacter({ strokes: [], chars: ['梅', '花'], standard: 'SIMPLIFIED', second: 0 }),
    ).toThrow(CastInputError);
  });

  it('超过两字拒绝', () => {
    expect(() =>
      castByCharacter({ strokes: [1, 2, 3], chars: ['甲', '乙', '丙'], standard: 'SIMPLIFIED', second: 0 }),
    ).toThrow(CastInputError);
  });

  it('两字正常用例不受影响', () => {
    expect(castByCharacter({ strokes: [11, 8], chars: ['梅', '花'], standard: 'TRADITIONAL', second: 6 }).moving).toBe(1);
  });
});

describe('C-8 inputParams 落库晚子时标记', () => {
  it('shifted=false 的时间起卦也显式落库', () => {
    const p = inputParamsOf(castByTimeParts(7, 8, 15, 7));
    expect(p).toEqual({
      type: 'TIME',
      yearBranchNo: 7,
      lunarMonth: 8,
      lunarDay: 15,
      hourNo: 7,
      shifted: false,
    });
  });

  it('shifted=true 时落库为 true（晚子时与次日 00:30 可区分）', () => {
    const p = inputParamsOf(castByTimeParts(7, 1, 1, 1, { shifted: true }));
    expect((p as { shifted?: boolean }).shifted).toBe(true);
  });

  it('JSON 往返后标记不丢（详情页据此复盘「按次日计」）', () => {
    const p = inputParamsOf(castByTimeParts(7, 1, 1, 1, { shifted: true }));
    expect(JSON.parse(JSON.stringify(p))).toMatchObject({ type: 'TIME', shifted: true });
  });
});
