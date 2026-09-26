/* ============================================================
 * Unihan 数据读取 —— 供 scripts/build-strokes.mjs /
 * scripts/adjudicate-strokes.mjs 共用。
 *
 * 数据源：Unicode UCD 的 Unihan.zip
 *   https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip
 * 下载结果缓存在 scripts/.cache/（已 gitignore），重复构建不再联网。
 *
 * ⚠️ UAX #38 明文警告「勿假设字段所在文件」——Unihan 18.0 的
 * kTotalStrokes 在 Unihan_IRGSources.txt 里，所以这里必须遍历 zip 内
 * **全部** Unihan*.txt，而不是点名某个文件。
 *
 * zip 解包用 node:zlib 自己读中央目录（不依赖 python / 第三方包）。
 * ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 仓根（scripts/lib/ → scripts/ → 仓根） */
export const REPO_ROOT = path.resolve(HERE, '..', '..');
/** 下载缓存目录（gitignore） */
export const CACHE_DIR = path.join(REPO_ROOT, 'scripts', '.cache');

/** Unihan.zip 固定地址（latest 目录；版本由下方常量钉死） */
export const UNIHAN_URL = 'https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip';
/** 当前钉死的 Unihan 版本 —— zip 内容与本值不符时构建直接报错，防止悄悄漂移 */
export const UNIHAN_VERSION = '18.0';
/** Unihan.zip 的 sha256（钉版本的手段：换版必须显式改这两个常量） */
export const UNIHAN_ZIP_SHA256 = '4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e';

/** 汉字域：URO + 扩展 A（与 strokes.ts 的 isHanChar 完全一致） */
export function isDomainCodePoint(cp) {
  return (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff);
}

/* ── zip 读取（只支持常规 deflate/stored 条目，Unihan.zip 正是此类） ── */

/**
 * 读 zip 中央目录，返回 { 文件名: Buffer }。仅用于只读解包，
 * 不处理 zip64（Unihan.zip ~8MB，远达不到阈值）。
 */
export function readZipEntries(buf) {
  // 1. 从尾部回扫 EOCD（签名 0x06054b50，注释区最长 64KB）
  let eocd = -1;
  const stop = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= stop; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Unihan.zip：找不到 End of Central Directory 记录');

  const entryCount = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // 中央目录偏移

  const out = new Map();
  for (let n = 0; n < entryCount; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error(`Unihan.zip：第 ${n} 个中央目录条目签名错误`);
    }
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    // 2. 由本地头定位数据区（大小以中央目录为准：位 3 数据描述符下本地头为 0）
    if (buf.readUInt32LE(localOff) !== 0x04034b50) {
      throw new Error(`Unihan.zip：${name} 本地头签名错误`);
    }
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    if (method === 0) out.set(name, Buffer.from(raw));
    else if (method === 8) out.set(name, inflateRawSync(raw));
    else throw new Error(`Unihan.zip：${name} 使用不支持的压缩方法 ${method}`);
  }
  return out;
}

/* ── 下载（带缓存） ── */

/** 取 Unihan.zip：缓存命中直接复用，否则联网下载后落盘 */
export async function ensureUnihanZip({ force = false } = {}) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const zipPath = path.join(CACHE_DIR, 'Unihan.zip');
  if (!force && fs.existsSync(zipPath)) {
    const buf = fs.readFileSync(zipPath);
    if (buf.length > 0) return { buf, fromCache: true };
  }
  process.stderr.write(`下载 ${UNIHAN_URL}\n`);
  const res = await fetch(UNIHAN_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`下载 Unihan.zip 失败：HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(zipPath, buf);
  return { buf, fromCache: false };
}

/* ── 解析 ── */

/**
 * 解析 Unihan 全部字段。
 *
 * @returns {{
 *   version: string,
 *   strokes: Map<number, number>,   // 码点 → kTotalStrokes
 *   s2t: Map<number, number[]>,     // 码点 → kTraditionalVariant（自身也可能是成员）
 *   t2s: Map<number, number[]>,     // 码点 → kSimplifiedVariant
 *   totalEntries: number,
 *   sources: Record<string, number>,// 字段 → 行数（报告字段落点）
 *   filesByField: Record<string, Set<string>>, // 字段 → 出现过的文件名
 *   files: string[],                // 本次解析的 Unihan*.txt 文件名
 * }}
 */
export function parseUnihan(buf) {
  const entries = readZipEntries(buf);
  const strokes = new Map();
  const s2t = new Map();
  const t2s = new Map();
  const sources = {};
  /** 字段 → 出现过的文件名（用来在报告里点名 kTotalStrokes 到底落在哪个 Unihan 文件） */
  const filesByField = {};
  let totalEntries = 0;

  const files = [...entries.keys()].filter((n) => /^Unihan.*\.txt$/.test(n)).sort();
  if (files.length === 0) throw new Error('Unihan.zip 内没有 Unihan*.txt');

  for (const name of files) {
    const text = entries.get(name).toString('utf8');
    for (const line of text.split('\n')) {
      if (line.length === 0 || line.charCodeAt(0) === 0x23 /* '#' */) continue;
      const tab1 = line.indexOf('\t');
      if (tab1 < 0 || !line.startsWith('U+')) continue;
      const cp = Number.parseInt(line.slice(2, tab1), 16);
      if (!Number.isFinite(cp)) continue;
      const tab2 = line.indexOf('\t', tab1 + 1);
      const field = line.slice(tab1 + 1, tab2 < 0 ? undefined : tab2);
      const value = tab2 < 0 ? '' : line.slice(tab2 + 1).trim();
      if (value === '') continue;
      totalEntries++;

      if (field === 'kTotalStrokes') {
        // 有的行会给两个数（首个为 Unicode 默认，第二个为越南用法）——取首个
        const first = Number(value.split(/\s+/)[0]);
        if (!Number.isFinite(first)) continue;
        const prev = strokes.get(cp);
        if (prev !== undefined && prev !== first) {
          throw new Error(`U+${cp.toString(16).toUpperCase()} 的 kTotalStrokes 冲突：${prev} vs ${first}`);
        }
        strokes.set(cp, first);
      } else if (field === 'kTraditionalVariant' || field === 'kSimplifiedVariant') {
        const targets = [];
        for (const tok of value.split(/\s+/)) {
          if (!tok.startsWith('U+')) continue;
          const t = Number.parseInt(tok.slice(2), 16);
          if (Number.isFinite(t)) targets.push(t);
        }
        const map = field === 'kTraditionalVariant' ? s2t : t2s;
        const list = map.get(cp);
        if (list) list.push(...targets);
        else map.set(cp, [...targets]);
      }
      sources[field] = (sources[field] ?? 0) + 1;
      (filesByField[field] ??= new Set()).add(name);
    }
  }

  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (sha !== UNIHAN_ZIP_SHA256) {
    throw new Error(
      `Unihan.zip 内容与钉死版本不符（当前 ${UNIHAN_VERSION}，sha256 ${sha}\n` +
      `期望 ${UNIHAN_ZIP_SHA256}）。Unicode 发新版后：删除 scripts/.cache/ 重下，\n` +
      `核实新版本号并同步更新 scripts/lib/unihan.mjs 的 UNIHAN_VERSION / UNIHAN_ZIP_SHA256，\n` +
      `再重跑 npm run knowledge:build 与对拍。`,
    );
  }
  return { version: UNIHAN_VERSION, sha256: sha, strokes, s2t, t2s, totalEntries, sources, filesByField, files };
}
