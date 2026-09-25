#!/usr/bin/env node
/* ============================================================
 * 版本号统一管理 —— Web 与 Android 共用同一版本号（一体管理）
 *
 * 设计：**单一真源 + 派生 + 校验**
 *   真源   仓根 version.json（唯一的版本号权威）
 *   派生   package.json × N、Web 端 TS 常量、Android versionName/versionCode
 *   校验   `check` 对每个派生目标重新渲染一遍，与磁盘内容逐字节比对；
 *          任何一处漂移即失败。已接入 `npm run verify`，防止「改了真源忘了同步」。
 *
 * 用法：
 *   node scripts/version.mjs show            查看当前版本与全部派生目标
 *   node scripts/version.mjs check           校验派生目标是否与真源一致（CI 门禁）
 *   node scripts/version.mjs sync            按真源重写全部派生目标
 *   node scripts/version.mjs bump <patch|minor|major>   升版本 + 同步 + 追加 CHANGELOG 条目
 *
 * ⚠️ 不要手工改任何派生目标；改版本一律走 `bump`，改阶段走 version.json 的 stage。
 * ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SSOT = path.join(ROOT, 'version.json');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/* ---------- 真源读写 ---------- */

function readSource() {
  if (!fs.existsSync(SSOT)) fail(`缺少真源文件 ${rel(SSOT)}`);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(SSOT, 'utf8'));
  } catch (e) {
    fail(`version.json 不是合法 JSON：${e.message}`);
  }
  if (!SEMVER.test(raw.version ?? '')) {
    fail(`version.json 的 version 必须是 X.Y.Z 形式，实际「${raw.version}」`);
  }
  return raw;
}

function writeSource(src) {
  fs.writeFileSync(SSOT, JSON.stringify(src, null, 2) + '\n', 'utf8');
}

/**
 * Android versionCode 推导（08 文档 §一）：
 *   major*10000 + minor*100 + patch
 * 故 minor / patch 不得 ≥ 100，否则两个版本会撞到同一个 code。
 */
function versionCodeOf(version) {
  const [, major, minor, patch] = SEMVER.exec(version).map(Number);
  if (minor >= 100 || patch >= 100) {
    fail(`minor / patch 必须 < 100（否则 versionCode 会碰撞），实际 ${version}`);
  }
  return major * 10000 + minor * 100 + patch;
}

/* ---------- 派生目标 ---------- */

/**
 * 发现全部派生目标。`packages/*` 与 `apps/*` 下的 package.json 自动纳入，
 * 新增一个 workspace 包无需回来改这份清单。
 */
function discoverTargets() {
  const targets = [{ file: 'package.json', kind: 'packageJson' }];

  for (const group of ['packages', 'apps']) {
    const dir = path.join(ROOT, group);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      if (fs.existsSync(path.join(dir, name, 'package.json'))) {
        targets.push({ file: `${group}/${name}/package.json`, kind: 'packageJson' });
      }
    }
  }

  targets.push({ file: 'apps/web/src/generated/version.ts', kind: 'webVersionTs' });

  // Android 端尚未建立（见 08 文档 §2.2）。目录出现后自动开始接管，无需改本脚本。
  targets.push({ file: 'apps/android/app/build.gradle.kts', kind: 'gradle', optional: true });
  targets.push({ file: 'apps/android/version.properties', kind: 'properties', optional: true });

  return targets;
}

/** 完全由脚本生成的类型：内容不依赖原文件，缺失时直接创建 */
const FULLY_GENERATED = new Set(['webVersionTs', 'properties']);

/**
 * 把真源版本渲染进某个目标的**完整文件内容**。
 * check 与 sync 共用同一个渲染函数 —— 这样「校验」与「写入」不可能不一致。
 */
function render(target, src, current) {
  const { version } = src;
  const code = versionCodeOf(version);

  switch (target.kind) {
    case 'packageJson': {
      const re = /^(\s*"version"\s*:\s*)"[^"]*"/m;
      if (!re.test(current)) fail(`${target.file} 里找不到 "version" 字段`);
      return current.replace(re, `$1"${version}"`);
    }

    case 'gradle': {
      // 与 packageJson 分支同样的守卫（审查 I-2）。
      // 没有守卫时，字段改名 / 缺失 → replace 匹配不上 → 原样返回 →
      // check 报「全部对齐」，Android 版本号从此静默失管 ——
      // 而「Web / Android 共用一个版本号」正是这套体系存在的唯一理由。
      if (!/versionName\s*=\s*"/.test(current)) {
        fail(`${target.file} 里找不到 versionName = "..." 字段`);
      }
      if (!/versionCode\s*=\s*\d+/.test(current)) {
        fail(`${target.file} 里找不到 versionCode = <数字> 字段`);
      }
      let out = current.replace(/(versionName\s*=\s*)"[^"]*"/, `$1"${version}"`);
      out = out.replace(/(versionCode\s*=\s*)\d+/, `$1${code}`);
      return out;
    }

    case 'properties':
      return `# 由 npm run version:sync 生成，勿手工编辑。真源：version.json\nversionName=${version}\nversionCode=${code}\n`;

    case 'webVersionTs':
      return `/* ============================================================
 * ⚠️ 本文件由 \`npm run version:sync\` 生成，请勿手工编辑。
 *    真源：仓根 version.json
 *    校验：\`npm run version:check\`（已接入 npm run verify）
 * ============================================================ */

/** 应用名 */
export const APP_NAME = '${src.appName}';

/** 产品版本号（Web 与 Android 共用同一版本号） */
export const APP_VERSION = '${version}';

/** Android versionCode（major*10000 + minor*100 + patch，见 08 文档 §一） */
export const APP_VERSION_CODE = ${code};

/** 开发阶段标识（对应 08 文档 §2.1 里程碑） */
export const APP_STAGE = '${src.stage ?? ''}';

/** 版本展示串，如「v0.1.0」 */
export const APP_VERSION_LABEL = \`v\${APP_VERSION}\`;
`;

    default:
      fail(`未知的目标类型 ${target.kind}`);
  }
}

/* ---------- 命令 ---------- */

function cmdShow() {
  const src = readSource();
  const code = versionCodeOf(src.version);
  console.log(`${src.appName}  v${src.version}  (stage ${src.stage ?? '—'})`);
  console.log(`Android versionName = ${src.version}   versionCode = ${code}\n`);
  console.log('派生目标：');
  for (const t of discoverTargets()) {
    const abs = path.join(ROOT, t.file);
    const exists = fs.existsSync(abs);
    const state = !exists ? (t.optional ? '未启用（可选）' : '缺失') : '在管';
    console.log(`  ${state.padEnd(14)} ${t.file}`);
  }
}

function cmdSync() {
  const src = readSource();
  let written = 0;
  for (const t of discoverTargets()) {
    const abs = path.join(ROOT, t.file);
    const exists = fs.existsSync(abs);
    if (!exists && t.optional) {
      console.log(`  -- 跳过（未启用）  ${t.file}`);
      continue;
    }
    if (!exists && !FULLY_GENERATED.has(t.kind)) {
      fail(`目标文件不存在：${t.file}`);
    }
    const current = exists ? fs.readFileSync(abs, 'utf8') : '';
    const next = render(t, src, current);
    if (exists && next === current) {
      console.log(`  ok 已一致        ${t.file}`);
      continue;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, next, 'utf8');
    written++;
    console.log(`  →  已写入        ${t.file}`);
  }
  console.log(`\n同步完成：${written} 个文件被更新，版本 v${src.version}（versionCode ${versionCodeOf(src.version)}）`);
}

function cmdCheck() {
  const src = readSource();
  const problems = [];

  for (const t of discoverTargets()) {
    const abs = path.join(ROOT, t.file);
    const exists = fs.existsSync(abs);
    if (!exists) {
      if (t.optional) continue;
      problems.push(`${t.file}：文件不存在`);
      continue;
    }
    const current = fs.readFileSync(abs, 'utf8');
    if (render(t, src, current) !== current) {
      problems.push(`${t.file}：与真源 v${src.version} 不一致`);
    }
  }

  // 版本号必须有对应的 CHANGELOG 条目，防止「发了版没写变更」
  if (!fs.existsSync(CHANGELOG)) {
    problems.push('CHANGELOG.md：文件不存在');
  } else {
    const md = fs.readFileSync(CHANGELOG, 'utf8');
    if (!md.includes(`## [${src.version}]`)) {
      problems.push(`CHANGELOG.md：缺少 v${src.version} 的条目`);
    }
  }

  if (problems.length) {
    console.error(`版本一致性校验失败（真源 v${src.version}）：`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error('\n修复：npm run version:sync');
    process.exit(1);
  }

  const inManaged = discoverTargets().filter((t) => fs.existsSync(path.join(ROOT, t.file))).length;
  console.log(`版本一致性校验通过：v${src.version}（versionCode ${versionCodeOf(src.version)}），${inManaged} 个派生目标全部对齐`);
}

function cmdBump(kind) {
  const src = readSource();
  const m = SEMVER.exec(src.version).map(Number);
  const [, major, minor, patch] = m;

  let next;
  if (kind === 'major') next = `${major + 1}.0.0`;
  else if (kind === 'minor') next = `${major}.${minor + 1}.0`;
  else if (kind === 'patch') next = `${major}.${minor}.${patch + 1}`;
  else fail(`bump 只接受 patch / minor / major，实际「${kind}」`);

  const from = src.version;
  src.version = next;
  writeSource(src);
  console.log(`版本号 ${from} → ${next}\n`);

  // 真源已改，后续任一步失败都会留下「真源已升、派生未同步 / CHANGELOG 未写」的中间态。
  // 原来这里直接让 fail() 退出，用户只看到一句「错误：…」，不知道该从哪里续上（审查 I-10）。
  // 这里捕获后打印明确的恢复步骤；version:check 也会立刻报错（响亮失败，不静默）。
  try {
    cmdSync();
    prependChangelog(next, today());
  } catch (e) {
    if (!(e instanceof VersionError)) throw e;
    console.error(`\n⚠️ 真源已升到 v${next}，但后续步骤失败：${e.message}`);
    console.error('   恢复：npm run version:sync');
    console.error(`   并确认 CHANGELOG.md 里有 v${next} 的条目（缺少则手工补上）。`);
    process.exit(1);
  }
  console.log(`\n已在 CHANGELOG.md 顶部插入 v${next} 条目 —— 请补齐「做了什么」后再提交。`);
  console.log(`建议：git add -A && git commit -m "chore(release): v${next}" && git tag v${next}`);
}

/* ---------- CHANGELOG ---------- */

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function prependChangelog(version, date) {
  if (!fs.existsSync(CHANGELOG)) fail('CHANGELOG.md 不存在，无法插入条目');
  const md = fs.readFileSync(CHANGELOG, 'utf8');

  const anchor = md.indexOf('## [Unreleased]');
  if (anchor < 0) fail('CHANGELOG.md 缺少 `## [Unreleased]` 锚点');

  const after = md.indexOf('\n## [', anchor + 1);
  const insertAt = after < 0 ? md.length : after + 1;

  const section = `## [${version}] - ${date}\n\n- （待补充）\n\n`;
  fs.writeFileSync(CHANGELOG, md.slice(0, insertAt) + section + md.slice(insertAt), 'utf8');
}

/* ---------- 工具 ---------- */

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

/**
 * 终止型错误。
 *
 * 刻意用 throw 而不是直接 process.exit(1)：调用方（cmdBump）需要在「真源已改、
 * 派生未同步」的中间态上做补救提示。统一在入口处转成 exit 1（审查 I-10）。
 */
class VersionError extends Error {}

function fail(msg) {
  throw new VersionError(msg);
}

/* ---------- 入口 ---------- */

const [cmd, arg] = process.argv.slice(2);
try {
  switch (cmd) {
    case 'show':
      cmdShow();
      break;
    case 'sync':
      cmdSync();
      break;
    case 'check':
      cmdCheck();
      break;
    case 'bump':
      cmdBump(arg);
      break;
    default:
      console.log('用法：node scripts/version.mjs <show|check|sync|bump patch|minor|major>');
      process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  if (e instanceof VersionError) {
    console.error(`错误：${e.message}`);
    process.exit(1);
  }
  throw e;
}
