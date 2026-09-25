/* ============================================================
 * 交付实现的 Node 侧加载器 —— 供 .workbuddy/checks/ 下的核对脚本使用
 *
 * 为什么需要它（代码审查 D-4）：
 *   原先 doc-case-check.js / kb-consistency.py 对拍的是
 *   `docs/ui/build/core.js`（**UI 原型**），而 README 却宣称它们验证的是
 *   「文档说的」与「实现做的」是否一致。改 packages/core 或改文档时脚本不报警，
 *   D-1（原型拼出「闰闰六月」）正是这种盲区的产物。
 *
 * 做法：用 vite 自带的 esbuild 把 packages/* 的 TS 源码即时 bundle 成 CJS
 *   （写到系统临时目录，不落仓库产物、不引入新依赖），再 require。
 *
 * 用法：
 *   const { core, knowledge } = require('./load-delivery.cjs');
 * ============================================================ */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

/** @plumora/* 别名 → 源码入口（与 apps/web/build/aliases.ts 指向同一份源码） */
const ALIAS = {
  '@plumora/core': path.join(ROOT, 'packages/core/src/index.ts'),
  '@plumora/knowledge': path.join(ROOT, 'packages/knowledge/src/index.ts'),
  '@plumora/lunar': path.join(ROOT, 'packages/lunar/src/index.ts'),
};

function build(entry, name) {
  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch {
    throw new Error(
      '找不到 esbuild。它随 vite 安装（仓根 node_modules/esbuild），' +
        '请先执行 npm install。',
    );
  }

  const outfile = path.join(os.tmpdir(), `plumora-delivery-${name}-${process.pid}.cjs`);
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, entry)],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile,
    logLevel: 'silent',
    alias: ALIAS,
  });
  const mod = require(outfile);
  try {
    fs.unlinkSync(outfile);
  } catch {
    /* 临时文件清理失败不影响结果 */
  }
  return mod;
}

module.exports = {
  ROOT,
  /** @plumora/core —— 起卦 / 卦象推导 / 生克 / 记录模型 */
  core: build('packages/core/src/index.ts', 'core'),
  /** @plumora/knowledge —— 八卦 / 64 卦 / 笔画表 */
  knowledge: build('packages/knowledge/src/index.ts', 'knowledge'),
  /**
   * @plumora/lunar —— 农历适配层（含 solarlunar，esbuild 会一并打进临时产物）。
   *
   * 为什么把农历也纳进来：闰月口径与年界口径是**最容易漂移且后果最重**的两处
   * （D-1「闰闰六月」、C-1「标签用立春干支年」都出在这里），而这两处的判定逻辑
   * 落在 `packages/lunar`，不在 core。只对拍 core 会让这两个契约永远无人核对。
   */
  lunar: build('packages/lunar/src/index.ts', 'lunar'),
};

/* ------------------------------------------------------------
 * 直接执行时输出 JSON —— 供 Python 侧脚本（kb-consistency.py）读取，
 * 避免 Python 去解析 TS 源码。
 *   node .workbuddy/checks/load-delivery.cjs
 * ------------------------------------------------------------ */
if (require.main === module) {
  const K = module.exports.knowledge;
  const payload = {
    hexagrams: Object.values(K.HEXAGRAMS).map((h) => ({
      code: h.code,
      name: h.name,
      upper: h.upper,
      lower: h.lower,
      keywords: h.keywords,
    })),
    categories: K.TRIGRAM_CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
    trigrams: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => K.TRIGRAMS[n].name),
  };
  process.stdout.write(JSON.stringify(payload));
}
