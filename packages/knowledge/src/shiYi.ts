/* ============================================================
 * 十翼文本结构化数据 —— 对应 docs/dev/knowledge-review/design/
 *   十翼原文展示-UI设计规格.md v0.2 §8
 *
 * 与 packages/knowledge/src/hexagrams.ts 的 Hexagram interface 平行：
 *   hexagrams.ts  =  按卦聚合的原文（64 卦 × 6 爻）
 *   shiYi.ts      =  按篇聚合的原文（5 篇 × 12/9/11/1/1 章）
 *
 * 数据源：《周易正義》维基文库 zh.wikisource.org/周易正義/{编号}
 *        （孔颖达《周易正义》本，经 + 郑注/韩康伯注 + 孔疏三层）
 *
 * 存储口径：主数据存 zh-hant（繁体权威层），交付层按需转简体
 * ============================================================ */

import { RAW_SHIYI } from './shiYi.generated.js';

/** 五篇短名（URL slug，与 shiYi.generated.ts 中的 RAW 键一致） */
export type ShiyiSlug =
  | 'xi-ci-upper'   // 系辭上傳
  | 'xi-ci-lower'   // 系辭下傳
  | 'shuo-gua'      // 说卦傳
  | 'xu-gua'        // 序卦傳
  | 'za-gua';       // 杂卦傳

/** 章 ID：`slug:chapterIndex`，如 `xi-ci-upper:1`（稳定键，不依赖下标） */
export type ShiyiChapterId = `${ShiyiSlug}:${number}`;

/** 段 ID：`chapterId:paragraphIndex`，如 `xi-ci-upper:1:1` */
export type ShiyiParagraphId = `${ShiyiChapterId}:${number}`;

/**
 * 段种类：
 * - `body`     ：章内正文段落（默认）
 * - `quote`    ：引例段落（如"若《剥》之六五黄裳元吉"这类引他卦例的段落）
 * - `preamble` ：篇首或章首的前言说明段（如系辭上传篇首的序言）
 *
 * 目前解析器默认所有段落 kind = 'body'，其他两种需人工校对时标注。
 */
export type ShiyiParagraphKind = 'body' | 'quote' | 'preamble';

/**
 * 注疏类型：
 * - `zhu` ：郑玄注 / 韩康伯注（十翼原文的历代注文）
 * - `shu` ：孔颖达疏（唐代孔颖达《周易正义》疏，Wikisource 页面中带 `[疏]` 前缀）
 *
 * 注疏是**可选层**：M1 只交付 jing（经），M2 才接 zhu/shu。
 */
export type ShiyiAnnotationKind = 'zhu' | 'shu';

/** 段内嵌的注疏（对应某一独立段落） */
export interface ShiyiAnnotation {
  readonly kind: ShiyiAnnotationKind;
  /** 注疏作者名（如"郑玄""韩康伯""孔颖达"） */
  readonly author: string;
  /** 注疏正文（不含"正义曰：""注曰"等前缀） */
  readonly text: string;
  /** 注疏原文起始字节偏移（可选，用于溯源校对，不进 UI） */
  readonly sourceOffset?: number;
}

/**
 * 段落：十翼经原文的最小单元。
 * 一个段落对应原文中的一个「。」「！」「？」句号断句块。
 */
export interface ShiyiParagraph {
  /** 段序号（章内 1-based，1..N） */
  readonly index: number;
  /** 段 ID（章 ID + 段序号拼接） */
  readonly id: ShiyiParagraphId;
  /** 段文本（zh-hant 权威层） */
  readonly text: string;
  /** 段文本（zh-hans 交付层，可选） */
  readonly textHans?: string;
  /** 段种类 */
  readonly kind: ShiyiParagraphKind;
  /** 段关联的注疏（该段独有的注疏；章级共用注疏不放这里） */
  readonly annotations?: readonly ShiyiAnnotation[];
}

/**
 * 章：十翼的最小阅读单元。
 * 系辭上 12 章 / 系辭下 9 章 / 说卦 11 章 / 序卦 1 章 / 杂卦 1 章。
 */
export interface ShiyiChapter {
  /** 章序号（篇内 1-based） */
  readonly index: number;
  /** 章 ID（slug:chapterIndex） */
  readonly id: ShiyiChapterId;
  /** 章题（如「天尊地卑」「圣人设卦」），序卦/杂卦无章题时可缺省 */
  readonly title?: string;
  /** 章引（章首 20–40 字摘录，用于卡片引言和搜索摘要） */
  readonly quote?: string;
  /** 章末小注（可选，如关键概念、与卦的关联） */
  readonly note?: string;
  /** 章内段落（按原顺序） */
  readonly paragraphs: readonly ShiyiParagraph[];
  /** 章级共用注疏（跨段落共用，如章首/章末的整体注疏） */
  readonly annotations?: readonly ShiyiAnnotation[];
}

/**
 * 篇：五翼之一。
 *
 * ⚠️ 命名区分：「翼」是十翼的统称（Ten Wings），「篇」是本次收录的五个具体
 * 篇章。为避免术语混淆，字段一律用"篇"而非"翼"。
 */
export interface ShiyiText {
  readonly slug: ShiyiSlug;
  readonly name: string;               // 系辞上传
  readonly nameTraditional: string;    // 系辭上傳 —— 顶部大标题展示
  readonly nameEnglish: string;        // Great Commentary (Upper) —— aria-label
  /** 篇首摘要（30 字以内，用于总览卡片） */
  readonly summary: string;
  readonly chapterCount: number;
  /** 全文总字数（不含标点，繁字口径） */
  readonly totalChars: number;
  readonly chapters: readonly ShiyiChapter[];
  /** 数据源信息（用于版权、校对与溯源） */
  readonly source: {
    readonly wikisourceUrl: string;
    /** 该篇的所有 Wikisource 页编号（如 `['07.01', '07.02', ..., '07.12']`） */
    readonly pageIds: readonly string[];
    /** 每页对应的 oldid（页面修订版本，用于溯源校对；解析时固化，不随 Wikisource 变化） */
    readonly oldids: readonly string[];
    readonly lang: 'zh-hant';
    readonly langHans: 'zh-hans';
  };
}

/** 校验问题类型（validateShiyiData 返回值） */
export interface ShiyiIssue {
  readonly level: 'error' | 'warn';
  readonly message: string;
  readonly slug?: ShiyiSlug;
  readonly chapterIndex?: number;
  readonly paragraphIndex?: number;
}

// ── 辅助函数 ──────────────────────────────────────────────

/** 统计 CJK 字符数（不含标点） */
function countCjk(text: string): number {
  let count = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||   // CJK 基本区
      (code >= 0x3400 && code <= 0x4dbf)      // CJK 扩展 A
    ) {
      count++;
    }
  }
  return count;
}

/** 从 RAW 元组构建 ShiyiParagraph */
function buildParagraph(
  slug: ShiyiSlug,
  chapterIndex: number,
  paragraphs: RawChapter[4]
): ShiyiParagraph[] {
  return paragraphs.map(([text, kind, anns], pi) => ({
    index: pi + 1,
    id: `${slug}:${chapterIndex}:${pi + 1}` as ShiyiParagraphId,
    text,
    kind,
    annotations: anns.length
      ? anns.map(([kind, author, text]) => ({ kind, author, text }))
      : undefined,
  }));
}

/** 从 RAW 元组构建 ShiyiChapter */
function buildChapters(
  slug: ShiyiSlug,
  chapters: RawText[7]
): ShiyiChapter[] {
  return chapters.map(([i, title, quote, note, paragraphs]) => ({
    index: i,
    id: `${slug}:${i}` as ShiyiChapterId,
    title: title ?? undefined,
    quote: quote ?? undefined,
    note: note ?? undefined,
    paragraphs: buildParagraph(slug, i, paragraphs),
  }));
}

// ── 5 篇索引（顶层导出，供组件直接消费） ──────────────────

const slugList: readonly ShiyiSlug[] = [
  'xi-ci-upper', 'xi-ci-lower', 'shuo-gua', 'xu-gua', 'za-gua',
] as const;

/** 5 篇索引（顶层导出，供组件直接消费） */
export const SHIYI_TEXTS: readonly ShiyiText[] = slugList.map((slug) => {
  const raw = RAW_SHIYI[slug];
  const [, name, nameTraditional, nameEnglish, summary, pageIds, oldids, chapters] = raw;
  const builtChapters = buildChapters(slug, chapters);
  const totalChars = builtChapters.reduce(
    (acc, ch) => acc + ch.paragraphs.reduce((s, p) => s + countCjk(p.text), 0),
    0
  );
  return {
    slug, name, nameTraditional, nameEnglish, summary,
    chapterCount: builtChapters.length,
    totalChars,
    chapters: builtChapters,
    source: {
      wikisourceUrl: 'https://zh.wikisource.org/周易正義/',
      pageIds, oldids,
      lang: 'zh-hant' as const, langHans: 'zh-hans' as const,
    },
  };
});

// ── 查询函数 ──────────────────────────────────────────────

/** 按 slug 查单篇（组件消费入口） */
export function getShiyiText(slug: ShiyiSlug): ShiyiText | undefined {
  return SHIYI_TEXTS.find(t => t.slug === slug);
}

/** 按章 ID 查单章（跨篇检索入口） */
export function getShiyiChapter(chapterId: ShiyiChapterId): ShiyiChapter | undefined {
  const colonIdx = chapterId.indexOf(':');
  const slug = chapterId.substring(0, colonIdx) as ShiyiSlug;
  const indexStr = chapterId.substring(colonIdx + 1);
  const chapterIndex = parseInt(indexStr, 10);
  const text = getShiyiText(slug);
  return text?.chapters.find(c => c.index === chapterIndex);
}

/**
 * 迭代全部段落（供全文搜索索引使用，M2）。
 * 生成器函数：`for (const p of allShiyiParagraphs()) { ... }`
 */
export function* allShiyiParagraphs(): Generator<ShiyiParagraph> {
  for (const text of SHIYI_TEXTS) {
    for (const chapter of text.chapters) {
      yield* chapter.paragraphs;
    }
  }
}

/**
 * 校验数据完整性（类似 hexagrams.ts 的 validateKnowledgeBase）。
 * 检查：
 * 1. 5 篇齐全，slug 唯一
 * 2. 每篇 chapterCount 与 chapters.length 一致
 * 3. 每章 index 从 1 开始连续
 * 4. 每段 index 从 1 开始连续
 * 5. totalChars 与实际字符数一致
 * 6. source.oldids.length 与 source.pageIds.length 一致
 */
export function validateShiyiData(): readonly ShiyiIssue[] {
  const issues: ShiyiIssue[] = [];

  if (SHIYI_TEXTS.length !== 5) {
    issues.push({
      level: 'error',
      message: `SHIYI_TEXTS should have 5 entries, got ${SHIYI_TEXTS.length}`,
    });
  }

  const seenSlugs = new Set<ShiyiSlug>();
  for (const text of SHIYI_TEXTS) {
    // 1. slug 唯一
    if (seenSlugs.has(text.slug)) {
      issues.push({
        level: 'error', slug: text.slug,
        message: 'duplicate slug',
      });
    }
    seenSlugs.add(text.slug);

    // 2. chapterCount 一致
    if (text.chapters.length !== text.chapterCount) {
      issues.push({
        level: 'error', slug: text.slug,
        message: `chapterCount mismatch: ${text.chapterCount} declared, ${text.chapters.length} actual`,
      });
    }

    // 3. 每章 index 从 1 开始连续
    for (let ci = 0; ci < text.chapters.length; ci++) {
      const ch = text.chapters[ci];
      if (ch.index !== ci + 1) {
        issues.push({
          level: 'error', slug: text.slug, chapterIndex: ch.index,
          message: `chapter index not consecutive: expected ${ci + 1}, got ${ch.index}`,
        });
      }

      // 4. 每段 index 从 1 开始连续
      for (let pi = 0; pi < ch.paragraphs.length; pi++) {
        const p = ch.paragraphs[pi];
        if (p.index !== pi + 1) {
          issues.push({
            level: 'error', slug: text.slug, chapterIndex: ch.index,
            paragraphIndex: p.index,
            message: `paragraph index not consecutive: expected ${pi + 1}, got ${p.index}`,
          });
        }

        // 段文本非空
        if (!p.text.trim()) {
          issues.push({
            level: 'warn', slug: text.slug, chapterIndex: ch.index,
            paragraphIndex: p.index,
            message: 'empty paragraph',
          });
        }
      }

      // 段数 > 0
      if (ch.paragraphs.length === 0) {
        issues.push({
          level: 'warn', slug: text.slug, chapterIndex: ch.index,
          message: 'chapter has no paragraphs',
        });
      }
    }

    // 5. totalChars 一致
    const actualChars = text.chapters.reduce(
      (acc, ch) => acc + ch.paragraphs.reduce((s, p) => s + countCjk(p.text), 0),
      0
    );
    if (text.totalChars !== actualChars) {
      issues.push({
        level: 'warn', slug: text.slug,
        message: `totalChars mismatch: ${text.totalChars} declared, ${actualChars} actual`,
      });
    }

    // 6. pageIds/oldids 长度一致
    if (text.source.pageIds.length !== text.source.oldids.length) {
      issues.push({
        level: 'error', slug: text.slug,
        message: `pageIds/oldids length mismatch: ${text.source.pageIds.length} vs ${text.source.oldids.length}`,
      });
    }
  }

  return issues;
}

// ── 类型导出（供外部使用） ────────────────────────────────

type RawChapter = readonly [
  number,
  string | null,
  string | null,
  string | null,
  readonly (readonly [
    string,
    'body' | 'quote' | 'preamble',
    readonly (readonly ['zhu' | 'shu', string, string])[]
  ])[]
];

type RawText = readonly [
  ShiyiSlug,
  string,
  string,
  string,
  string,
  readonly string[],
  readonly string[],
  RawChapter[]
];
