#!/usr/bin/env node
/* ============================================================
 * 笔画全表生成器 —— npm run knowledge:build
 *
 * 产出：packages/knowledge/src/strokes.generated.ts（**派生目标，禁止手改**）
 *
 * 数据链路：
 *   1) Unihan.zip（钉死 sha256 的 Unicode 版本，见 scripts/lib/unihan.mjs）
 *      → kTotalStrokes / kTraditionalVariant / kSimplifiedVariant
 *   2) 键与别名规则（05 文档 §4.1）：键=简体字面、繁体面由 t 承载、
 *      歧义（s2t 多目标或含自身，UAX #38 §3.7.1 case-4a）按字面不换面
 *   3) 覆盖层 strokes-overrides.ts（优先级从高到低）：
 *      ① BASELINE_STROKES / BASELINE_TRADITIONAL_ALIAS（现表冻结）
 *      ② HWD_OVERRIDES（hanzi-writer-data 对拍裁决值）
 *      ③ Unihan 底座
 *
 * 校验不通过会直接非零退出；生成物**不接入 verify**（CI 不重新生成）。
 * ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ensureUnihanZip, parseUnihan, isDomainCodePoint, REPO_ROOT, UNIHAN_VERSION } from './lib/unihan.mjs';
import { parseOverrides } from './lib/overrides.mjs';

const GENERATED_PATH = path.join(REPO_ROOT, 'packages', 'knowledge', 'src', 'strokes.generated.ts');
const OVERRIDES_PATH = path.join(REPO_ROOT, 'packages', 'knowledge', 'src', 'strokes-overrides.ts');
const REPORT_PATH = path.join(REPO_ROOT, 'scripts', '.cache', 'build-report.txt');
const PER_LINE = 64; // 每行条数（生成物可读性与体积的折中）

/** 域内码点表 */
function domainCodePoints() {
  const out = [];
  for (let cp = 0; cp <= 0xffff; cp++) if (isDomainCodePoint(cp)) out.push(cp);
  return out;
}

/** 去重但**保留自身**：kTraditionalVariant 常把自身也列进去，「自身 ∈ 列表」
 *  本身就是歧义信号（UAX #38 §3.7.1 case-4a：s2t 多目标或含自身 → 不换面），  */
const dedup = (list) => [...new Set(list ?? [])];

const ch = (cp) => String.fromCodePoint(cp);

/* ── 1. 读数据 ─────────────────────────────────────────── */

const { buf } = await ensureUnihanZip();
const unihan = parseUnihan(buf);
const overrides = parseOverrides(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
const { baseline, baselineAlias, hwd } = overrides;

const domain = domainCodePoints();

/* ── 2. 裁决后取值 V(字) ───────────────────────────────── */

/** hwd 覆盖优先，其次 Unihan；域外字仍可取 Unihan */
function valueOf(cp) {
  const c = ch(cp);
  if (hwd.has(c)) return hwd.get(c);
  return unihan.strokes.get(cp);
}

/* ── 3. 别名（繁体字面 → 简体字面） ───────────────────── */

/** Y（繁）→ X（简）：s2t(X) 恰单目标且非自身 {Y}，且 t2s(Y) 恰单目标 {X}（UAX #38 非歧义对） */
const aliasMap = new Map();
const aliasOrigin = new Map(); // 记录来源：generated / baseline
for (const cp of domain) {
  const sT = dedup(unihan.s2t.get(cp));
  if (sT.length !== 1) continue; // 空 / 多目标（含「自身+另一目标」）→ 歧义，不建别名
  const y = sT[0];
  if (y === cp) continue; // 自身是唯一传统面 → 按字面，不建别名
  const tS = dedup(unihan.t2s.get(y));
  if (tS.length === 1 && tS[0] === cp) aliasMap.set(y, cp);
}
for (const [y, x] of aliasMap) aliasOrigin.set(y, 'generated');

// 覆盖层：现表 30 对别名权威冻结（冲突以现表为准）
const aliasConflicts = [];
for (const [from, to] of baselineAlias) {
  const yCp = from.codePointAt(0);
  const xCp = to.codePointAt(0);
  const prev = aliasMap.get(yCp);
  if (prev !== undefined && prev !== xCp) {
    aliasConflicts.push(`${from}→${to}（生成侧为 ${ch(prev)}）`);
  }
  aliasMap.set(yCp, xCp);
  aliasOrigin.set(yCp, 'baseline');
}

/** 是「别名目标」的键必须显式带 t（否则别名指向的键缺繁体笔画） */
const aliasTargets = new Set(aliasMap.values());

/* ── 4. 键 ─────────────────────────────────────────────── */

/**
 * 每个域内字建一个键；**例外**：只作为别名源（繁体字面）的字不建键，
 * 其笔画经别名归一到简体键上取（05 §4.1「不重复存数值」）。
 * 若某字**既是别名源又是别名目标**（Unihan 存在两步换面链：简→繁1→繁2），
 * 则仍建键——否则指向它的那条别名会落到空键上。
 */
const keys = new Map(); // cp → { s, t?, tRaw, sFrom, tFrom }
const noStrokes = [];
for (const cp of domain) {
  if (aliasMap.has(cp) && !aliasTargets.has(cp)) continue; // 繁体字面走别名，不建键
  const sT = dedup(unihan.s2t.get(cp));
  const tS = dedup(unihan.t2s.get(cp));

  let sFrom = cp;
  if (tS.length === 1 && isDomainCodePoint(tS[0]) && unihan.strokes.has(tS[0])) sFrom = tS[0];
  let tFrom = cp;
  if (sT.length === 1) tFrom = sT[0]; // 多目标（歧义）→ 按字面；自指 → 等于 cp

  const s = valueOf(sFrom);
  const tRaw = valueOf(tFrom);
  if (s === undefined || tRaw === undefined) noStrokes.push(ch(cp));
  // 05 §4.1「缺省视为与简体相同」：t 与 s 同值时省略（原表的字段省略语义）
  keys.set(cp, { s, t: tRaw !== undefined && tRaw !== s ? tRaw : undefined, tRaw, sFrom, tFrom });
}

/* ── 5. 覆盖层合并 ────────────────────────────────────── */

const baselineOnAliasSource = [];
const fieldDrift = []; // 现表与生成值不一致的字（逐字列出，供复核）
for (const [c, b] of baseline) {
  const cp = c.codePointAt(0);
  if (aliasMap.has(cp)) { baselineOnAliasSource.push(c); continue; }
  if (!keys.has(cp)) {
    throw new Error(`BASELINE_STROKES 的 ${c} 不在收字域（URO + 扩展 A）内`);
  }
  const k = keys.get(cp);
  if (k.s !== b.s || k.t !== b.t) {
    const fmtE = (s, t) => `{s:${s}${t === undefined ? '' : `,t:${t}`}}`;
    const onlyExplicitSame = k.s === b.s && b.t !== undefined && b.t === b.s && k.t === undefined;
    fieldDrift.push(
      `${c}：生成 ${fmtE(k.s, k.t)} → 现表 ${fmtE(b.s, b.t)}` +
        (onlyExplicitSame ? '（同值；现表显式写 t，仅影响 fellBackToSimplified 标志）' : ''),
    );
  }
  k.s = b.s;
  if ('t' in b) k.t = b.t;
}
if (baselineOnAliasSource.length) {
  throw new Error(`BASELINE_STROKES 与别名冲突（这些字是别名源，不得再建键）：${baselineOnAliasSource.join(' ')}`);
}
for (const [from, to] of baselineAlias) {
  if (!keys.has(to.codePointAt(0))) throw new Error(`BASELINE_TRADITIONAL_ALIAS 的目标键 ${to} 不存在`);
}

// 别名目标必须显式带 t
let forcedT = 0;
for (const x of aliasTargets) {
  const k = keys.get(x);
  if (!k) throw new Error(`别名目标 ${ch(x)} 没有对应键`);
  if (k.t === undefined) { k.t = k.s; forcedT++; }
  else if (k.t === k.s) { forcedT++; } // 显式保留（值相同也写出来，供别名完整性校验）
}

/* ── 6. 校验 ──────────────────────────────────────────── */

const errors = [];
if (noStrokes.length) errors.push(`缺 Unihan 笔画：${noStrokes.join(' ')}`);

const outOfRange = [];
const covered = 0;
let tPresent = 0;
for (const cp of domain) {
  const k = keys.get(cp);
  if (!k) {
    if (!aliasMap.has(cp)) errors.push(`域内字未覆盖：${ch(cp)}`);
    continue;
  }
  if (k.t !== undefined) tPresent++;
  for (const v of [k.s, k.t]) {
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < 1 || v > 84) outOfRange.push(`${ch(cp)}=${v}`);
  }
}
if (outOfRange.length) errors.push(`笔画越界（应 1–84）：${outOfRange.join(' ')}`);

// 别名完整性：目标键存在且带 t；别名源**不得**再是键（除非它同时是别名目标——
// Unihan 的两步换面链 简→繁1→繁2，中间字如「苧」两侧都占，此时直接键优先）
for (const [y, x] of aliasMap) {
  const k = keys.get(x);
  if (!k) errors.push(`别名 ${ch(y)}→${ch(x)} 的目标不是键`);
  else if (k.t === undefined) errors.push(`别名 ${ch(y)}→${ch(x)} 的目标键缺 t`);
  if (keys.has(y) && !aliasTargets.has(y)) errors.push(`${ch(y)} 既是别名源又是键（lookup 会绕过别名）`);
}

// 金标准（05 §4.2 + 运行时契约）
const gold = [
  ['梅 s', keys.get(0x6885)?.s, 11],
  ['梅 t', keys.get(0x6885)?.t, 11],
  ['花 s', keys.get(0x82b1)?.s, 7],
  ['花 t', keys.get(0x82b1)?.t, 8],
  ['观 s', keys.get(0x89c2)?.s, 6],
  ['观 t', keys.get(0x89c2)?.t, 25],
  ['华 s', keys.get(0x534e)?.s, 6],
  ['华 t', keys.get(0x534e)?.t, 12],
  ['後 s', keys.get(0x5f8c)?.s, 6],
  ['後 t', keys.get(0x5f8c)?.t, 9],
  ['發 s', keys.get(0x767c)?.s, 5],
  ['發 t', keys.get(0x767c)?.t, 12],
  ['后 s', keys.get(0x540e)?.s, 6],
  ['后 t（歧义按字面→省略）', keys.get(0x540e)?.t, undefined],
  ['发 s', keys.get(0x53d1)?.s, 5],
  ['发 t（歧义按字面→省略）', keys.get(0x53d1)?.t, undefined],
];
for (const [label, actual, expect] of gold) {
  if (actual !== expect) errors.push(`金标准不符 ${label}：实际 ${actual}，期望 ${expect}`);
}
for (const [from, to] of [['觀', '观'], ['藥', '药'], ['書', '书'], ['門', '门'], ['風', '风'], ['華', '华']]) {
  const y = from.codePointAt(0);
  const x = to.codePointAt(0);
  if (aliasMap.get(y) !== x) errors.push(`别名缺失：${from}→${to}`);
}

if (errors.length) {
  console.error('校验失败：\n- ' + errors.join('\n- '));
  process.exit(1);
}

/* ── 7. 输出 strokes.generated.ts ─────────────────────── */

const entryItems = [...keys.keys()].sort((a, b) => a - b).map((cp) => {
  const k = keys.get(cp);
  return k.t === undefined ? `${ch(cp)}:${k.s}` : `${ch(cp)}:${k.s}:${k.t}`;
});
const aliasItems = [...aliasMap.keys()].sort((a, b) => a - b).map((cp) => `${ch(cp)}:${ch(aliasMap.get(cp))}`);

const pack = (items) => {
  const lines = [];
  for (let i = 0; i < items.length; i += PER_LINE) lines.push(items.slice(i, i + PER_LINE).join(';'));
  return lines;
};
const entryLines = pack(entryItems);
const aliasLines = pack(aliasItems);

const generatedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const header = `/* ============================================================
 * ⚠️ 自动生成文件，禁止手工修改！
 *   生成器：scripts/build-strokes.mjs（npm run knowledge:build）
 *   人工裁决层：同目录 strokes-overrides.ts（数值以那里的注释为准）
 *
 * 数据源：Unicode Unihan ${UNIHAN_VERSION}
 *   kTotalStrokes / kTraditionalVariant / kSimplifiedVariant
 *   （zip sha256 钉在 scripts/lib/unihan.mjs，换版必须显式改常量）
 * 对拍裁决：hanzi-writer-data@2.0.1 与 Unihan 的 ${hwd.size} 字差异
 *   （结论逐字落在 strokes-overrides.ts 的 HWD_OVERRIDES，含理由）
 *
 * 形态（05 文档 §4.1「表键一律为简体字面」）：
 *   条目 = "字:s" 或 "字:s:t"（t 缺省 = 与简体相同），';' 分隔、每行 ${PER_LINE} 条、按码点升序
 *   别名 = "繁:简"（繁体字面归一，不重复存数值）
 * 收字域：URO \\u4E00-\\u9FFF + 扩展 A \\u3400-\\u4DBF（与 isHanChar 一致，共 ${domain.length} 字）
 * ============================================================ */

/** 生成时间（仅作溯源，不参与内容比对） */
export const GENERATED_AT = ${JSON.stringify(generatedAt)};

/** 数据源版本：Unicode Unihan（kTotalStrokes / 变体字段） */
export const GENERATED_UNICODE_VERSION = ${JSON.stringify(UNIHAN_VERSION)};

/** 对拍 oracle（仅离线裁决期使用，其 ArphicPL 许可不随本仓库分发） */
export const GENERATED_ADJUDICATOR = 'hanzi-writer-data@2.0.1';

/** 收字域码点数（URO + 扩展 A，与 isHanChar 一致） */
export const GENERATED_DOMAIN_SIZE = ${domain.length};

/** 键 → 笔画（${entryItems.length} 键）；${aliasItems.length} 条繁体别名另见 GENERATED_ALIAS_LINES */
export const GENERATED_ENTRY_LINES: readonly string[] = [
${entryLines.map((l) => `  ${JSON.stringify(l)},`).join('\n')}
];

/** 繁体字面 → 简体字面别名（不含数值） */
export const GENERATED_ALIAS_LINES: readonly string[] = [
${aliasLines.map((l) => `  ${JSON.stringify(l)},`).join('\n')}
];
`;

fs.writeFileSync(GENERATED_PATH, header, 'utf8');

/* ── 8. 可选：按 standard 展开的导出 JSON（05 §4.1 形态，落缓存目录不入库） ── */

if (process.argv.includes('--json')) {
  const simp = {};
  const trad = {};
  for (const cp of domain) {
    const c = ch(cp);
    const k = keys.get(cp);
    if (k) {
      simp[c] = k.s;
      trad[c] = k.t ?? k.s;
    } else {
      const x = aliasMap.get(cp);
      const tk = keys.get(x);
      simp[c] = tk.s;
      trad[c] = tk.t ?? tk.s;
    }
  }
  const dir = path.join(REPO_ROOT, 'scripts', '.cache');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, obj] of [['strokes_simplified', simp], ['strokes_traditional', trad]]) {
    const payload = JSON.stringify({ standard: name.endsWith('simplified') ? 'SIMPLIFIED' : 'TRADITIONAL', version: 1, strokes: obj });
    fs.writeFileSync(path.join(dir, `${name}.json`), payload, 'utf8');
  }
}

/* ── 9. 报告 ──────────────────────────────────────────── */

const raw = fs.readFileSync(GENERATED_PATH);
const gz = zlib.gzipSync(raw, { level: 9 });

const hwdApplied = { sPos: 0, tPos: 0, sameAsUnihan: 0, keptUnihan: 0 };
for (const [c, v] of hwd) {
  const cp = c.codePointAt(0);
  const u = unihan.strokes.get(cp);
  if (u === v) hwdApplied.sameAsUnihan++;
  else hwdApplied.keptUnihan++;
  const k = keys.get(cp);
  if (k) {
    if (k.sFrom === cp && k.s === v) hwdApplied.sPos++;
    if (k.tFrom === cp && k.tRaw === v) hwdApplied.tPos++;
  } else {
    const x = aliasMap.get(cp);
    if (x !== undefined) {
      const tk = keys.get(x);
      if (tk?.tFrom === cp && tk.tRaw === v) hwdApplied.tPos++;
    }
  }
}

const sampleChars = [...'梅花观觀华華后後发發药藥龘都著无無书書门門長长'];
const sample = sampleChars.map((c) => {
  const cp = c.codePointAt(0);
  const k = keys.get(cp);
  const a = aliasMap.get(cp);
  const u = unihan.strokes.get(cp);
  const h = hwd.get(c);
  if (k) {
    return `  ${c}  键  s=${k.s}${k.t === undefined ? '（t 缺省）' : ` t=${k.t}`}  sFrom=${ch(k.sFrom)} tFrom=${ch(k.tFrom)}  Unihan=${u ?? '-'} hwd=${h ?? '-'}${baseline.has(c) ? '  [现表冻结]' : ''}`;
  }
  if (a !== undefined) return `  ${c}  别名 → ${ch(a)}  Unihan=${u ?? '-'} hwd=${h ?? '-'}`;
  return `  ${c}  ？`;
});

const report = [
  `# 笔画表生成报告  ${generatedAt}`,
  ``,
  `数据源：Unihan ${UNIHAN_VERSION}（zip ${buf.length} B，sha256 ${unihan.sha256.slice(0, 16)}…）`,
  `  Unihan 全库 ${unihan.strokes.size} 字，kTotalStrokes 落在 ${Object.keys(unihan.sources).length} 个字段统计中（本次解析总行数 ${unihan.totalEntries}）`,
  `  kTotalStrokes 实际出现在：${[...(unihan.filesByField?.kTotalStrokes ?? [])].join('、') || '（未出现）'}（字段行数 ${unihan.sources.kTotalStrokes}，解析器遍历全部 ${unihan.files.length} 个 Unihan*.txt）`,
  `收字域：${domain.length}（URO + 扩展 A，全部有 kTotalStrokes）`,
  ``,
  `## 规模`,
  `  键数            ${keys.size}`,
  `  别名数          ${aliasMap.size}（生成 ${[...aliasOrigin.values()].filter((v) => v === 'generated').length} + 现表冻结 ${baselineAlias.size}，冲突 ${aliasConflicts.length}）`,
  `  带 t 的键       ${tPresent}（其中别名目标强制显式 ${forcedT}）`,
  `  覆盖 override   现表冻结 ${baseline.size} 键 + ${baselineAlias.size} 别名；hwd 裁决 ${hwd.size} 字`,
  `  生成值 vs 现表 漂移 ${fieldDrift.length} 处`,
  ...fieldDrift.map((s) => `    - ${s}`),
  ``,
  `## hwd 对拍裁决（${hwd.size} 字）`,
  `  其中与 Unihan 同值（显式留档） ${hwdApplied.sameAsUnihan}`,
  `  实际改写 Unihan 值            ${hwdApplied.keptUnihan}`,
  `  落到 s 位 / t 位              ${hwdApplied.sPos} / ${hwdApplied.tPos}`,
  `  别名冲突                      ${aliasConflicts.length}${aliasConflicts.length ? '：' + aliasConflicts.join('；') : ''}`,
  ``,
  `## 产物体积`,
  `  strokes.generated.ts  raw ${raw.length} B / gzip-9 ${gz.length} B`,
  `  条目 ${entryItems.length} 条（每行 ${PER_LINE} 条，${entryLines.length} 行）；别名 ${aliasItems.length} 条（${aliasLines.length} 行）`,
  ``,
  `## 抽样（20+ 字）`,
  ...sample,
  ``,
  `## 校验`,
  `  域内全覆盖 / 1–84 / 金标准 16 项 / 别名完整性 —— 全部通过（否则脚本已非零退出）`,
  '',
].join('\n');

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, report, 'utf8');
console.log(`OK keys=${keys.size} alias=${aliasMap.size} hwd=${hwd.size} generated.ts=${raw.length}B gz=${gz.length}B`);
console.log(`report: scripts/.cache/build-report.txt`);
