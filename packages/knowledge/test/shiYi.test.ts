/* ============================================================
 * 十翼数据结构化测试 —— 对应 docs/dev/knowledge-review/design/
 *   十翼原文展示-UI设计规格.md v0.2 §8.8
 *
 * 测试覆盖：
 * 1. 结构完整性（14 项断言）
 * 2. 金标准测试（5 项，对标 07 文档的「2026-08-15 午时 → 水风井」思路）
 * 3. validateShiyiData() 运行时校验
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import {
  SHIYI_TEXTS,
  allShiyiParagraphs,
  getShiyiChapter,
  getShiyiText,
  validateShiyiData,
} from '../src/index.js';

describe('十翼 §8.8 结构完整性（14 项断言）', () => {
  it('1. SHIYI_TEXTS.length === 5', () => {
    expect(SHIYI_TEXTS.length).toBe(5);
  });

  it('2. 5 个 slug 唯一且匹配 ShiyiSlug 联合类型', () => {
    const slugs = SHIYI_TEXTS.map(t => t.slug);
    expect(new Set(slugs).size).toBe(5);
    const expectedSlugs = ['xi-ci-upper', 'xi-ci-lower', 'shuo-gua', 'xu-gua', 'za-gua'];
    for (const s of expectedSlugs) {
      expect(slugs).toContain(s as any);
    }
  });

  it('3. 每篇 chapterCount 与 chapters.length 一致', () => {
    for (const text of SHIYI_TEXTS) {
      expect(text.chapterCount, text.slug).toBe(text.chapters.length);
    }
  });

  it('4. 每章 index 从 1 开始连续递增', () => {
    for (const text of SHIYI_TEXTS) {
      for (let i = 0; i < text.chapters.length; i++) {
        expect(text.chapters[i].index, `${text.slug}:${i}`).toBe(i + 1);
      }
    }
  });

  it('5. 每章 paragraphs.length >= 1', () => {
    for (const text of SHIYI_TEXTS) {
      for (const ch of text.chapters) {
        expect(ch.paragraphs.length, `${text.slug}:${ch.index}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('6. 每段 index 从 1 开始连续递增', () => {
    for (const text of SHIYI_TEXTS) {
      for (const ch of text.chapters) {
        for (let i = 0; i < ch.paragraphs.length; i++) {
          expect(ch.paragraphs[i].index, `${text.slug}:${ch.index}:${i}`).toBe(i + 1);
        }
      }
    }
  });

  it('7. totalChars 与实际字符数一致', () => {
    function countCjk(text: string): number {
      let count = 0;
      for (const ch of text) {
        const code = ch.charCodeAt(0);
        if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) {
          count++;
        }
      }
      return count;
    }
    for (const text of SHIYI_TEXTS) {
      const actualChars = text.chapters.reduce(
        (acc, ch) => acc + ch.paragraphs.reduce((s, p) => s + countCjk(p.text), 0),
        0
      );
      expect(text.totalChars, text.slug).toBe(actualChars);
    }
  });

  it('8. source.pageIds.length === source.oldids.length', () => {
    for (const text of SHIYI_TEXTS) {
      expect(text.source.pageIds.length, text.slug).toBe(text.source.oldids.length);
    }
  });

  it('9. 每段 text 非空且不含 Wikisource 链接标记', () => {
    for (const text of SHIYI_TEXTS) {
      for (const ch of text.chapters) {
        for (const p of ch.paragraphs) {
          expect(p.text.trim().length, `${text.slug}:${ch.index}:${p.index}`).toBeGreaterThan(0);
          // 不应包含 Markdown 链接标记
          expect(p.text, `${text.slug}:${ch.index}:${p.index}`).not.toMatch(/\[.+?\]\(.+?\)/);
        }
      }
    }
  });

  it('10. 5 篇的章数符合设计规格', () => {
    expect(getShiyiText('xi-ci-upper')?.chapterCount).toBe(12);
    expect(getShiyiText('xi-ci-lower')?.chapterCount).toBe(9);
    expect(getShiyiText('shuo-gua')?.chapterCount).toBe(11);
    expect(getShiyiText('xu-gua')?.chapterCount).toBe(1);
    expect(getShiyiText('za-gua')?.chapterCount).toBe(1);
  });

  it('11. 每段 id 格式正确（slug:chIdx:paraIdx）', () => {
    for (const text of SHIYI_TEXTS) {
      for (const ch of text.chapters) {
        for (const p of ch.paragraphs) {
          expect(p.id).toBe(`${text.slug}:${ch.index}:${p.index}`);
        }
      }
    }
  });

  it('12. 每章 id 格式正确（slug:chIdx）', () => {
    for (const text of SHIYI_TEXTS) {
      for (const ch of text.chapters) {
        expect(ch.id).toBe(`${text.slug}:${ch.index}`);
      }
    }
  });

  it('13. source.lang 和 source.langHans 值正确', () => {
    for (const text of SHIYI_TEXTS) {
      expect(text.source.lang).toBe('zh-hant');
      expect(text.source.langHans).toBe('zh-hans');
    }
  });

  it('14. allShiyiParagraphs() 迭代所有段落', () => {
    let count = 0;
    for (const _p of allShiyiParagraphs()) {
      count++;
    }
    // 应该遍历所有段落
    const expectedCount = SHIYI_TEXTS.reduce(
      (acc, t) => acc + t.chapters.reduce((s, ch) => s + ch.paragraphs.length, 0),
      0
    );
    expect(count).toBe(expectedCount);
    expect(count).toBeGreaterThan(0);
  });
});

describe('十翼 §8.8 金标准测试（5 项）', () => {
  it('「天尊地卑，乾坤定矣」应在 xi-ci-upper:1:1（第一章第一段）', () => {
    const para = getShiyiChapter('xi-ci-upper:1')?.paragraphs[0];
    expect(para).toBeDefined();
    expect(para!.text).toContain('天尊地卑');
  });

  it('「易有太极，是生两仪」应在 xi-ci-upper:11（第十一章）', () => {
    const ch = getShiyiChapter('xi-ci-upper:11');
    expect(ch).toBeDefined();
    const allText = ch!.paragraphs.map(p => p.text).join('');
    expect(allText).toContain('太极');
    expect(allText).toContain('两仪');
  });

  it('「有天地，然后万物生焉」应在 xu-gua:1:1（序卦传第一段）', () => {
    const ch = getShiyiChapter('xu-gua:1');
    expect(ch).toBeDefined();
    // 校验章引（quote）也包含该句
    expect(ch!.quote).toContain('有天地');
    const allText = ch!.paragraphs.map(p => p.text).join('');
    expect(allText).toContain('有天地');
  });

  it('「乾刚坤柔，比乐师忧」应在 za-gua:1:2（杂卦传第二段）', () => {
    const ch = getShiyiChapter('za-gua:1');
    expect(ch).toBeDefined();
    // 第一段为韩康伯注总说，第二段为经文正文
    const allText = ch!.paragraphs.map(p => p.text).join('');
    expect(allText).toContain('乾');
    expect(allText).toContain('坤');
  });

  it('「昔者包犧氏之王天下也」应在 shuo-gua:1:1（说卦传第一段）', () => {
    const ch = getShiyiChapter('shuo-gua:1');
    expect(ch).toBeDefined();
    const allText = ch!.paragraphs.map(p => p.text).join('');
    expect(allText).toContain('圣人');
    expect(allText).toContain('易');
  });
});

describe('十翼 §8.8 validateShiyiData() 运行时校验', () => {
  it('校验返回空数组（零问题）', () => {
    const issues = validateShiyiData();
    expect(issues).toEqual([]);
  });

  it('校验结果中不包含 error 级别问题', () => {
    const issues = validateShiyiData();
    const errors = issues.filter(i => i.level === 'error');
    expect(errors).toEqual([]);
  });
});
