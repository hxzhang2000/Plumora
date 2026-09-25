/* ============================================================
 * 金标准算例回归 —— 07 文档 §二
 *
 * 红线（07 文档 §五）：任何起卦结果与金标准算例不符即为 S0。
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { TRIGRAMS } from '@plumora/knowledge';
import { RELATION_CN } from '../src/types.js';
import { resolve } from '../src/resolve.js';

const describeResolved = (upper: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, lower: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, moving: number) => {
  const r = resolve(upper, lower, moving);
  return [
    r.ben.name,
    r.bian.name,
    r.hu.name,
    `${TRIGRAMS[r.ti].name}体${TRIGRAMS[r.yong].name}用`,
    `${RELATION_CN[r.judge.relation]}/${r.judge.degreeCn}`,
  ].join(' | ');
};

describe('金标准算例 A —— 农历 2026 年八月十五午时（坎上巽下，动爻 1）', () => {
  const r = resolve(6, 5, 1);

  it('本卦 = 水风井（坎上巽下）', () => {
    expect(r.ben.name).toBe('水风井');
    expect(r.ben.code).toBe('06-05');
  });

  it('变卦 = 水天需（坎上乾下）', () => {
    expect(r.bian.name).toBe('水天需');
  });

  it('互卦 = 火泽睽（离上兑下），v1.4 更正口径', () => {
    expect(r.hu.name).toBe('火泽睽');
    expect(r.hu.upper).toBe(3);
    expect(r.hu.lower).toBe(2);
  });

  it('体用 = 体坎（水）· 用巽（木）', () => {
    expect(TRIGRAMS[r.ti].name).toBe('坎');
    expect(TRIGRAMS[r.yong].name).toBe('巽');
  });

  it('生克 = 体生用 / 小凶', () => {
    expect(r.judge.relation).toBe('TI_SHENG_YONG');
    expect(r.judge.degreeCn).toBe('小凶');
  });

  it('动爻爻名 = 初六', () => {
    expect(r.movingLineName).toBe('初六');
  });

  it('六爻自下而上 = [0,1,1,0,1,0]（巽 + 坎）', () => {
    expect(r.lines).toEqual([0, 1, 1, 0, 1, 0]);
  });

  it('完整摘要', () => {
    expect(describeResolved(6, 5, 1)).toBe('水风井 | 水天需 | 火泽睽 | 坎体巽用 | 体生用/小凶');
  });
});

describe('金标准算例 B —— 「梅」(11) 「花」(8)，S=6（离上坤下，动爻 1）', () => {
  const r = resolve(3, 8, 1);

  it('本卦 = 火地晋（离上坤下）', () => {
    expect(r.ben.name).toBe('火地晋');
  });

  it('变卦 = 火雷噬嗑（离上震下）', () => {
    expect(r.bian.name).toBe('火雷噬嗑');
  });

  it('互卦 = 水山蹇（坎上艮下），v1.4 更正口径', () => {
    expect(r.hu.name).toBe('水山蹇');
    expect(r.hu.upper).toBe(6);
    expect(r.hu.lower).toBe(7);
  });

  it('体用 = 体离（火）· 用坤（土）', () => {
    expect(TRIGRAMS[r.ti].name).toBe('离');
    expect(TRIGRAMS[r.yong].name).toBe('坤');
  });

  it('生克 = 体生用 / 小凶', () => {
    expect(r.judge.relation).toBe('TI_SHENG_YONG');
    expect(r.judge.degreeCn).toBe('小凶');
  });

  it('六爻自下而上 = [0,0,0,1,0,1]（坤 + 离）', () => {
    expect(r.lines).toEqual([0, 0, 0, 1, 0, 1]);
  });

  it('完整摘要', () => {
    expect(describeResolved(3, 8, 1)).toBe('火地晋 | 火雷噬嗑 | 水山蹇 | 离体坤用 | 体生用/小凶');
  });
});

describe('经典事实验证：水火既济互卦 = 火水未济', () => {
  it('既济互未济', () => {
    expect(resolve(6, 3, 1).hu.name).toBe('火水未济');
  });
});

describe('互卦构造规则（03 文档 §3.4）', () => {
  it('第 2,3,4 爻为互下卦、第 3,4,5 爻为互上卦，3/4 爻复用', () => {
    // 乾为天：六爻全阳 → 互卦仍为乾为天
    expect(resolve(1, 1, 1).hu.name).toBe('乾为天');
    // 坤为地：六爻全阴 → 互卦仍为坤为地
    expect(resolve(8, 8, 6).hu.name).toBe('坤为地');
  });

  it('TC-H03 乾上乾下动 1 → 变卦天风姤、互卦乾为天', () => {
    const r = resolve(1, 1, 1);
    expect(r.bian.name).toBe('天风姤');
    expect(r.hu.name).toBe('乾为天');
  });

  it('TC-H04 坤上坤下动 6 → 变卦山地剥、互卦坤为地', () => {
    const r = resolve(8, 8, 6);
    expect(r.bian.name).toBe('山地剥');
    expect(r.hu.name).toBe('坤为地');
  });

  it('TC-H01 坎上巽下动 1 → 变卦坎上乾下（水天需）', () => {
    expect(resolve(6, 5, 1).bian.name).toBe('水天需');
  });

  it('TC-H02 离上坤下动 1 → 变卦火雷噬嗑、互卦水山蹇', () => {
    const r = resolve(3, 8, 1);
    expect(r.bian.name).toBe('火雷噬嗑');
    expect(r.hu.name).toBe('水山蹇');
  });
});
