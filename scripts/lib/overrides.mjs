/* ============================================================
 * strokes-overrides.ts 的读写 —— 供 scripts/build-strokes.mjs /
 * scripts/adjudicate-strokes.mjs 共用。
 *
 * overrides 文件是**人工裁决层**（05 文档 §4.2「不得批量推测」的落地物），
 * 必须能被人直接读、逐字注释理由；所以这里用「严格逐行正则」解析而不是
 * 引入 TS 编译器：任何一行不符合约定形态都会**直接报错并给出行号**，
 * 保证手改不会悄悄失效。
 * ============================================================ */

/** 三个导出块的名称 */
const BLOCKS = ['BASELINE_STROKES', 'BASELINE_TRADITIONAL_ALIAS', 'HWD_OVERRIDES'];
const HWD_BEGIN = '/* ==== HWD_BEGIN ==== */';
const HWD_END = '/* ==== HWD_END ==== */';

/** 单行形态（允许行尾注释） */
const RE_ENTRY = /^(.)\s*:\s*\{\s*s:\s*(\d+)(?:\s*,\s*t:\s*(\d+))?\s*,?\s*\}\s*,?\s*(?:\/\/.*)?$/;
const RE_ALIAS = /^(.)\s*:\s*'(.)'\s*,?\s*(?:\/\/.*)?$/;
const RE_HWD = /^(.)\s*:\s*(\d+)\s*,?\s*(?:\/\/.*)?$/;

const isIgnorable = (line) => {
  const t = line.trim();
  return t === '' || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*');
};

/**
 * 解析 overrides 文件。
 *
 * @param {string} text 文件全文
 * @returns {{ baseline: Map<string,{s:number,t?:number}>, baselineAlias: Map<string,string>, hwd: Map<string,number> }}
 */
export function parseOverrides(text) {
  const lines = text.split(/\r?\n/);
  const blocks = {};
  for (const name of BLOCKS) {
    const start = lines.findIndex((l) => l.includes(`export const ${name}`));
    if (start < 0) throw new Error(`strokes-overrides.ts：找不到 export const ${name}`);
    let end = -1;
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].trim() === '};') { end = i; break; }
    }
    if (end < 0) throw new Error(`strokes-overrides.ts：${name} 块没有以 "};\" 结束`);
    blocks[name] = { body: lines.slice(start + 1, end), from: start + 1 };
  }

  const baseline = new Map();
  for (const [i, raw] of blocks.BASELINE_STROKES.body.entries()) {
    if (isIgnorable(raw)) continue;
    const m = RE_ENTRY.exec(raw.trim());
    if (!m) throw new Error(`strokes-overrides.ts 第 ${blocks.BASELINE_STROKES.from + i + 1} 行形态不符：${raw}`);
    const [, ch, s, t] = m;
    if (baseline.has(ch)) throw new Error(`BASELINE_STROKES 重复键：${ch}`);
    baseline.set(ch, t === undefined ? { s: Number(s) } : { s: Number(s), t: Number(t) });
  }

  const baselineAlias = new Map();
  for (const [i, raw] of blocks.BASELINE_TRADITIONAL_ALIAS.body.entries()) {
    if (isIgnorable(raw)) continue;
    const m = RE_ALIAS.exec(raw.trim());
    if (!m) throw new Error(`strokes-overrides.ts 第 ${blocks.BASELINE_TRADITIONAL_ALIAS.from + i + 1} 行形态不符：${raw}`);
    const [, from, to] = m;
    if (from === to) throw new Error(`BASELINE_TRADITIONAL_ALIAS 自指：${from}`);
    if (baselineAlias.has(from)) throw new Error(`BASELINE_TRADITIONAL_ALIAS 重复键：${from}`);
    baselineAlias.set(from, to);
  }

  const hwd = new Map();
  for (const [i, raw] of blocks.HWD_OVERRIDES.body.entries()) {
    if (isIgnorable(raw)) continue;
    const m = RE_HWD.exec(raw.trim());
    if (!m) throw new Error(`strokes-overrides.ts 第 ${blocks.HWD_OVERRIDES.from + i + 1} 行形态不符：${raw}`);
    const [, ch, v] = m;
    if (hwd.has(ch)) throw new Error(`HWD_OVERRIDES 重复键：${ch}`);
    hwd.set(ch, Number(v));
  }

  return { baseline, baselineAlias, hwd };
}

/**
 * 用新内容替换 HWD 裁决块（BEGIN/END 标记之间），保留文件其余部分原样。
 *
 * @param {string} text 文件全文
 * @param {string[]} body 行（含行尾理由注释）
 */
export function replaceHwdBlock(text, body) {
  const lines = text.split(/\r?\n/);
  const b = lines.findIndex((l) => l.trim() === HWD_BEGIN);
  const e = lines.findIndex((l) => l.trim() === HWD_END);
  if (b < 0 || e < 0 || e < b) throw new Error(`strokes-overrides.ts：找不到 ${HWD_BEGIN} / ${HWD_END} 标记`);
  const out = [...lines.slice(0, b + 1), ...body, ...lines.slice(e)];
  return out.join('\n');
}

export { HWD_BEGIN, HWD_END };
