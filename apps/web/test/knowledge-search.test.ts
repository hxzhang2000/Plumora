/* ============================================================
 * 知识库检索测试
 *
 * 学习页以前只能按 8×8 格子翻卦、逐篇读十翼。加入全文检索后，
 * 这里把「搜得到 / 权重合理 / 摘要可读 / 空查询不炸」钉住 ——
 * 索引构建器一旦改坏（如漏了爻辞字段），最典型的症状就是「明明有这段却搜不到」。
 * ============================================================ */

import { beforeEach, describe, expect, it } from 'vitest';
import { searchKnowledge, resetKnowledgeSearchIndex } from '@/platform/knowledgeSearch';

beforeEach(() => {
  resetKnowledgeSearchIndex();
});

describe('searchKnowledge', () => {
  it('空查询 / 纯空白返回空数组（不建索引、不报错）', () => {
    expect(searchKnowledge('')).toEqual([]);
    expect(searchKnowledge('   ')).toEqual([]);
  });

  it('按卦名命中，且点得开（带上 / 下卦）', () => {
    const hits = searchKnowledge('井');
    const hex = hits.find((h) => h.kind === 'hex' && h.name === '水风井');
    expect(hex).toBeDefined();
    if (hex?.kind === 'hex') {
      expect(hex.upper).toBeGreaterThanOrEqual(1);
      expect(hex.lower).toBeGreaterThanOrEqual(1);
    }
  });

  it('卦名命中排在其他字段命中之前', () => {
    const hits = searchKnowledge('乾');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.kind).toBe('hex');
    expect(hits[0]!.score).toBe(3);
  });

  it('能搜到爻辞释义（简体）与经传原文（繁体）两路', () => {
    // 爻辞原文按《周易》通行本录的是**繁体**（「潛龍勿用」），
    // 释义字段是简体白话（「潜藏的龙…」）—— 两路都要搜得到。
    const simplified = searchKnowledge('潜藏的龙');
    expect(simplified.some((h) => h.kind === 'hex' && h.name === '乾为天')).toBe(true);

    const traditional = searchKnowledge('潛龍勿用');
    expect(traditional.some((h) => h.kind === 'hex' && h.name === '乾为天')).toBe(true);
    // 正文命中权重最低（标题 / 关键词都不含该词）
    expect(traditional.every((h) => h.score <= 1 || h.kind === 'shiyi')).toBe(true);
  });

  it('能搜到十翼全文，并给出可跳转的篇 slug', () => {
    const hits = searchKnowledge('天尊地卑');
    const shiyi = hits.find((h) => h.kind === 'shiyi');
    expect(shiyi).toBeDefined();
    if (shiyi?.kind === 'shiyi') {
      expect(shiyi.slug).toBeTruthy();
      expect(shiyi.title).toContain('系');
      expect(shiyi.snippet).toContain('天尊地卑');
    }
  });

  it('摘要长度可控（不把整段原文塞进列表）', () => {
    const hits = searchKnowledge('天尊地卑');
    for (const h of hits) expect(h.snippet.length).toBeLessThanOrEqual(70);
  });

  it('limit 生效，且结果按权重降序', () => {
    const hits = searchKnowledge('水', 5);
    expect(hits.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < hits.length; i += 1) {
      expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
    }
  });

  it('查无此词返回空数组（而不是全量列表）', () => {
    expect(searchKnowledge('zzzz不存在的词zzzz')).toEqual([]);
  });
});
