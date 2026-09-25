/* ============================================================
 * @plumora/knowledge —— 观梅 · Plumora 卦象知识库
 *
 * 平台无关纯数据包：不依赖 DOM、Node、任何框架与第三方库。
 * Web 端直接 import；Android 端可将同结构数据导出为 JSON 复用
 * （04 文档 §四 assets/knowledge/*.json 的组织方式）。
 * ============================================================ */

export {
  ELEMENT_CN,
  TRIGRAMS,
  TRIGRAM_LIST,
  TRIGRAM_CATEGORIES,
  trigram,
  trigramByBinary,
  trigramLines,
  linesToBinary,
} from './trigrams.js';
export type { Element, Trigram, TrigramNumber } from './trigrams.js';

export {
  HEXAGRAMS,
  HEXAGRAM_LIST,
  getHexagram,
  getHexagramByCode,
  getHexagramByLines,
  hexCodeOf,
  normalizeHexCode,
  validateKnowledgeBase,
  linesTopDown,
  binaryToLines,
  linesToHexBinary,
  describeTrigram,
} from './hexagrams.js';
export type { Hexagram, HexagramLine, HexCode, KnowledgeBaseIssue } from './hexagrams.js';

export { STROKES, TRADITIONAL_ALIAS, lookupStrokes, isHanChar } from './strokes.js';
export type { StrokeEntry, StrokeLookup, StrokeStandard } from './strokes.js';
