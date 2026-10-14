/* ============================================================
 * 分享卡片版面测试
 *
 * 起因：用户反馈分享卡片在手机端横向溢出、被两侧裁切，PC 端被压扁且底部大片空白。
 * 根因在「固定画布 + 写死显示宽度」，修复后版面尺寸由 computeShareLayout 决定，
 * 这里把断行规则与几何关系钉死，防止日后又退回固定尺寸。
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { interpret, resolve } from '@plumora/core';
import {
  CARD_MIN_H,
  CARD_W,
  CONTENT_W,
  cleanFontStack,
  computeShareLayout,
  shareFonts,
  splitLines,
  type Measure,
} from '@/platform/shareLayout';

/** 等宽估算测量：中日韩字符按 1 个字宽，其余按半宽 —— 只为验证断行规则，不追求与浏览器像素一致 */
const estimate: Measure = (text, font) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16);
  return Array.from(text).reduce(
    (w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? size : size * 0.5),
    0,
  );
};

const fonts = shareFonts('sans-serif', 'serif');
const LONG =
  '问「身体方面要注意什么」，一句话的答案：会好。体用比和，你和这件事气场相合，不冲不克，顺顺当当。' +
  '但走势往下：后头不如前头，眼下顺也别大意，收尾要守住。身体没什么大碍，按时作息、配合调养，会慢慢好转。';

describe('cleanFontStack', () => {
  it('吃掉换行与多余空白、去尾随逗号（否则 ctx.font 赋值会被静默忽略）', () => {
    const raw = `-apple-system, BlinkMacSystemFont, 'PingFang SC',\n    'Microsoft YaHei',\n`,
    expected = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei'";
    expect(cleanFontStack(raw, 'sans-serif')).toBe(expected);
    expect(cleanFontStack('', 'sans-serif')).toBe('sans-serif');
    expect(cleanFontStack('   \n  ', 'sans-serif')).toBe('sans-serif');
    expect(cleanFontStack('Arial; background: red', 'sans-serif')).toBe('Arial background: red');
  });
});

describe('splitLines', () => {
  it('不丢字：拼回去与原文完全一致', () => {
    const lines = splitLines(estimate, fonts.answer, LONG, CONTENT_W);
    expect(lines.join('')).toBe(LONG);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('每行不超宽（含标点悬挂也最多溢出一个字宽）', () => {
    const lines = splitLines(estimate, fonts.answer, LONG, CONTENT_W);
    for (const line of lines) {
      expect(estimate(line, fonts.answer)).toBeLessThanOrEqual(CONTENT_W + 18);
    }
  });

  it('避头尾：行首不出现收尾标点，行尾不出现开引号开括号', () => {
    const text = '这是一段话，里面有标点。还有「引号」与（括号），以及问号？感叹号！都要处理妥当。';
    const lines = splitLines(estimate, fonts.answer, text, 200);
    expect(lines.join('')).toBe(text);
    const noStart = '，。、；：？！）】》」』';
    const noEnd = '（【《「『';
    for (const line of lines.slice(1)) {
      expect(noStart.includes(line.slice(0, 1))).toBe(false);
    }
    for (const line of lines) {
      expect(noEnd.includes(line.slice(-1))).toBe(false);
    }
  });

  it('支持显式换行，且空文本不返回空数组', () => {
    expect(splitLines(estimate, fonts.answer, '一\n二', CONTENT_W)).toEqual(['一', '二']);
    expect(splitLines(estimate, fonts.answer, '', CONTENT_W)).toEqual(['']);
  });
});

describe('computeShareLayout', () => {
  const base = { headline: '体用比和 · 吉　本末一致，始终如一' };

  it('高度由内容算出：不短于最小值，答案越长越高', () => {
    const short = computeShareLayout(estimate, fonts, { ...base, answer: '会好。' });
    const long = computeShareLayout(estimate, fonts, { ...base, answer: LONG });

    expect(short.height).toBeGreaterThanOrEqual(CARD_MIN_H);
    expect(long.height).toBeGreaterThan(short.height);
    expect(short.width).toBe(CARD_W);
  });

  it('比例、落款与正文互不重叠', () => {
    const L = computeShareLayout(estimate, fonts, { ...base, answer: LONG });

    expect(L.ratio).toBeCloseTo(L.width / L.height, 6);
    expect(L.ratio).toBeGreaterThan(0.4);
    expect(L.ratio).toBeLessThan(1);
    // 落款在最后一行正文之下
    const answerEnd = L.answerY + (L.answerLines.length - 1) * L.answerLineH;
    expect(L.footerY).toBeGreaterThan(answerEnd);
    // 卦画、体用行、总断、正文自上而下不重叠
    expect(L.glyphTop).toBeGreaterThan(L.subY);
    expect(L.glyphBottom).toBeGreaterThan(L.glyphTop);
    expect(L.relationY).toBeGreaterThan(L.glyphBottom);
    expect(L.headlineY).toBeGreaterThan(L.relationY);
    expect(L.answerY).toBeGreaterThan(L.headlineY);
    // 落款不越出卡片
    expect(L.footerY).toBeLessThan(L.height);
  });

  it('总断换行后正文起点随之下移，不会盖住总断', () => {
    const one = computeShareLayout(estimate, fonts, { ...base, answer: LONG });
    const two = computeShareLayout(estimate, fonts, {
      headline: '用克体 · 大凶　先顺后逆，结局宜防先顺后逆，结局宜防先顺后逆，结局宜防',
      answer: LONG,
    });
    expect(one.headlineLines.length).toBe(1);
    expect(two.headlineLines.length).toBeGreaterThan(1);
    expect(two.answerY).toBeGreaterThan(one.answerY);
  });

  it('真实解卦文案能算出版面，正文不出卡片右边界', () => {
    const r = resolve(6, 5, 1);
    const out = interpret(r, '身体方面要注意什么');
    const L = computeShareLayout(estimate, fonts, { answer: out.answer, headline: out.headline });

    expect(L.answerLines.length).toBeGreaterThan(1);
    expect(L.contentX + estimate(L.answerLines[0]!, fonts.answer)).toBeLessThanOrEqual(
      CARD_W - L.contentX + 18,
    );
    expect(L.height).toBeGreaterThan(CARD_MIN_H - 1);
  });

  it('起卦信息行：不传时几何与「无此行」完全一致（不回归既有版面）', () => {
    const withoutMeta = computeShareLayout(estimate, fonts, { ...base, answer: LONG });
    const emptyMeta = computeShareLayout(estimate, fonts, { ...base, answer: LONG, meta: '   ' });

    expect(withoutMeta.metaLines).toEqual([]);
    expect(withoutMeta.metaY).toBe(0);
    expect(emptyMeta.metaLines).toEqual([]);
    expect(emptyMeta.height).toBe(withoutMeta.height);
  });

  it('起卦信息行：传了就排在正文与落款之间，且把卡片撑高', () => {
    const without = computeShareLayout(estimate, fonts, { ...base, answer: LONG });
    const withMeta = computeShareLayout(estimate, fonts, {
      ...base,
      answer: LONG,
      meta: '时间起卦 · 丙午年 八月十五 午时',
    });

    expect(withMeta.metaLines.join('')).toBe('时间起卦 · 丙午年 八月十五 午时');
    const answerEnd = withMeta.answerY + (withMeta.answerLines.length - 1) * withMeta.answerLineH;
    expect(withMeta.metaY).toBeGreaterThan(answerEnd);
    expect(withMeta.footerY).toBeGreaterThan(withMeta.metaY);
    expect(withMeta.footerY).toBeLessThan(withMeta.height);
    expect(withMeta.height).toBeGreaterThan(without.height);
  });
});
