#!/usr/bin/env node
/* ============================================================
 * 笔画对拍裁决器 —— npm run knowledge:adjudicate
 *
 * 把 hanzi-writer-data@2.0.1（大陆辞书笔画口径的开源数据集）与
 * Unicode Unihan kTotalStrokes 逐字对拍，把**裁决结果 + 理由**写进
 * packages/knowledge/src/strokes-overrides.ts 的 HWD_OVERRIDES 块。
 *
 * 裁决口径（05 文档 §4.2「不得批量推测」的可执行化）：
 *   0. 先查 DECISIONS —— 逐字显式裁决优先于下面两条批量口径（含 |Δ| = 1 的例外，
 *      目前只有「華」一例：|Δ|=1 本应取 hwd，但 05 §4.2 / 金标准以 Unihan 12 为准）。
 *   A. |Δ| = 1（部首部件口径差：艹 4↔3、辶 4↔3、金/骨/鬼…）→ 取 hwd。
 *      依据：现役 117 表里 4 个差异字（花 7、道 12、福 13、禄 12）hwd 与现表
 *      完全一致、Unihan 恒 +1 —— hwd 更贴近大陆辞书口径。
 *   B. |Δ| ≥ 2 → 逐字裁决（见 DECISIONS，每字写明 kRSUnicode 残差或部件算术依据）；
 *      表里没有的离群字一律**保留 Unihan 并在报告里点名**，不做批量替换。
 *
 * ⚠️ 本脚本需要临时安装对拍 oracle：
 *     npm i -D hanzi-writer-data --engine-strict=false
 *   裁决完成后 npm uninstall hanzi-writer-data（ArphicPL 许可不随本仓库分发，
 *   入库的只有裁决后的数值与注释）。卸载后再跑会直接报错并给出提示。
 * ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { ensureUnihanZip, parseUnihan, isDomainCodePoint, REPO_ROOT } from './lib/unihan.mjs';
import { parseOverrides, replaceHwdBlock } from './lib/overrides.mjs';

const OVERRIDES_PATH = path.join(REPO_ROOT, 'packages', 'knowledge', 'src', 'strokes-overrides.ts');
const REPORT_PATH = path.join(REPO_ROOT, 'scripts', '.cache', 'adjudicate-report.txt');
const HWD_PKG = path.join(REPO_ROOT, 'node_modules', 'hanzi-writer-data');

/* ── 0. oracle 就位检查 ───────────────────────────────── */

if (!fs.existsSync(HWD_PKG)) {
  console.error(
    '找不到 hanzi-writer-data（对拍 oracle 未安装）。\n' +
    '  安装：npm i -D hanzi-writer-data --engine-strict=false\n' +
    '  裁决完成后请 npm uninstall hanzi-writer-data（临时依赖，不入库）。',
  );
  process.exit(1);
}

/* ── 1. 读两侧数据 ───────────────────────────────────── */

const { buf } = await ensureUnihanZip();
const unihan = parseUnihan(buf);

const hwd = new Map();
for (const f of fs.readdirSync(HWD_PKG)) {
  if (!f.endsWith('.json') || f === 'package.json') continue;
  const ch = f.slice(0, -'.json'.length);
  if ([...ch].length !== 1) continue;
  const j = JSON.parse(fs.readFileSync(path.join(HWD_PKG, f), 'utf8'));
  hwd.set(ch, j.strokes.length);
}

/* ── 2. 逐字裁决表（|Δ| ≥ 2 用；键为码点） ──────────── */

const DECISIONS = new Map(
  Object.entries({
    0x507d: { take: 'unihan', why: 'kRS 9.9 残差 9 + 亻2 = 11 自洽；hwd 14 沿用「為=12」误值' },
    0x5ef6: { take: 'hwd', why: '延通行 6 画（部件算术：廴3 + 上3）；Unihan 8 无部件依据' },
    0x70ba: { take: 'unihan', why: 'kRS 86.5 残差 5 + 爫4 = 9 自洽；hwd 12 系按「爫4+隹8」误拆' },
    0x750d: { take: 'unihan', why: 'kRS 98.11 残差 11 + 瓦5 = 16 自洽；hwd 14 拆分无法自证（生僻字，留待二校）' },
    0x7b75: { take: 'hwd', why: '= ⺮6 + 延6（延本字裁 6）' },
    0x820b: { take: 'hwd', why: 'kRS 134.13 残差 13：Unihan 13−13=0（部件 0 画不成立），hwd 19−13=6 合理' },
    0x83ef: { take: 'unihan', why: '口径 A 的显式例外：kRS 140.8 残差 8，Unihan 12 = 艹4 + 8 自洽（hwd 11 = 艹3 + 8）；05 §4.2 与金标准「華 t=12」取 Unihan 口径' },
    0x8425: { take: 'hwd', why: '= 艹3 + 冖2 + 吕6' },
    0x8457: { take: 'hwd', why: '= 艹3 + 者8' },
    0x8490: { take: 'hwd', why: 'kRS 140.10 残差 10 + 艹4 = 14 自洽' },
    0x84ec: { take: 'hwd', why: '= 艹3 + 逢10（逢 = 辶3 + 夆7）' },
    0x85af: { take: 'hwd', why: '= 艹3 + 罒5 + 者8' },
    0x90fd: { take: 'hwd', why: '= 者8 + 阝2；Unihan 12 与自身 kRS 163.9（残差9）也不自洽' },
    0x9109: { take: 'hwd', why: 'kRS 163.9 残差 9 + 阝2 = 11 自洽' },
    0x931a: { take: 'hwd', why: 'kRS 167.8 残差 8 + 金8 = 16 自洽' },
    0x9ad2: { take: 'hwd', why: 'kRS 188.13 残差 13 + 骨10 = 23 自洽' },
    0x9ad6: { take: 'hwd', why: 'kRS 188.15 残差 15 + 骨10 = 25 自洽' },
    0x9b56: { take: 'hwd', why: 'kRS 194.12 残差 12 + 鬼10 = 22 自洽' },
    0x9f9c: { take: 'unihan', why: 'kRS 213.0 残差 0，龜即部首本体（16 画）；hwd 18 无据' },
  }).map(([k, v]) => [Number(k), v]),
);

/* ── 3. 对拍 ─────────────────────────────────────────── */

const overrides = parseOverrides(fs.readFileSync(OVERRIDES_PATH, 'utf8'));

const diffs = [];
for (const [c, hv] of hwd) {
  const cp = c.codePointAt(0);
  if (!isDomainCodePoint(cp)) continue;
  const uv = unihan.strokes.get(cp);
  if (uv === undefined || uv === hv) continue;
  diffs.push({ c, cp, hwd: hv, unihan: uv, delta: hv - uv });
}
diffs.sort((a, b) => a.cp - b.cp);

const body = ['/** ② hanzi-writer-data@2.0.1 与 Unihan 的逐字裁决（脚本生成，含理由） */',
  'export const HWD_OVERRIDES: Readonly<Record<string, number>> = {'];
const taken = { hwd: 0, unihan: 0 };
const undecided = [];
const rows = [];
let baselineHit = 0;

for (const d of diffs) {
  const abs = Math.abs(d.delta);
  const inBaseline = overrides.baseline.has(d.c);
  if (inBaseline) baselineHit++;
  let value;
  let verdict;
  if (DECISIONS.has(d.cp)) {
    // 口径 0：逐字显式裁决优先（可覆盖 |Δ|=1 的批量口径 A）
    const dec = DECISIONS.get(d.cp);
    value = dec.take === 'hwd' ? d.hwd : d.unihan;
    verdict = dec.take === 'hwd' ? '取 hwd' : '保留 Unihan';
    taken[dec.take]++;
    rows.push(`  ${d.c}: ${value}, // hwd ${d.hwd} / Unihan ${d.unihan}（Δ${d.delta}）→ ${verdict}：${dec.why}`);
  } else if (abs === 1) {
    value = d.hwd;
    verdict = '取 hwd';
    taken.hwd++;
    const dir = d.delta < 0 ? 'hwd 小 1（艹/辶/⺮…部件口径）' : 'hwd 大 1（金/骨/鬼…部件口径）';
    let why = `${dir}；大陆辞书口径，现表 4 个差异字（花/道/福/禄）已验证该方向`;
    if (inBaseline) why += '；与现表冻结值一致';
    rows.push(`  ${d.c}: ${value}, // hwd ${d.hwd} / Unihan ${d.unihan}（Δ${d.delta}）→ ${verdict}：${why}`);
  } else {
    undecided.push(`${d.c} U+${d.cp.toString(16).toUpperCase()} hwd=${d.hwd} Unihan=${d.unihan} Δ=${d.delta}`);
    continue;
  }
  body.push(rows[rows.length - 1]);
}
body.push('};');

if (undecided.length) {
  console.error(`发现 ${undecided.length} 个 |Δ|≥2 且未在 DECISIONS 表中的差异字（按口径 B 保留 Unihan，不写入 overrides）：\n  ${undecided.join('\n  ')}`);
}

/* ── 4. 回写 overrides ───────────────────────────────── */

const prev = fs.readFileSync(OVERRIDES_PATH, 'utf8');
fs.writeFileSync(OVERRIDES_PATH, replaceHwdBlock(prev, body), 'utf8');

const report = [
  '# 笔画对拍裁决报告',
  ``,
  `oracle：hanzi-writer-data@2.0.1（${hwd.size} 字）`,
  `底座：Unicode Unihan ${unihan.version}`,
  `域内差异字：${diffs.length}`,
  `  |Δ|=1 → 取 hwd            ${diffs.filter((d) => Math.abs(d.delta) === 1).length}（DECISIONS 显式例外另计）`,
  `  DECISIONS 逐字裁决（口径 0，优先） ${[...DECISIONS.keys()].length} 条`,
  `    其中取 hwd / 保留 Unihan  ${taken.hwd} / ${taken.unihan}（含 |Δ|=1）`,
  `  未裁决（保留 Unihan）        ${undecided.length}${undecided.length ? '：' + undecided.join('；') : ''}`,
  `  与现役 117 表重叠            ${baselineHit}`,
  ``,
  `写入 strokes-overrides.ts 的 HWD_OVERRIDES：${rows.length} 行`,
  ``,
  `离群字（|Δ|≥2）逐字裁决：`,
  ...diffs.filter((d) => Math.abs(d.delta) >= 2).map((d) => {
    const dec = DECISIONS.get(d.cp);
    const v = !dec ? '保留 Unihan（未裁决）' : dec.take === 'hwd' ? `取 hwd ${d.hwd}` : `保留 Unihan ${d.unihan}`;
    return `  ${d.c} U+${d.cp.toString(16).toUpperCase()}  hwd=${d.hwd} Unihan=${d.unihan} Δ=${d.delta} → ${v}`;
  }),
  '',
].join('\n');
fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, report, 'utf8');

console.log(`OK diffs=${diffs.length} rows=${rows.length} taken(hwd/unihan)=${taken.hwd}/${taken.unihan} undecided=${undecided.length}`);
console.log('report: scripts/.cache/adjudicate-report.txt');
if (undecided.length) process.exitCode = 2;
