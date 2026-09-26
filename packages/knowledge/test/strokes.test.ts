/* ============================================================
 * 笔画全表（strokes.generated.ts + strokes-overrides.ts 装配结果）验收
 *
 * 覆盖点（对应 05 文档 §4.1 查表口径 / §4.2 收字与校验）：
 *   1. 收字域（URO + 扩展 A，与 isHanChar 同口径）逐码点全覆盖、值域 1–84
 *   2. 繁简换面金标准：华/華、後/發 有繁体面
 *   3. 歧义按字面（UAX #38 §3.7.1 case-4a）：后/发 不换面、回退打标
 *   4. 溯源注释与 STROKES_SOURCE（Unicode 18.0 + hwd 对拍）
 * ============================================================ */

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  STROKES,
  STROKES_SOURCE,
  TRADITIONAL_ALIAS,
  isHanChar,
  lookupStrokes,
} from '../src/index.js';

describe('收字域全量覆盖（05 §4.2：域内逐字有值）', () => {
  it('isHanChar 为真的每个码点都能查到笔画且落在 1–84', () => {
    const misses: string[] = [];
    const badValues: string[] = [];
    let seen = 0;
    for (let cp = 0; cp <= 0xffff; cp++) {
      const ch = String.fromCodePoint(cp);
      if (!isHanChar(ch)) continue;
      seen++;
      const r = lookupStrokes(ch, 'SIMPLIFIED');
      if (r === null || r.manual) {
        misses.push(ch);
        continue;
      }
      const entry = STROKES[TRADITIONAL_ALIAS[ch] ?? ch];
      for (const v of [r.strokes, entry.s, entry.t ?? entry.s]) {
        if (!Number.isInteger(v) || v < 1 || v > 84) badValues.push(`${ch}=${v}`);
      }
    }
    // URO（U+4E00–U+9FFF）+ 扩展 A（U+3400–U+4DBF）= 20,992 + 6,592
    expect(seen).toBe(27584);
    expect(misses).toEqual([]);
    expect(badValues).toEqual([]);
  });

  it('收字域之外（扩展 B 等）查不到 → null，不臆造', () => {
    expect(isHanChar('𠀀')).toBe(false);
    expect(lookupStrokes('𠀀', 'SIMPLIFIED')).toBeNull();
    expect(lookupStrokes('𠀀', 'TRADITIONAL', { 𠀀: 12 })?.strokes).toBe(12); // 手动表兜底仍可用
  });
});

describe('繁简换面金标准', () => {
  it('华 s=6 / 華 t=12（经别名归一，两个标准对称）', () => {
    expect(lookupStrokes('华', 'SIMPLIFIED')?.strokes).toBe(6);
    expect(lookupStrokes('华', 'TRADITIONAL')?.strokes).toBe(12);
    expect(lookupStrokes('華', 'SIMPLIFIED')?.strokes).toBe(6);
    expect(lookupStrokes('華', 'TRADITIONAL')?.strokes).toBe(12);
    expect(lookupStrokes('華', 'TRADITIONAL')?.resolvedChar).toBe('华');
    expect(lookupStrokes('華', 'TRADITIONAL')?.fellBackToSimplified).toBe(false);
  });

  it('後 = 简 6 / 繁 9；發 = 简 5 / 繁 12（两字各有自己的键，不靠别名）', () => {
    expect(lookupStrokes('後', 'SIMPLIFIED')?.strokes).toBe(6);
    expect(lookupStrokes('後', 'TRADITIONAL')?.strokes).toBe(9);
    expect(lookupStrokes('發', 'SIMPLIFIED')?.strokes).toBe(5);
    expect(lookupStrokes('發', 'TRADITIONAL')?.strokes).toBe(12);
    expect(lookupStrokes('後', 'TRADITIONAL')?.resolvedChar).toBe('後');
    expect(lookupStrokes('後', 'TRADITIONAL')?.fellBackToSimplified).toBe(false);
  });

  it('观/觀、药/藥、书/書 经别名归一后对称（原 28 例不回归）', () => {
    for (const [simp, trad, s, t] of [
      ['观', '觀', 6, 25],
      ['药', '藥', 9, 19],
      ['书', '書', 4, 10],
    ] as const) {
      expect(lookupStrokes(simp, 'SIMPLIFIED')?.strokes, simp).toBe(s);
      expect(lookupStrokes(simp, 'TRADITIONAL')?.strokes, simp).toBe(t);
      expect(lookupStrokes(trad, 'SIMPLIFIED')?.strokes, trad).toBe(s);
      expect(lookupStrokes(trad, 'TRADITIONAL')?.strokes, trad).toBe(t);
      expect(lookupStrokes(trad, 'TRADITIONAL')?.resolvedChar, trad).toBe(simp);
    }
  });
});

describe('歧义按字面（UAX #38 §3.7.1 case-4a：自身 ∈ 传统面列表 → 不换面）', () => {
  it('后 / 发：传统面歧义 → t 缺省，TRADITIONAL 回退简体并打标', () => {
    const hou = lookupStrokes('后', 'TRADITIONAL');
    expect(hou?.strokes).toBe(6);
    expect(hou?.fellBackToSimplified).toBe(true);
    const fa = lookupStrokes('发', 'TRADITIONAL');
    expect(fa?.strokes).toBe(5);
    expect(fa?.fellBackToSimplified).toBe(true);
    // 字面没有 t 字段（不是「t 恰好等于 s」）
    expect(STROKES['后'].t).toBeUndefined();
    expect(STROKES['发'].t).toBeUndefined();
  });

  it('岐义字不建别名（後/發 不指向 后/发，各自有键）', () => {
    expect(TRADITIONAL_ALIAS['後']).toBeUndefined();
    expect(TRADITIONAL_ALIAS['發']).toBeUndefined();
    expect(STROKES['後']).toBeDefined();
    expect(STROKES['發']).toBeDefined();
    expect(TRADITIONAL_ALIAS['觀']).toBe('观'); // 非歧义对仍建别名
  });
});

describe('溯源（Unicode Unihan + hwd 对拍）', () => {
  it('STROKES_SOURCE 字段齐备且与生成物一致', () => {
    expect(STROKES_SOURCE.unicode).toBe('18.0');
    expect(STROKES_SOURCE.adjudicator).toBe('hanzi-writer-data@2.0.1');
    expect(STROKES_SOURCE.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(STROKES_SOURCE.domainSize).toBe(27584);
    expect(STROKES_SOURCE.keyCount).toBe(Object.keys(STROKES).length);
    expect(STROKES_SOURCE.aliasCount).toBe(Object.keys(TRADITIONAL_ALIAS).length);
    expect(STROKES_SOURCE.keyCount).toBeGreaterThan(24000);
    expect(STROKES_SOURCE.aliasCount).toBeGreaterThan(2000);
  });

  it('生成物文件头含 Unicode 18.0 与 hwd 对拍的溯源注释', () => {
    const src = fs.readFileSync(new URL('../src/strokes.generated.ts', import.meta.url), 'utf8');
    expect(src).toContain('自动生成文件');
    expect(src).toContain('Unicode Unihan 18.0');
    expect(src).toContain('hanzi-writer-data');
    expect(src).toContain('strokes-overrides.ts');
  });

  it('运行时不可变：STROKES / 别名表 / 条目逐层冻结（C-9）', () => {
    expect(Object.isFrozen(STROKES)).toBe(true);
    expect(Object.isFrozen(STROKES['華'] ?? STROKES['华'])).toBe(true);
    expect(Object.isFrozen(TRADITIONAL_ALIAS)).toBe(true);
    expect(Object.isFrozen(STROKES_SOURCE)).toBe(true);
    expect(() => {
      (STROKES as unknown as Record<string, unknown>)['梅'] = {};
    }).toThrow(TypeError);
  });
});
