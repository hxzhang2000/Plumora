/* ============================================================
 * 知识库搜索 —— 学习页的「卦 / 十翼」全文检索（纯函数 + 惰性索引）
 *
 * 数据本来就在本地（64 卦全表 + 十翼全文），做成纯前端子串检索即可，
 * 不需要任何后端或分词库：中文用子串匹配的召回已经够用，成本几乎为零。
 *
 * 索引惰性构建（首次搜索才建），且本模块只被懒加载的学习页引用，
 * 因此不会给起卦首屏增加任何体积。
 *
 * ⚠️ 简繁口径：经传原文（卦辞 / 爻辞 / 彖象 / 十翼繁体层）按通行本录的是**繁体**，
 * 而用户输入几乎都是简体。因此索引里同时收：
 *   · 简体侧 —— 卦名、卦意关键词、爻辞释义、十翼的 textHans 交付层；
 *   · 繁体侧 —— 经传原文本身。
 * 两边都搜得到，但**不做简繁转换**（那需要一张完整的转换表，成本远高于收益）：
 * 用户打简体能搜到释义与十翼白话，想看原文按繁体再搜一次即可。
 * ============================================================ */

import { HEXAGRAM_LIST } from '@plumora/knowledge/hexagrams';
import { SHIYI_TEXTS } from '@plumora/knowledge/shiYi';
import type { ShiyiSlug } from '@plumora/knowledge/shiYi';
import type { TrigramNumber } from '@plumora/knowledge/trigrams';

/** 命中一条卦 */
export interface HexHit {
  readonly kind: 'hex';
  readonly code: string;
  readonly name: string;
  readonly upper: TrigramNumber;
  readonly lower: TrigramNumber;
  /** 命中位置的摘要（未命中正文时回落到卦意关键词） */
  readonly snippet: string;
  readonly score: number;
}

/** 命中一条十翼段落 */
export interface ShiyiHit {
  readonly kind: 'shiyi';
  readonly slug: ShiyiSlug;
  /** 篇名 + 章题 */
  readonly title: string;
  readonly subtitle: string;
  readonly snippet: string;
  readonly score: number;
}

export type KnowledgeHit = HexHit | ShiyiHit;

/** 摘要最大长度（超出截断并加省略号） */
const SNIPPET_MAX = 62;

type IndexEntry = {
  readonly hit: Omit<HexHit, 'snippet' | 'score'> | Omit<ShiyiHit, 'snippet' | 'score'>;
  /** 标题类字段（命中权重最高） */
  readonly titleText: string;
  /** 关键词 / 章题类字段（中等权重） */
  readonly tagText: string;
  /** 正文（最低权重，也是摘要来源） */
  readonly bodyText: string;
  /* 预先转小写：每次按键都对整库（含 64 卦全文与十翼全文，约数百 KB）做
   * toLowerCase 是纯浪费，构建索引时做一次即可。 */
  readonly titleLower: string;
  readonly tagLower: string;
  readonly bodyLower: string;
};

let index: IndexEntry[] | null = null;

function withLower(
  hit: IndexEntry['hit'],
  titleText: string,
  tagText: string,
  bodyText: string,
): IndexEntry {
  return {
    hit,
    titleText,
    tagText,
    bodyText,
    titleLower: titleText.toLowerCase(),
    tagLower: tagText.toLowerCase(),
    bodyLower: bodyText.toLowerCase(),
  };
}

function bodyOfHex(g: (typeof HEXAGRAM_LIST)[number]): string {
  const parts: string[] = [];
  if (g.guaci) parts.push(g.guaci);
  if (g.guaciMeaning) parts.push(g.guaciMeaning);
  for (const l of g.lines ?? []) {
    parts.push(`${l.name}：${l.text}`);
    if (l.meaning) parts.push(l.meaning);
  }
  if (g.tuan) parts.push(g.tuan);
  if (g.daxiang) parts.push(g.daxiang);
  for (const w of g.wenyan ?? []) parts.push(w);
  for (const v of Object.values(g.xiaoxiang ?? {})) parts.push(v);
  if (g.yongText) parts.push(g.yongText);
  return parts.join('\n');
}

function buildIndex(): IndexEntry[] {
  const entries: IndexEntry[] = [];

  for (const g of HEXAGRAM_LIST) {
    entries.push(
      withLower(
        { kind: 'hex', code: g.code, name: g.name, upper: g.upper, lower: g.lower },
        `${g.name}\n${g.shortName}`,
        g.keywords.join('\n'),
        bodyOfHex(g),
      ),
    );
  }

  for (const text of SHIYI_TEXTS) {
    for (const chapter of text.chapters) {
      const chapterTitle = chapter.title ?? `第 ${chapter.index} 章`;
      const annotations = (chapter.annotations ?? []).map((a) => a.text).join('\n');
      for (const p of chapter.paragraphs) {
        const paraNotes = (p.annotations ?? []).map((a) => a.text).join('\n');
        entries.push(
          withLower(
            {
              kind: 'shiyi',
              slug: text.slug,
              title: `${text.name} · ${chapterTitle}`,
              subtitle: `${text.name} 第 ${chapter.index} 章`,
            },
            `${text.name}\n${text.nameTraditional}\n${chapterTitle}`,
            chapter.quote ?? '',
            [p.textHans ?? p.text, p.text, annotations, paraNotes].filter(Boolean).join('\n'),
          ),
        );
      }
    }
  }

  return entries;
}

/** 把命中位置周围的文字截成摘要 */
function excerpt(text: string, at: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= SNIPPET_MAX) return flat;
  // 命中点两侧各留一半；在压缩空白后重新定位（长度会变，按比例近似即可）
  const ratio = text.length ? at / text.length : 0;
  const center = Math.round(ratio * flat.length);
  const start = Math.max(0, Math.min(flat.length - SNIPPET_MAX, center - Math.floor(SNIPPET_MAX / 2)));
  return `${start > 0 ? '…' : ''}${flat.slice(start, start + SNIPPET_MAX)}${start + SNIPPET_MAX < flat.length ? '…' : ''}`;
}

/**
 * 搜索知识库。空查询返回空数组。
 *
 * 权重：卦名 / 篇名 / 章题 3 分，关键词 / 章引 2 分，正文 1 分。
 * 同分时保持原始顺序（卦按先天序、十翼按篇序），结果稳定可预期。
 */
export function searchKnowledge(query: string, limit = 40): KnowledgeHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const entries = (index ??= buildIndex());

  const hits: KnowledgeHit[] = [];
  for (const e of entries) {
    const t = e.titleLower.indexOf(q);
    const g = e.tagLower.indexOf(q);
    const b = e.bodyLower.indexOf(q);
    if (t < 0 && g < 0 && b < 0) continue;
    const score = t >= 0 ? 3 : g >= 0 ? 2 : 1;
    const snippet =
      b >= 0
        ? excerpt(e.bodyText, b)
        : g >= 0
          ? excerpt(e.tagText, g)
          : excerpt(e.titleText, Math.max(t, 0));
    hits.push({ ...(e.hit as KnowledgeHit), snippet, score } as KnowledgeHit);
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** 仅供测试：丢弃索引缓存 */
export function resetKnowledgeSearchIndex(): void {
  index = null;
}
