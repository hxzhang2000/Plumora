/* ============================================================
 * 双语显示辅助 —— 在 UI 层把「拼音 / 英文」接到卦名、卦符与类象上。
 *
 * 数据源来自 @plumora/knowledge 的冻结常量（TRIGRAM_PINYIN / TRIGRAM_EN /
 * HEXAGRAM_PINYIN / HEXAGRAM_EN）；本文件只做薄封装与「缺数据降级为 ''」，
 * 不参与任何断卦逻辑。
 *
 * 约定：所有函数对「知识库里查不到」的输入返回空串，调用方据此决定是否渲染，
 * 不会出现 undefined / 'undefined' 串进页面。
 * ============================================================ */

import {
  HEXAGRAM_EN,
  HEXAGRAM_PINYIN,
  TRIGRAM_EN,
  TRIGRAM_PINYIN,
} from '@plumora/knowledge';
import type { TrigramNumber } from '@plumora/knowledge';

/** 八卦拼音（带声调），如 乾 → 'qián' */
export function trigramPinyin(n: TrigramNumber): string {
  return TRIGRAM_PINYIN[n] ?? '';
}

/** 八卦英文（Wilhelm/Baynes 通行名），如 乾 → 'Heaven' */
export function trigramEn(n: TrigramNumber): string {
  return TRIGRAM_EN[n] ?? '';
}

/** 六十四卦拼音（带声调），键为卦名原文，如 '乾为天' → 'qián wéi tiān' */
export function hexagramPinyin(name: string): string {
  return HEXAGRAM_PINYIN[name] ?? '';
}

/** 六十四卦英文（Wilhelm/Baynes 通行名），如 '乾为天' → 'The Creative' */
export function hexagramEn(name: string): string {
  return HEXAGRAM_EN[name] ?? '';
}
