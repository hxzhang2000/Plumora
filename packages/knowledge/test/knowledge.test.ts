/* ============================================================
 * 知识库完整性校验 —— 05 文档 §3.2 速查表 / §3.4 校验规则 / §2.2 类象表
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import {
  HEXAGRAMS,
  STROKES,
  TRADITIONAL_ALIAS,
  TRIGRAM_CATEGORIES,
  TRIGRAM_LIST,
  TRIGRAMS,
  binaryToLines,
  getHexagram,
  getHexagramByCode,
  hexCodeOf,
  lookupStrokes,
  normalizeHexCode,
  validateKnowledgeBase,
} from '../src/index.js';

/** 05 文档 §3.2 六十四卦速查表（行 = 上卦，列 = 下卦），作为录入完整性的独立验收清单 */
const TABLE: readonly (readonly string[])[] = [
  ['乾为天', '天泽履', '天火同人', '天雷无妄', '天风姤', '天水讼', '天山遁', '天地否'],
  ['泽天夬', '兑为泽', '泽火革', '泽雷随', '泽风大过', '泽水困', '泽山咸', '泽地萃'],
  ['火天大有', '火泽睽', '离为火', '火雷噬嗑', '火风鼎', '火水未济', '火山旅', '火地晋'],
  ['雷天大壮', '雷泽归妹', '雷火丰', '震为雷', '雷风恒', '雷水解', '雷山小过', '雷地豫'],
  ['风天小畜', '风泽中孚', '风火家人', '风雷益', '巽为风', '风水涣', '风山渐', '风地观'],
  ['水天需', '水泽节', '水火既济', '水雷屯', '水风井', '坎为水', '水山蹇', '水地比'],
  ['山天大畜', '山泽损', '山火贲', '山雷颐', '山风蛊', '山水蒙', '艮为山', '山地剥'],
  ['地天泰', '地泽临', '地火明夷', '地雷复', '地风升', '地水师', '地山谦', '坤为地'],
];

describe('05 §3.4 校验规则', () => {
  it('全量校验零问题', () => {
    expect(validateKnowledgeBase()).toEqual([]);
  });

  it('规则 1：恰好 64 条、卦名唯一、覆盖 8×8 全组合', () => {
    expect(Object.keys(HEXAGRAMS)).toHaveLength(64);
    expect(new Set(Object.values(HEXAGRAMS).map((h) => h.name)).size).toBe(64);
  });

  it('规则 3：binary == lower.binary | upper.binary << 3', () => {
    for (const h of Object.values(HEXAGRAMS)) {
      expect(h.binary, h.name).toBe(TRIGRAMS[h.lower].binary | (TRIGRAMS[h.upper].binary << 3));
    }
  });

  it('规则 4：keywords 非空且 1–5 条（水火既济原文仅 1 条）', () => {
    for (const h of Object.values(HEXAGRAMS)) {
      expect(h.keywords.length, h.name).toBeGreaterThanOrEqual(1);
      expect(h.keywords.length, h.name).toBeLessThanOrEqual(5);
    }
    expect(getHexagram(6, 3).keywords).toEqual(['已经完成']);
  });

  it('§3.1 示例：水风井 binary = 22（不是周易卦序 48）', () => {
    const jing = getHexagram(6, 5);
    expect(jing.name).toBe('水风井');
    expect(jing.binary).toBe(22);
  });
});

describe('05 §3.2 速查表逐格对拍', () => {
  it('64 格卦名与表一致', () => {
    const mismatches: string[] = [];
    TABLE.forEach((row, ui) => {
      row.forEach((expected, li) => {
        const code = hexCodeOf((ui + 1) as 1, (li + 1) as 1);
        const actual = HEXAGRAMS[code]?.name;
        if (actual !== expected) mismatches.push(`${code}: 表=${expected} 数据=${actual}`);
      });
    });
    expect(mismatches).toEqual([]);
  });

  it('字序易混的两卦各自正确（山水蒙 / 水山蹇）', () => {
    expect(getHexagram(7, 6).name).toBe('山水蒙');
    expect(getHexagram(6, 7).name).toBe('水山蹇');
    expect(getHexagram(7, 6).keywords).toContain('启蒙');
    expect(getHexagram(6, 7).keywords).toContain('跛脚');
  });
});

describe('简称（8×8 速查格用）', () => {
  it('重卦取首字，其余去掉上下卦前缀', () => {
    expect(getHexagram(1, 1).shortName).toBe('乾');
    expect(getHexagram(8, 8).shortName).toBe('坤');
    expect(getHexagram(6, 5).shortName).toBe('井');
    expect(getHexagram(3, 2).shortName).toBe('睽');
    expect(getHexagram(6, 3).shortName).toBe('既济');
    expect(getHexagram(3, 6).shortName).toBe('未济');
    expect(getHexagram(4, 7).shortName).toBe('小过');
    expect(getHexagram(2, 5).shortName).toBe('大过');
  });

  it('64 个简称全部非空', () => {
    for (const h of Object.values(HEXAGRAMS)) {
      expect(h.shortName.length, h.name).toBeGreaterThan(0);
    }
  });
});

describe('05 §2.2 八卦类象表', () => {
  it('先天数与位编码（03 §1.1）', () => {
    const expected: Record<number, [string, number]> = {
      1: ['乾', 0b111], 2: ['兑', 0b011], 3: ['离', 0b101], 4: ['震', 0b001],
      5: ['巽', 0b110], 6: ['坎', 0b010], 7: ['艮', 0b100], 8: ['坤', 0b000],
    };
    for (const [n, [name, bin]] of Object.entries(expected)) {
      expect(TRIGRAMS[Number(n) as 1].name).toBe(name);
      expect(TRIGRAMS[Number(n) as 1].binary).toBe(bin);
    }
  });

  it('五行归属：乾兑金、离火、震巽木、坎水、艮坤土', () => {
    expect(TRIGRAM_LIST.map((t) => t.element)).toEqual([
      'METAL', 'METAL', 'FIRE', 'WOOD', 'WOOD', 'WATER', 'EARTH', 'EARTH',
    ]);
  });

  it('艮行静物含「土石之物」（v1.4 补齐的缺失格）', () => {
    expect(TRIGRAMS[7].objects).toContain('土石之物');
  });

  it('类目名称与 05 §2.2 表头一致', () => {
    expect(TRIGRAM_CATEGORIES.map((c) => c.label)).toEqual([
      '人伦', '天时', '地理', '身体', '动物', '静物', '性情人事', '方位', '时令', '五味',
    ]);
  });

  it('八行类象均非空（无缺格）', () => {
    for (const t of TRIGRAM_LIST) {
      for (const c of TRIGRAM_CATEGORIES) {
        expect(String(t[c.key]).trim().length, `${t.name}.${String(c.key)}`).toBeGreaterThan(0);
      }
    }
  });

  it('binaryToLines 自下而上（乾 = [1,1,1]，震 = [1,0,0]）', () => {
    expect(binaryToLines(0b111)).toEqual([1, 1, 1]);
    expect(binaryToLines(0b001)).toEqual([1, 0, 0]);
    expect(binaryToLines(0b000)).toEqual([0, 0, 0]);
  });
});

describe('卦辞 / 爻辞数据完整性（《周易正義》维基文库录入）', () => {
  it('64 条 guaci 均非 null', () => {
    for (const h of Object.values(HEXAGRAMS)) {
      expect(h.guaci, h.name).not.toBeNull();
    }
  });

  it('64 条 lines 均非 null 且各含 6 条爻辞', () => {
    for (const h of Object.values(HEXAGRAMS)) {
      expect(h.lines, h.name).not.toBeNull();
      expect(h.lines?.length, h.name).toBe(6);
    }
  });

  it('仅乾（用九）、坤（用六）有 yongText，其余为 null', () => {
    for (const h of Object.values(HEXAGRAMS)) {
      if (h.code === '01-01' || h.code === '08-08') {
        expect(h.yongText, h.name).not.toBeNull();
      } else {
        expect(h.yongText, h.name).toBeNull();
      }
    }
  });

  it('爻辞 index 恒为 1–6 且 name 非空', () => {
    for (const h of Object.values(HEXAGRAMS)) {
      for (const line of h.lines!) {
        expect(line.index, h.name).toBeGreaterThanOrEqual(1);
        expect(line.index, h.name).toBeLessThanOrEqual(6);
        expect(line.name.length, h.name).toBeGreaterThan(0);
        expect(line.text.length, h.name).toBeGreaterThan(0);
      }
    }
  });
});

describe('传注层数据完整性（彖传/大象传/文言，《周易正义》维基文库录入）', () => {
  it('64 条 tuan 均非 undefined 且非空串', () => {
    for (const h of Object.values(HEXAGRAMS)) {
      expect(h.tuan, h.name).toBeDefined();
      expect(h.tuan!.length, h.name).toBeGreaterThan(0);
    }
  });

  it('64 条 daxiang 均非 undefined 且非空串', () => {
    for (const h of Object.values(HEXAGRAMS)) {
      expect(h.daxiang, h.name).toBeDefined();
      expect(h.daxiang!.length, h.name).toBeGreaterThan(0);
    }
  });

  it('仅乾（01-01）、坤（08-08）有 wenyan，其余为 undefined', () => {
    for (const h of Object.values(HEXAGRAMS)) {
      if (h.code === '01-01' || h.code === '08-08') {
        expect(h.wenyan, h.name).toBeDefined();
        expect(h.wenyan!.length, h.name).toBeGreaterThan(0);
      } else {
        expect(h.wenyan, h.name).toBeUndefined();
      }
    }
  });

  it('小象（xiaoxiang）已入库（252/384 爻辞有小象）', () => {
    let hexWithXiaoxiang = 0;
    let totalEntries = 0;
    for (const h of Object.values(HEXAGRAMS)) {
      if (h.xiaoxiang) {
        hexWithXiaoxiang++;
        totalEntries += Object.keys(h.xiaoxiang).length;
      }
    }
    // 62 卦有小象数据，共 252 条爻辞小象
    expect(hexWithXiaoxiang).toBeGreaterThan(60);
    expect(totalEntries).toBeGreaterThan(200);
  });
});

describe('C-2 卦代码口径：两段各两位、不足补零', () => {
  it('hexCodeOf 恒产出两位段（04 §2.2 / §2.5 / 05 §3.1 的「06-05」写法）', () => {
    expect(hexCodeOf(6, 5)).toBe('06-05');
    expect(hexCodeOf(1, 1)).toBe('01-01');
    expect(hexCodeOf(8, 8)).toBe('08-08');
    expect(getHexagram(6, 5).code).toBe('06-05');
  });

  it('全部 64 个 code 都是 /^\\d{2}-\\d{2}$/ 且与 upper/lower 自洽', () => {
    for (const h of Object.values(HEXAGRAMS)) {
      expect(h.code, h.name).toMatch(/^\d{2}-\d{2}$/);
      expect(h.code).toBe(hexCodeOf(h.upper, h.lower));
    }
  });

  it('按字典序排序等价于按数值序排序（补零的意义）', () => {
    const codes = Object.keys(HEXAGRAMS).slice().sort();
    expect(codes[0]).toBe('01-01');
    expect(codes[codes.length - 1]).toBe('08-08');
    expect(codes).toEqual([...codes].sort((a, b) => {
      const [au, al] = a.split('-').map(Number);
      const [bu, bl] = b.split('-').map(Number);
      return au - bu || al - bl;
    }));
  });

  it('normalizeHexCode 兼容非补零写法，非法形态原样返回', () => {
    expect(normalizeHexCode('6-5')).toBe('06-05');
    expect(normalizeHexCode(' 6-5 ')).toBe('06-05');
    expect(normalizeHexCode('06-05')).toBe('06-05');
    expect(normalizeHexCode('9-5')).toBe('9-5');
    expect(normalizeHexCode('abc')).toBe('abc');
  });

  it('getHexagramByCode 同时接受补零与非补零写法（读历史数据不炸）', () => {
    expect(getHexagramByCode('06-05')?.name).toBe('水风井');
    expect(getHexagramByCode('6-5')?.name).toBe('水风井');
    expect(getHexagramByCode('09-09')).toBeUndefined();
  });
});

describe('C-3 繁体字面查笔画（05 §4.1：繁体字面也是合法输入）', () => {
  it('繁体字面经别名归一后取繁体笔画', () => {
    expect(lookupStrokes('觀', 'TRADITIONAL')?.strokes).toBe(25);
    expect(lookupStrokes('藥', 'TRADITIONAL')?.strokes).toBe(19);
    expect(lookupStrokes('書', 'TRADITIONAL')?.strokes).toBe(10);
    expect(lookupStrokes('門', 'TRADITIONAL')?.strokes).toBe(8);
    expect(lookupStrokes('風', 'TRADITIONAL')?.strokes).toBe(9);
  });

  it('繁体字面 + 简体标准 → 简体笔画（与简体字面结果对称）', () => {
    expect(lookupStrokes('觀', 'SIMPLIFIED')?.strokes).toBe(6);
    expect(lookupStrokes('觀', 'SIMPLIFIED')?.strokes).toBe(
      lookupStrokes('观', 'SIMPLIFIED')?.strokes,
    );
    expect(lookupStrokes('觀', 'TRADITIONAL')?.strokes).toBe(
      lookupStrokes('观', 'TRADITIONAL')?.strokes,
    );
  });

  it('resolvedChar 暴露归一结果，便于 UI 提示与排错', () => {
    expect(lookupStrokes('觀', 'TRADITIONAL')?.resolvedChar).toBe('观');
    expect(lookupStrokes('梅', 'TRADITIONAL')?.resolvedChar).toBe('梅');
  });

  it('别名表只指向真实存在的简体表键，且该键确有繁体笔画', () => {
    for (const [trad, simp] of Object.entries(TRADITIONAL_ALIAS)) {
      expect(STROKES[simp], `${trad} → ${simp}`).toBeDefined();
      expect(STROKES[simp].t, `${trad} → ${simp} 缺 t`).toBeTypeOf('number');
      expect(trad).not.toBe(simp);
    }
  });

  it('未收录（收字域之外）的字仍返回 null（不臆造笔画）', () => {
    // 收字域 = URO + 扩展 A（域内 100% 收录），域外字如扩展 B 的 𠀀 查不到就该 null
    expect(lookupStrokes('𠀀', 'TRADITIONAL')).toBeNull();
    expect(lookupStrokes('龘', 'TRADITIONAL')).not.toBeNull(); // 域内字已全量收录（原 MVP 表的 miss 用例）
  });
});

describe('C-9 知识库运行时不可变（readonly 只在编译期）', () => {
  it('TRIGRAMS / HEXAGRAMS / STROKES / 类目表均已 Object.freeze', () => {
    expect(Object.isFrozen(TRIGRAMS)).toBe(true);
    expect(Object.isFrozen(TRIGRAMS[1])).toBe(true);
    expect(Object.isFrozen(TRIGRAM_LIST)).toBe(true);
    expect(Object.isFrozen(TRIGRAM_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(TRIGRAM_CATEGORIES[0])).toBe(true);
    expect(Object.isFrozen(HEXAGRAMS)).toBe(true);
    expect(Object.isFrozen(getHexagram(6, 5))).toBe(true);
    expect(Object.isFrozen(getHexagram(6, 5).keywords)).toBe(true);
    expect(Object.isFrozen(STROKES)).toBe(true);
    expect(Object.isFrozen(STROKES['梅'])).toBe(true);
    expect(Object.isFrozen(TRADITIONAL_ALIAS)).toBe(true);
  });

  it('改写被静默拒绝（非严格模式）或抛错（严格模式），不会污染全局知识库', () => {
    const before = getHexagram(6, 5).keywords.join('、');
    expect(() => {
      // 故意越权写入：ESM 是严格模式，冻结对象赋值会抛 TypeError
      (getHexagram(6, 5) as unknown as { keywords: string[] }).keywords = ['被污染'];
    }).toThrow(TypeError);
    expect(getHexagram(6, 5).keywords.join('、')).toBe(before);
  });
});
