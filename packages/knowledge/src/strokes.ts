/* ============================================================
 * 汉字笔画映射 —— 对应 docs/dev/05-卦象知识库设计.md §4.1 / §4.2
 *
 * 本文件是**装配层**（数据在别的文件里，这里只负责组装 + 查表）：
 *   ① 底座 strokes.generated.ts —— 由 scripts/build-strokes.mjs 从 Unicode Unihan
 *      18.0 生成的**全量表**，收字域 = URO + 扩展 A（与 {@link isHanChar} 一致，
 *      27,584 字，域内逐字有值，构建期已校验覆盖率与 1–84 值域）。
 *   ② 覆盖层 strokes-overrides.ts —— 现役 117 字 / 30 对别名权威冻结 +
 *      hanzi-writer-data 对拍裁决（详见该文件头的优先级说明）。
 *   ③ 深冻结后导出 {@link STROKES} / {@link TRADITIONAL_ALIAS}；查表逻辑本身
 *      与 05 §4.1 口径一致（直接键 → 别名归一 → 手动表 → null），未改。
 *
 * 重新生成：npm run knowledge:build（生成物不接入 verify，CI 不重新生成）
 *
 * 查表口径（05 §4.1）：
 *   - 表键一律为**简体字面**，繁体笔画由 `t` 字段承载（缺省视为与简体相同）
 *   - 繁体字面（如「觀」）经 {@link TRADITIONAL_ALIAS} 归一到简体字面后取值
 * ============================================================ */

import {
  GENERATED_ADJUDICATOR,
  GENERATED_AT,
  GENERATED_ALIAS_LINES,
  GENERATED_DOMAIN_SIZE,
  GENERATED_ENTRY_LINES,
  GENERATED_UNICODE_VERSION,
} from './strokes.generated.js';
import { BASELINE_STROKES, BASELINE_TRADITIONAL_ALIAS } from './strokes-overrides.js';

export type StrokeStandard = 'SIMPLIFIED' | 'TRADITIONAL';

export interface StrokeEntry {
  /** 简体标准笔画 */
  readonly s: number;
  /** 繁体标准笔画；缺省视为与简体相同（05 文档 §4.1 的约定） */
  readonly t?: number;
}

/**
 * 解析生成条目行。形态：`字:s` 或 `字:s:t`，`;` 分隔、每行 64 条（05 §4.1）。
 * `t` 在生成期就已按「与 s 同值则省略」裁剪，这里原样还原。
 */
function parseEntryLines(lines: readonly string[]): Record<string, StrokeEntry> {
  const table: Record<string, StrokeEntry> = {};
  for (const line of lines) {
    for (const item of line.split(';')) {
      if (item === '') continue;
      const first = item.indexOf(':');
      const second = item.indexOf(':', first + 1);
      const ch = item.slice(0, first);
      const s = Number(item.slice(first + 1, second < 0 ? undefined : second));
      table[ch] = second < 0 ? { s } : { s, t: Number(item.slice(second + 1)) };
    }
  }
  return table;
}

/** 解析生成别名行。形态：`繁:简`，`;` 分隔 —— 只有字面，没有数值 */
function parseAliasLines(lines: readonly string[]): Record<string, string> {
  const table: Record<string, string> = {};
  for (const line of lines) {
    for (const item of line.split(';')) {
      if (item === '') continue;
      const i = item.indexOf(':');
      table[item.slice(0, i)] = item.slice(i + 1);
    }
  }
  return table;
}

/** 笔画录入表（未冻结）—— 键为简体字面，勿直接导出 */
const STROKE_TABLE: Record<string, StrokeEntry> = parseEntryLines(GENERATED_ENTRY_LINES);
// 覆盖层优先级 ①：现役 117 字**逐字段**覆盖（与 strokes-overrides.ts 声明的合并
// 语义、以及构建期的合并结果一致）——写了 t 就覆盖 t，没写 t 则沿用生成值，
// 只有 s 被改写；整条替换会把「现表只给 s、繁体面靠生成值」的字（如 禄）打断。
for (const [ch, b] of Object.entries(BASELINE_STROKES)) {
  const t = b.t !== undefined ? b.t : STROKE_TABLE[ch]?.t;
  STROKE_TABLE[ch] = t === undefined ? { s: b.s } : { s: b.s, t };
}

/** 繁体字面 → 简体字面别名表（未冻结）—— 覆盖层优先级 ① 的 30 对现役别名最后落位 */
const ALIAS_TABLE: Record<string, string> = parseAliasLines(GENERATED_ALIAS_LINES);
for (const [from, to] of Object.entries(BASELINE_TRADITIONAL_ALIAS)) ALIAS_TABLE[from] = to;

/** 深冻结：表对象与其条目（`readonly` 只在编译期生效，见 05 §3.4 / C-9） */
function deepFreezeTable<T extends object>(table: Record<string, T>): Readonly<Record<string, T>> {
  for (const entry of Object.values(table)) Object.freeze(entry);
  return Object.freeze(table);
}

/**
 * 字 → 笔画（冻结）。`readonly` 只在编译期生效，运行时仍可改写；
 * 知识库是全局共享单例，UI 若原地改写会污染所有调用方。
 */
export const STROKES: Readonly<Record<string, StrokeEntry>> = deepFreezeTable(STROKE_TABLE);

/**
 * 繁体字面 → 简体字面别名表（05 文档 §4.1）。
 *
 * 只登记「繁体形与简体形不同」且**换面无歧义**的字（UAX #38 §3.7.1 case-4a：
 * 简体字自身也出现在传统面列表里、或传统面指向多个简体字时，不建别名、
 * `t` 按字面取，不猜）。笔画**数值**一律由 `t` 字段提供，不在此处重复录入 ——
 * 同一数值在仓库里出现两份必然改一处漏一处。
 */
export const TRADITIONAL_ALIAS: Readonly<Record<string, string>> = Object.freeze(ALIAS_TABLE);

/**
 * 数据溯源（供 UI「数据来源」页与测试断言）：
 * 底座版本、对拍 oracle、生成时间与规模。字段值全部来自生成物，改数据须重跑
 * `npm run knowledge:build`。
 */
export const STROKES_SOURCE: Readonly<{
  /** Unicode Unihan 版本（kTotalStrokes / 变体字段来源） */
  readonly unicode: string;
  /** 对拍 oracle（离线裁决期使用，不随本仓库分发） */
  readonly adjudicator: string;
  /** 生成时间（UTC，仅溯源） */
  readonly generatedAt: string;
  /** 收字域码点数（URO + 扩展 A） */
  readonly domainSize: number;
  /** 表键数（含覆盖层） */
  readonly keyCount: number;
  /** 繁体别名条数（含覆盖层） */
  readonly aliasCount: number;
}> = Object.freeze({
  unicode: GENERATED_UNICODE_VERSION,
  adjudicator: GENERATED_ADJUDICATOR,
  generatedAt: GENERATED_AT,
  domainSize: GENERATED_DOMAIN_SIZE,
  keyCount: Object.keys(STROKES).length,
  aliasCount: Object.keys(TRADITIONAL_ALIAS).length,
});

export interface StrokeLookup {
  /** 该标准下的笔画数 */
  readonly strokes: number;
  /** 是否为用户手动补充（非内置表命中） */
  readonly manual: boolean;
  /** 是否回退到了简体值（繁体缺省） */
  readonly fellBackToSimplified: boolean;
  /**
   * 实际取值的表键。繁体输入（如「觀」）时为归一后的简体字面（「观」），
   * 供 UI 提示与排错；手动补充时等于输入字本身。
   */
  readonly resolvedChar: string;
}

/**
 * 查询笔画。查表 miss 返回 null —— 调用方（UI）据此弹出「手动输入笔画」对话框
 * （03 文档 §6.4：不自动猜测）。
 *
 * 繁体字面（如「觀」）先经 {@link TRADITIONAL_ALIAS} 归一到简体字面再取值，
 * 因此 `lookupStrokes('觀', 'TRADITIONAL') === 25`、`('觀', 'SIMPLIFIED') === 6`
 * —— 与 `('观', ...)` 的结果对称（标准决定「按哪个字形计画」，字面本身不决定）。
 *
 * @param manualTable 用户手动补充的笔画表（04 文档 §4.2「记住该字」）
 */
export function lookupStrokes(
  char: string,
  standard: StrokeStandard,
  manualTable?: Readonly<Record<string, number>>,
): StrokeLookup | null {
  const key = STROKES[char] ? char : (TRADITIONAL_ALIAS[char] ?? char);
  const entry = STROKES[key];
  if (!entry) {
    const manual = manualTable?.[char];
    if (manual == null) return null;
    return { strokes: manual, manual: true, fellBackToSimplified: false, resolvedChar: char };
  }
  if (standard === 'TRADITIONAL') {
    if (entry.t != null) {
      return { strokes: entry.t, manual: false, fellBackToSimplified: false, resolvedChar: key };
    }
    return { strokes: entry.s, manual: false, fellBackToSimplified: true, resolvedChar: key };
  }
  return { strokes: entry.s, manual: false, fellBackToSimplified: false, resolvedChar: key };
}

/** 是否为汉字（CJK 统一表意文字基本区 + 扩展 A） */
export function isHanChar(ch: string): boolean {
  return /^[\u3400-\u4DBF\u4E00-\u9FFF]$/.test(ch);
}
