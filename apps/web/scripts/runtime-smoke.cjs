/* ============================================================
 * Web 端运行时冒烟
 *
 * 为什么需要它：单元测试（vitest, environment: node）只覆盖纯逻辑，
 * vue-tsc 只做类型检查——**两者都发现不了「组件挂载时抛错导致白屏」**。
 * 本脚本把整个应用打成单文件 IIFE，在 jsdom 里真实执行一遍，
 * 逐路由断言「渲染出了预期文案」且「零运行时错误」。
 *
 * 运行：npm run test:runtime -w @plumora/web
 *       （等价于 vite build --config vite.smoke.config.ts && node scripts/runtime-smoke.cjs）
 *
 * 覆盖：4 条路由 + 金标准算例 A 的排盘结果页完整渲染 + 版本号/品牌图标接线
 *       + 「保存卦例 → 列表按名称显示」端到端（名称优先取所问之事）。
 * 不覆盖：真实布局/视觉（jsdom 无排版引擎），那部分靠人工走查（见 07 文档 §4.1）。
 * ============================================================ */

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { installIndexedDB } = require('./idb-stub.cjs');

const DIST = path.join(__dirname, '..', '.tmp-smoke-dist');
const BUNDLE = path.join(DIST, 'app.js');
const VERSION_JSON = path.join(__dirname, '..', '..', '..', 'version.json');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

if (!fs.existsSync(BUNDLE)) {
  console.error(`未找到构建产物 ${BUNDLE}\n请先运行：vite build --config vite.smoke.config.ts`);
  process.exit(1);
}
const js = fs.readFileSync(BUNDLE, 'utf8');

const errors = [];
const dom = new JSDOM(
  '<!DOCTYPE html><html lang="zh-CN"><head></head><body><div id="app"></div></body></html>',
  { url: 'http://localhost/#/cast', runScripts: 'outside-only', pretendToBeVisual: true },
);
const { window } = dom;

/* jsdom 未实现的宿主能力：补最小桩 */
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
}
window.scrollTo = () => {};

/* jsdom 没有 IndexedDB → platform/records.ts 会直接 reject，卦例列表永远只有空态。
 * 挂一个最小替身，好让「保存 → 列表」这条链路真的跑起来（见 idb-stub.cjs 的说明）。 */
const idb = installIndexedDB(window);

/* 预置一份「已起卦、未落库」的排盘（金标准算例 A），用于验证结果页渲染。
 * 结构与 stores/cast.ts 的 PersistedShape 一致。 */
window.sessionStorage.setItem(
  'plumora.current-cast.v1',
  JSON.stringify({
    cast: {
      method: 'TIME',
      upper: 6,
      lower: 5,
      moving: 1,
      label: '丙午年 八月十五 午时',
      params: {
        yearBranchNo: 7,
        lunarMonth: 8,
        lunarDay: 15,
        hourNo: 7,
        s1: 30,
        s2: 37,
        shifted: false,
      },
    },
    tiYongRule: 'MOVING_LINE',
    castAt: 1790000000000,
  }),
);

const nativeError = window.console.error;
window.console.error = (...args) => {
  errors.push('[console.error] ' + args.map(String).join(' '));
  nativeError.apply(window.console, args);
};
window.addEventListener('error', (e) => errors.push('[window.error] ' + e.message));
window.addEventListener('unhandledrejection', (e) => errors.push('[unhandled] ' + e.reason));

try {
  window.eval(js);
} catch (e) {
  errors.push('[eval threw] ' + (e && e.stack ? e.stack : String(e)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function inspect(hash, mustContain) {
  window.location.hash = hash;
  await sleep(160);
  const app = window.document.querySelector('#app');
  const text = (app ? app.textContent : '').replace(/\s+/g, ' ').trim();
  const missing = mustContain.filter((k) => !text.includes(k));
  const ok = Boolean(app && app.children.length > 0) && missing.length === 0;
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} ${hash.padEnd(10)} DOM ${String(app ? app.innerHTML.length : 0).padStart(5)}  ` +
      (missing.length ? `缺少: ${missing.join(' / ')}` : `含: ${mustContain.join(' / ')}`),
  );
  return ok;
}

/**
 * 断言「电脑模式 / 手机模式」切换真的生效。
 *
 * 只看按钮点了没用：判据是 `<html data-layout>`，而 CSS 的断点必须同步改成
 * `[data-layout='desk'] &` 才会响应。若哪天有人把 CSS 改回 `@media`，
 * data-layout 照样会变、按钮照样会换文案，但界面一动不动——
 * 所以这里除了断言属性翻转，还要断言样式表里**确有** data-layout 规则
 * （jsdom 无排版引擎，getComputedStyle 靠不住，改用结构断言）。
 */
async function inspectLayoutToggle() {
  const doc = window.document;
  const html = doc.documentElement;

  const before = html.getAttribute('data-layout');
  const btn = doc.querySelector('[aria-label^="切换布局"]');
  if (!btn) {
    console.log('  FAIL #布局切换   找不到切换按钮');
    return false;
  }

  btn.click();
  await sleep(160);
  const after = html.getAttribute('data-layout');

  // 再点一次必须能切回来——只放一个按钮、切过去就切不回来是这个功能的典型死局
  const btn2 = doc.querySelector('[aria-label^="切换布局"]');
  btn2.click();
  await sleep(160);
  const back = html.getAttribute('data-layout');

  /**
   * 样式侧断言直接读构建产物（dist/web.css）。
   *
   * jsdom 里没有样式表：CSS 是独立产物，冒烟只 eval 了 app.js，
   * 所以 document.styleSheets 是空的——在那上面做断言会得到「永远不通过」。
   * 读磁盘上的 CSS 反而更准：既能确认断点规则存在，也能确认没人把它改回
   * `@media (min-width: 900px)`（改回去的话 data-layout 照变、界面一动不动）。
   */
  const cssPath = path.join(DIST, 'web.css');
  const raw = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  // 先剥掉注释再匹配：说明性注释里出现「@media (min-width: 900px)」这类字样很正常，
  // 不该让护栏的判定跟着注释变。
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const hasRule = css.includes("data-layout='desk'") || css.includes('data-layout="desk"');
  const hasMedia = /@media[^{]*min-width:\s*900px/.test(css);

  const ok = before !== after && back === before && after !== '' && hasRule && !hasMedia;
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} #布局切换   ${before} → ${after} → ${back}；` +
      `断点规则 data-layout ${hasRule ? '有' : '缺'} / 残留 @media 900px ${hasMedia ? '有' : '无'}`,
  );
  return ok;
}

/**
 * 断言「手机扫码打开本页」真的画出了二维码。
 *
 * 断言的是 `<path>` 有内容 + viewBox 合法，而不是「svg 元素存在」——
 * 后者在编码抛错、path 为空字符串时照样通过，用户扫了个空白方块。
 * 编码正确与否由单测里的 jsQR 往返解码保证，这里只保证接线没断。
 *
 * 调用前需先执行 inspectSettings 把设置面板打开。
 */
async function inspectQrCode() {
  const doc = window.document;
  const trigger = [...doc.querySelectorAll('button')].find((b) =>
    (b.textContent || '').includes('手机扫码'),
  );
  if (!trigger) {
    console.log('  FAIL #二维码     找不到「手机扫码打开本页」入口');
    return false;
  }

  trigger.click();
  await sleep(200);

  const svg = doc.querySelector('svg[aria-label^="扫码打开"]');
  const path = svg ? svg.querySelector('path') : null;
  const d = path ? path.getAttribute('d') || '' : '';
  const viewBox = svg ? svg.getAttribute('viewBox') || '' : '';
  // 「M x y h n v 1 h -n z」——至少得有若干段，且 viewBox 是 "0 0 N N"
  const segments = (d.match(/M/g) || []).length;
  const vbOk = /^0 0 \d+ \d+$/.test(viewBox);
  const ok = Boolean(svg) && segments > 20 && vbOk && d.length > 40;

  // 关掉弹窗，别挡住后续断言
  const closeBtn = [...doc.querySelectorAll('button')].find(
    (b) => (b.textContent || '').trim() === '关闭',
  );
  if (closeBtn) closeBtn.click();
  await sleep(160);

  console.log(
    `${ok ? '  ok  ' : '  FAIL'} #二维码     path ${segments} 段 / viewBox ${vbOk ? '合法' : '异常'}`,
  );
  return ok;
}

/** 打开设置面板，断言「关于」区显示的版本号与真源一致（验证生成常量真的接到了 UI） */
async function inspectSettings(expectVersion) {
  const trigger =
    window.document.querySelector('[aria-label="设置"]') ||
    window.document.querySelector('.side-settings');
  if (!trigger) {
    console.log('  FAIL #设置面板   找不到设置入口');
    return false;
  }
  trigger.click();
  await sleep(200);
  const text = window.document.body.textContent.replace(/\s+/g, ' ');
  const ok = text.includes(`v${expectVersion}`);
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} #设置面板   版本号 v${expectVersion}${ok ? ' 已显示' : ' 未显示'}`,
  );
  return ok;
}

/**
 * 断言品牌图标真的接上了：
 *   ① 页头/侧栏有 icon.svg（印章形态）
 *   ② 设置面板「关于」区有 mark.svg（纯字标）
 *   ③ 引用到的文件名**必须真的存在于 public/**——否则线上会 404，
 *      而「DOM 里有 img」这类断言完全看不出来。
 * 调用前需先执行 inspectSettings 把面板打开。
 */
function inspectBrandIcons() {
  const srcs = [...window.document.querySelectorAll('img')].map(
    (el) => el.getAttribute('src') || '',
  );
  const hasBrand = srcs.some((s) => s.endsWith('icon.svg'));
  const hasAbout = srcs.some((s) => s.endsWith('mark.svg'));

  const missingFiles = [];
  for (const s of new Set(srcs)) {
    if (!s || /^https?:/i.test(s) || s.startsWith('data:')) continue;
    if (!fs.existsSync(path.join(PUBLIC_DIR, s.replace(/^\.\//, '')))) missingFiles.push(s);
  }

  const ok = hasBrand && hasAbout && missingFiles.length === 0;
  const detail = [
    `页头 icon.svg ${hasBrand ? '有' : '缺'}`,
    `关于区 mark.svg ${hasAbout ? '有' : '缺'}`,
    missingFiles.length ? `文件缺失: ${missingFiles.join(', ')}` : '资源文件均在 public/',
  ].join(' / ');
  console.log(`${ok ? '  ok  ' : '  FAIL'} #品牌图标  ${detail}`);
  return ok;
}

/**
 * 断言「卦例名称」端到端生效：名称优先用占卜的目标（所问之事），
 * 未填目标时回退到本卦卦名。
 *
 * 走真实交互而非直接塞数据：结果页填输入框 → 点保存 → 看列表标题。
 * 这样若 IndexedDB 替身坏了、保存按钮没接上、或名称规则写反了，都会 FAIL。
 */
async function inspectRecordNaming() {
  const fail = (why) => {
    console.log(`  FAIL #卦例名称  ${why}`);
    return false;
  };

  const setInput = (el, value) => {
    el.value = value;
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const findSaveBtn = () =>
    [...window.document.querySelectorAll('button')].find(
      (b) => b.textContent.replace(/\s+/g, '') === '保存卦例',
    );

  window.location.hash = '#/result';
  await sleep(220);

  const q = window.document.querySelector('#q');
  if (!q || !findSaveBtn()) return fail('结果页找不到「所问之事」输入框或保存按钮');

  // ① 填了占卜目标 → 名称应取该目标
  setInput(q, '这次面试能否通过');
  findSaveBtn().click();
  await sleep(220);

  // ② 不填目标（同一张排盘再存一次）→ 名称应回退到卦名
  findSaveBtn().click();
  await sleep(220);

  window.location.hash = '#/records';
  await sleep(260);

  const items = [...window.document.querySelectorAll('.rec-item')].map((el) => ({
    title: (el.querySelector('.line1 b')?.textContent ?? '').trim(),
    sub: (el.querySelector('.line2')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
  const withQ = items.find((i) => i.title === '这次面试能否通过');
  const withoutQ = items.find((i) => i.title === '水风井');

  const problems = [];
  // 替身真的存进了两条——否则后面几条断言只是在空数组上做检查，等于没有护栏
  if (idb.size() !== 2) problems.push(`IndexedDB 替身里只有 ${idb.size()} 条（应为 2）`);
  if (items.length !== 2) problems.push(`列表渲染了 ${items.length} 项（应为 2）`);
  if (!withQ) problems.push('填了目标的卦例未以「所问之事」作标题');
  if (!withoutQ) problems.push('未填目标的卦例未回退到卦名「水风井」作标题');
  if (withQ && !withQ.sub.includes('水风井')) problems.push('标题是目标时，副行应保留卦名');
  if (withoutQ && withoutQ.sub.includes('水风井')) problems.push('标题已是卦名时，副行不应重复卦名');

  const ok = problems.length === 0;
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} #卦例名称  ` +
      (ok
        ? '目标优先 / 未填回退卦名 / 副行不重复'
        : problems.join('；')),
  );
  return ok;
}

/**
 * 断言「删除确认弹窗」不会跨路由残留（审查 W-1 / W-2）。
 *
 * 这是**只有真实运行才看得见**的一类缺陷：组件没抛错、单测全绿、类型检查全绿，
 * 但用户「在详情页点了删除 → 侧滑/后退回列表页」时会看到弹窗盖在列表页上、
 * 页面滚不动；此时按 Enter 还会打到一个 id 已失效的删除流程上（静默无反馈）。
 *
 * 根因：confirmDelete 是详情页组件的局部状态，而详情页被 <KeepAlive> 缓存，
 * 离开时只 deactivate 不 unmount —— 弹窗留在 DOM 里，body 滚动锁也不复位。
 *
 * 非空断言自证：先确认「弹窗开着时确实能在 DOM 里找到、body 确实被锁」，
 * 否则后面的「离开后不该有弹窗」只是在空集合上做检查，等于没有护栏。
 */
async function inspectModalResidue() {
  const fail = (why) => {
    console.log(`  FAIL #弹窗残留  ${why}`);
    return false;
  };
  const problems = [];
  const dialogInDom = () => Boolean(window.document.querySelector('[role="alertdialog"]'));
  const bodyLocked = () => window.document.body.style.overflow === 'hidden';
  const findBtn = (text) =>
    [...window.document.querySelectorAll('button')].find(
      (b) => b.textContent.replace(/\s+/g, '') === text,
    );

  // 前面 inspectRecordNaming 已存了 2 条卦例，进第一条的详情页
  window.location.hash = '#/records';
  await sleep(220);
  const first = window.document.querySelector('.rec-item');
  if (!first) return fail('列表页没有卦例，无法进入详情页');
  first.click();
  await sleep(260);
  if (!/^#\/records\/\d+$/.test(window.location.hash)) {
    return fail(`未进入详情页（hash=${window.location.hash}）`);
  }

  const delBtn = findBtn('删除');
  if (!delBtn) return fail('详情页找不到「删除」按钮');
  delBtn.click();
  await sleep(240);

  /* ---- 正向对照：弹窗确实开着、滚动确实锁着（否则下面的断言是空转） ---- */
  if (!dialogInDom()) problems.push('点「删除」后弹窗未出现（正向对照失败）');
  if (!bodyLocked()) problems.push('弹窗打开时未锁 body 滚动（正向对照失败）');

  /* ---- 离开详情页：这是 W-1 的复现点 ---- */
  window.location.hash = '#/records';
  await sleep(320);
  if (window.location.hash !== '#/records') problems.push(`未回到列表页（hash=${window.location.hash}）`);
  if (dialogInDom()) problems.push('列表页仍有残留弹窗（W-1）');
  if (bodyLocked()) problems.push('列表页 body 滚动仍被锁死（W-1）');

  /* ---- W-2：残留弹窗上按 Enter 会打到 id=NaN 的删除流程 ---- */
  const before = idb.size();
  window.document.body.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  );
  await sleep(220);
  if (idb.size() !== before) problems.push(`列表页按 Enter 触发了删除（${before} → ${idb.size()}）（W-2）`);
  if (dialogInDom()) problems.push('列表页按 Enter 后弹窗仍在（W-2）');

  const ok = problems.length === 0;
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} #弹窗残留  ` +
      (ok
        ? '离开详情页后弹窗关闭 / 滚动解锁 / Enter 不误删'
        : problems.join('；')),
  );
  return ok;
}

/**
 * 断言设置抽屉在**关闭态**真的不可达（审查 W-7）。
 *
 * 原实现只用 transform: translateX(102%) 把面板挪出视口，控件仍在 Tab 序与
 * 无障碍树里 —— 键盘用户从起卦页一路 Tab 会「消失」到屏幕外，并能聚焦到
 * 「清空全部卦例」这类不可逆按钮。
 *
 * jsdom 没有排版引擎、也不计算 Tab 序，所以这里只能断言属性契约
 * （inert + aria-hidden）确实被写上；真机可聚焦性由人工走查覆盖。
 * 须在 inspectSettings 打开面板**之前**调用。
 */
function inspectSettingsDrawerA11y() {
  const panel = window.document.querySelector('aside[aria-label="设置"]');
  if (!panel) {
    console.log('  FAIL #设置抽屉   找不到设置面板节点');
    return false;
  }
  const inert = panel.hasAttribute('inert');
  const hidden = panel.getAttribute('aria-hidden') === 'true';
  const ok = inert && hidden;
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} #设置抽屉   关闭态 inert ${inert ? '有' : '缺'} / ` +
      `aria-hidden ${hidden ? '有' : '缺'}`,
  );
  return ok;
}

(async () => {
  await sleep(300);
  const results = [];

  results.push(await inspect('#/cast', ['起卦', '丙午年']));
  results.push(
    await inspect('#/result', ['水风井', '水天需', '火泽睽', '体生用', '小凶', '体坎', '用巽']),
  );
  // 用路由**特有**文案断言（审查 I-7）：原先写 '卦例'，而「卦例」是 NavList 的常驻 Tab 文案，
  // 应用壳渲染即通过，与 RecordsView 是否正常毫无关系。
  results.push(await inspect('#/records', ['还没有卦例']));
  results.push(await inspect('#/learn', ['八卦类象', '六十四卦']));

  // 卦例名称端到端（须在路由走查之后、设置面板打开之前）
  results.push(await inspectRecordNaming());

  // 弹窗跨路由残留（W-1 / W-2）——须在列表页有卦例之后
  results.push(await inspectModalResidue());

  // 布局形态切换（电脑模式 / 手机模式）——须在打开设置面板之前
  results.push(await inspectLayoutToggle());

  // 设置抽屉关闭态可达性（W-7）——须在打开设置面板之前
  results.push(inspectSettingsDrawerA11y());

  // 版本接线端到端：设置面板「关于」区显示的版本号必须与真源一致
  const expectVersion = JSON.parse(fs.readFileSync(VERSION_JSON, 'utf8')).version;
  results.push(await inspectSettings(expectVersion));

  // 二维码接线（须在设置面板打开后执行）
  results.push(await inspectQrCode());

  // 图标接线（须在设置面板打开后执行）
  results.push(inspectBrandIcons());

  console.log('\n运行时错误 :', errors.length ? errors : '无');
  const ok = results.every(Boolean) && errors.length === 0;
  console.log(ok ? '\n=== 运行时冒烟 PASS ===' : '\n=== 运行时冒烟 FAIL ===');
  process.exit(ok ? 0 : 1);
})();
