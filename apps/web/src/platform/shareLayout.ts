/* ============================================================
 * 一键分享卡片 —— 版面计算（纯函数）
 *
 * 抽成纯函数（不碰 DOM、不碰 canvas 实例），只依赖调用方传入的
 * 「按字体测量文本宽度」回调，因此可在 jsdom 下直接单测。
 *
 * 设计约束（2026-10-14 修分享卡片排版）：
 *   1. 卡片高度**由内容算出**，不再写死 880px —— 短答案不出现大片空白，
 *      长答案也不会被画布底边裁掉；
 *   2. 画布显示尺寸交给 CSS，按 width/height 比例等比缩放（变量 --share-ratio），
 *      不再把 600px 硬写进 canvas.style.width —— 手机窄屏不再横向溢出，
 *      桌面矮窗口也不会被 max-height 单项压扁；
 *   3. 断行带「避头尾」：收尾标点不落行首、开引号开括号不落行尾。
 * ============================================================ */

/** 文本宽度测量：给定文本与 canvas font 串，返回像素宽度 */
export type Measure = (text: string, font: string) => number;

/** 卡片字体串（由页面 CSS 变量的真实字体栈拼出，保证与界面一致） */
export interface ShareFonts {
  readonly title: string;
  readonly name: string;
  readonly sub: string;
  readonly relation: string;
  readonly headline: string;
  readonly answer: string;
  /** 起卦信息行（起卦方式 · 农历时间），可有可无 */
  readonly meta: string;
  readonly footer: string;
}

/** 画布逻辑宽度（绘制坐标系宽度，与导出像素由 DPR 决定） */
export const CARD_W = 600;
/** 正文左右留白 */
export const PAD_X = 54;
/** 正文可用宽度 */
export const CONTENT_W = CARD_W - PAD_X * 2;
/** 卡片最小高度：短答案时兜底，避免压成横条 */
export const CARD_MIN_H = 720;

/** 边框内缩 */
export const INSET = 22;
export const TITLE_Y = 80;
export const NAME_Y = 152;
export const SUB_Y = 182;
export const GLYPH_TOP = 220;
export const GLYPH_ROW_H = 20;
export const GLYPH_GAP = 12;
/** 卦画总宽（居中） */
export const GLYPH_W = 240;
export const HEADLINE_LINE_H = 38;
export const ANSWER_LINE_H = 32;

/** 卦画底 → 体用关系行 */
const RELATION_GAP = 46;
/** 体用关系行 → 总断 */
const HEADLINE_GAP = 46;
/** 总断末行 → 正文首行 */
const ANSWER_GAP = 48;
/** 正文末行 → 起卦信息行 */
const META_GAP = 46;
/** 正文末行 → 落款 */
const FOOTER_GAP = 58;
/** 落款 → 卡片底边 */
const FOOTER_BOTTOM = 54;

/** 起卦信息行的行高（字号 14px，留出对「长农历串换行」的余量） */
export const META_LINE_H = 24;

/** 收尾标点：不允许出现在行首（宁可让上一行轻微超出） */
const NO_LINE_START = '，。、；：？！）】》」』”’%…·,.;:?!)]}';
/** 起始标点：不允许出现在行尾（连同下一字一起挪到下一行） */
const NO_LINE_END = '（【《「『“‘([{';

/**
 * 净化从 CSS 变量读到的字体栈，使其可安全拼进 canvas 的 `ctx.font`。
 *
 * `getComputedStyle` 取回的值可能带换行与多余空白（tokens.css 里就是折行写的），
 * 其中包含换行符时 `ctx.font` 赋值会被浏览器静默忽略、退回默认 10px sans-serif，
 * 于是「测量」与「绘制」用两套字号，版面直接错位——这是必须挡掉的风险。
 */
export function cleanFontStack(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/[;{}]/g, '')
    .replace(/,\s*$/, '')
    .trim();
  return cleaned || fallback;
}

export function shareFonts(sans: string, serif: string): ShareFonts {
  const s = sans.trim() || 'sans-serif';
  const f = serif.trim() || 'serif';
  return {
    title: `600 26px ${s}`,
    name: `700 46px ${f}`,
    sub: `16px ${s}`,
    relation: `600 21px ${s}`,
    headline: `700 24px ${s}`,
    answer: `18px ${s}`,
    meta: `14px ${s}`,
    footer: `13px ${s}`,
  };
}

/**
 * 断行（按字符，兼容 CJK）。
 *
 * - 拼接回去必须与原文一致（不丢字、不加字）
 * - 行首不出现收尾标点；行尾不出现起始标点
 */
export function splitLines(measure: Measure, font: string, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of Array.from(text)) {
    if (ch === '\n') {
      if (line) lines.push(line);
      line = '';
      continue;
    }
    if (line && measure(line + ch, font) > maxWidth) {
      if (NO_LINE_START.includes(ch)) {
        // 标点悬挂：本行多带一个字，避免行首孤标点
        line += ch;
        continue;
      }
      const tail = line.slice(-1);
      if (NO_LINE_END.includes(tail)) {
        lines.push(line.slice(0, -1));
        line = tail + ch;
      } else {
        lines.push(line);
        line = ch;
      }
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export interface ShareLayout {
  readonly width: number;
  readonly height: number;
  /** width / height，供 CSS 等比缩放用 */
  readonly ratio: number;
  readonly inset: number;
  readonly titleY: number;
  readonly nameY: number;
  readonly subY: number;
  readonly glyphTop: number;
  readonly glyphRowH: number;
  readonly glyphGap: number;
  readonly glyphW: number;
  readonly glyphBottom: number;
  readonly relationY: number;
  readonly headlineY: number;
  readonly headlineLineH: number;
  /** 正文首行基线 */
  readonly answerY: number;
  readonly answerLineH: number;
  /** 起卦信息行首行基线（无 meta 时为 0，不参与绘制） */
  readonly metaY: number;
  readonly metaLineH: number;
  readonly metaLines: readonly string[];
  readonly footerY: number;
  readonly contentX: number;
  readonly contentW: number;
  readonly headlineLines: readonly string[];
  readonly answerLines: readonly string[];
}

/** 由答案与总断文案算出整张卡几何 */
export function computeShareLayout(
  measure: Measure,
  fonts: ShareFonts,
  input: { answer: string; headline: string; meta?: string },
): ShareLayout {
  const headlineLines = splitLines(measure, fonts.headline, input.headline, CONTENT_W);
  const glyphBottom = GLYPH_TOP + 6 * GLYPH_ROW_H + 5 * GLYPH_GAP;

  const relationY = glyphBottom + RELATION_GAP;
  const headlineY = relationY + HEADLINE_GAP;
  const answerY = headlineY + (headlineLines.length - 1) * HEADLINE_LINE_H + ANSWER_GAP;

  const answerLines = splitLines(measure, fonts.answer, input.answer, CONTENT_W);
  const answerEnd = answerY + (answerLines.length - 1) * ANSWER_LINE_H;

  /* 起卦信息行（「时间起卦 · 丙午年 八月十五 午时」）可有可无：
   * 未传时几何与旧版逐像素一致（既有单测断言不受影响）。 */
  const metaLines =
    input.meta && input.meta.trim()
      ? splitLines(measure, fonts.meta, input.meta.trim(), CONTENT_W)
      : [];
  const metaY = metaLines.length ? answerEnd + META_GAP : 0;
  const tailEnd = metaLines.length ? metaY + (metaLines.length - 1) * META_LINE_H : answerEnd;

  const height = Math.max(CARD_MIN_H, Math.round(tailEnd + FOOTER_GAP + FOOTER_BOTTOM));

  return {
    width: CARD_W,
    height,
    ratio: CARD_W / height,
    inset: INSET,
    titleY: TITLE_Y,
    nameY: NAME_Y,
    subY: SUB_Y,
    glyphTop: GLYPH_TOP,
    glyphRowH: GLYPH_ROW_H,
    glyphGap: GLYPH_GAP,
    glyphW: GLYPH_W,
    glyphBottom,
    relationY,
    headlineY,
    headlineLineH: HEADLINE_LINE_H,
    answerY,
    answerLineH: ANSWER_LINE_H,
    metaY,
    metaLineH: META_LINE_H,
    metaLines,
    footerY: height - FOOTER_BOTTOM,
    contentX: PAD_X,
    contentW: CONTENT_W,
    headlineLines,
    answerLines,
  };
}
