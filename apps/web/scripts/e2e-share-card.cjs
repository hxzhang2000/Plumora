/* ============================================================
 * 分享卡片排版 E2E —— 真浏览器（Chrome / Edge headless）
 *
 * 为什么必须有一个真浏览器的用例：
 *   分享卡片的两次事故（手机端图片被裁、整张卡被压扁）**全都发生在排版层**，
 *   而 jsdom 没有排版引擎 —— getComputedStyle 拿不到真实尺寸、没有 vw/vh、
 *   没有圆角与溢出。单测与 jsdom 走查当时全绿，用户在手机上看到的却是坏的。
 *   这个用例专门守那些只有真排版才能发现的东西：
 *     ① 卡片不横向溢出、完整落在视口内（手机 390px 宽也放得下）
 *     ② 位图比例与显示比例一致（CSS 只缩放、不变形）
 *     ③ --share-ratio（JS 写入）与实测比例一致（两端没走散）
 *     ④ 分享弹层自己没有内部滚动条（卡片被挤出滚动区 = 手机上看不清）
 *
 * 怎么驱动（零依赖）：
 *   不开 playwright / puppeteer 这类依赖，而是
 *     Node 起一个本地静态服务（托管 dist/）→ headless 浏览器打开 e2e.html，
 *     页面里用同源 iframe 装载真实应用、真实点击，量完把结果 POST 回 Node。
 *   为什么不用 `chrome --dump-dom`：Windows 上 Chrome 是 GUI 子系统进程，
 *   它的 stdout 不与父进程相连，--dump-dom 拿不到任何输出（实测）。回传这一招
 *   顺带还能把测量结果结构化地带回来。
 *
 * 检测不到 Chrome / Edge 时**自动跳过**（退出码 0）——CI 或精简环境不该因此变红。
 * 想指定浏览器：设 CHROME_PATH 环境变量。
 * ============================================================ */

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DIST = path.join(__dirname, '..', 'dist');
const TIMEOUT_MS = 60_000;

/* ---------- 找浏览器 ---------- */

function exists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function findBrowser() {
  /* 显式指定优先，且**只管这一个**：设了 CHROME_PATH 却写错时应当跳过并说明，
   * 而不是悄悄退回内置列表（那会让人以为「我指定的那个浏览器跑过了」）。 */
  if (process.env.CHROME_PATH) {
    return exists(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  }
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    local ? path.join(local, 'Google/Chrome/Application/chrome.exe') : null,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    local ? path.join(local, 'Microsoft/Edge/Application/msedge.exe') : null,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find(exists);
}

/* ---------- 测试页（同源 iframe + 真实点击 + 量尺寸 + 回传） ---------- */

/** 深链用的固定一盘：坎上巽下动 1 = 水风井（与金标准算例 A 一致） */
const DEEP_LINK_PAYLOAD = Buffer.from(
  JSON.stringify({
    v: 1,
    c: {
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
        precision: 'SHICHEN',
        minute: 0,
        second: 0,
        movingSum: 37,
      },
    },
    r: 'MOVING_LINE',
    t: 1_600_000_000_000,
  }),
  'utf8',
).toString('base64url');

function harnessHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>plumora share-card e2e</title>
<style>html,body{margin:0;background:#eee}#frame{display:block;border:0;background:#fff}#log{font:12px/1.5 monospace;white-space:pre-wrap;padding:8px}</style>
</head><body>
<iframe id="frame" src="./index.html#/cast" width="390" height="844" title="plumora under test"></iframe>
<pre id="log"></pre>
<script>
const DEEP_LINK = ${JSON.stringify(DEEP_LINK_PAYLOAD)};
const VIEWPORTS = [
  [390, 844, '手机 390x844'],
  [1180, 900, '桌面 1180x900'],
];

const frame = document.getElementById('frame');
const logEl = document.getElementById('log');
const steps = [];
const runtimeErrors = [];
/** iframe 的 document 载入次数：非 1 说明应用在自行重载（诊断用） */
let frameLoads = 0;
frame.addEventListener('load', () => { frameLoads += 1; });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => { logEl.textContent += m + '\\n'; };
function check(name, ok, detail) {
  steps.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) });
  if (!ok) log('FAIL ' + name + '  ' + detail);
}
const doc = () => frame.contentDocument;
const win = () => frame.contentWindow;

async function waitFor(fn, what, timeout = 15000, snap) {
  const t0 = Date.now();
  for (;;) {
    let v = null;
    try { v = fn(); } catch (e) { /* 文档尚未就绪 */ }
    if (v) return v;
    if (Date.now() - t0 > timeout) {
      throw new Error('等待超时：' + what + (snap ? '  ｜ 现场：' + snap() : ''));
    }
    await sleep(80);
  }
}

/** 出问题时报现场：当前地址 + 页面文字（截断），别让人靠猜 */
function snapshot() {
  let text = '';
  let hash = '';
  try { hash = win().location.hash; } catch (e) { hash = '(读不到)'; }
  try { text = (doc().body.textContent || '').replace(/\\s+/g, ' ').trim(); } catch (e) { text = '(读不到文档)'; }
  return 'hash=' + hash + ' 载入次数=' + frameLoads + ' 文字=' + text.slice(0, 120);
}

/** 超出视口的元素清单（横向溢出时用来定位真凶，只报前几个） */
function outsiders(vw) {
  const out = [];
  doc().querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
      out.push((el.tagName.toLowerCase() + '.' + String(el.className)).slice(0, 40) +
        '[' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
    }
  });
  return out.slice(0, 5).join(' | ') || '（没有元素越界）';
}

/** 最宽的几个元素 + 视口各项宽度（越界查不到时用来看宽度是从哪儿来的） */
function widthProbe() {
  const d = doc();
  const de = d.documentElement;
  const widest = [];
  d.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0) widest.push({ w: r.width, s: (el.tagName.toLowerCase() + '.' + String(el.className)).slice(0, 34) + '@' + Math.round(r.left) });
  });
  widest.sort((a, b) => b.w - a.w);
  return 'de.clientWidth=' + de.clientWidth + ' innerWidth=' + win().innerWidth +
    ' body.scrollWidth=' + d.body.scrollWidth + ' 最宽: ' +
    widest.slice(0, 4).map((x) => x.s + '=' + Math.round(x.w)).join(' | ');
}

/** 单个视口下的排版断言 */
function measure(label) {
  const d = doc();
  const vw = frame.clientWidth;
  const vh = frame.clientHeight;
  const de = d.documentElement;
  const canvas = d.querySelector('.share-canvas');
  const stage = d.querySelector('.share-stage');
  const modal = d.querySelector('.share-modal');
  if (!canvas || !stage || !modal) {
    check(label + ' · 分享弹层已渲染', false, '找不到 canvas / stage / modal');
    return;
  }
  const cr = canvas.getBoundingClientRect();

  // ① 不横向溢出（手机端那次的症状：文字被两侧裁掉）
  check(label + ' · 页面无横向溢出', de.scrollWidth <= vw + 1,
    'scrollWidth=' + de.scrollWidth + ' 视口=' + vw + ' 超宽元素：' + outsiders(vw) + ' ｜ ' + widthProbe());

  // ② 整张卡落在视口内（四边都不越界）
  const inside = cr.left >= -1 && cr.right <= vw + 1 && cr.top >= -1 && cr.bottom <= vh + 1;
  check(label + ' · 卡片完整落在视口内', inside,
    'rect=' + [cr.left, cr.top, cr.width, cr.height].map((n) => Math.round(n)).join(','));

  // ③ 位图比例 == 显示比例（不等就是被 CSS 拉变形了）
  const cssRatio = cr.width / cr.height;
  const bmpRatio = canvas.width / canvas.height;
  check(label + ' · 位图与显示等比（不变形）', Math.abs(cssRatio - bmpRatio) < 0.02,
    '位图 ' + bmpRatio.toFixed(3) + ' vs 显示 ' + cssRatio.toFixed(3));

  // ④ JS 写进 CSS 变量的比例与实测一致（两端走散就会压扁/拉长）
  const varRatio = parseFloat(getComputedStyle(canvas).getPropertyValue('--share-ratio'));
  check(label + ' · --share-ratio 与实测一致', Math.abs(varRatio - cssRatio) < 0.02,
    varRatio + ' vs ' + cssRatio.toFixed(3));

  // ⑤ 弹层自己没有内部滚动（卡片被挤进滚动区 = 手机上根本看不清）
  const noScroll =
    stage.scrollHeight <= stage.clientHeight + 1 &&
    stage.scrollWidth <= stage.clientWidth + 1 &&
    modal.scrollHeight <= modal.clientHeight + 1;
  check(label + ' · 弹层无内部滚动', noScroll,
    'stage ' + stage.scrollHeight + '/' + stage.clientHeight + ' modal ' + modal.scrollHeight + '/' + modal.clientHeight);

  // ⑥ 操作按钮可见且在视口内（弹层打开着却按不到 = 白开）
  const buttons = Array.from(d.querySelectorAll('.share-actions button'));
  const usable = buttons.length === 2 && buttons.every((b) => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top >= -1 && r.bottom <= vh + 1;
  });
  check(label + ' · 操作按钮都在视口内', usable, buttons.length + ' 颗按钮');
}

(async () => {
  try {
    // 应用起来后再挂钩子，捕获 iframe 内的运行时错误
    await waitFor(() => doc() && doc().querySelector('#app'), '应用挂载');
    win().addEventListener('error', (e) => runtimeErrors.push(String(e.message || e)));
    win().addEventListener('unhandledrejection', (e) => runtimeErrors.push('unhandled: ' + String(e.reason)));

    // ---- ① 起卦 → 结果页 ----
    // 首次打开（headless 每次都是全新 profile）会先弹「使用前请阅读」声明页，
    // 点掉它才是真实用户走的那条路。
    const accept = await waitFor(
      () => Array.from(doc().querySelectorAll('button')).find((b) => /我已知悉/.test(b.textContent)) || null,
      '首启声明页的「我已知悉」',
    );
    accept.click();
    /* 注意：要用 body.textContent —— **document 节点的 textContent 恒为 null**
     * （只有元素才有），写成 doc().textContent 会在断言里抛错、被 waitFor 吞掉，
     * 表现成「永远等不到」。 */
    await waitFor(() => !(doc().body.textContent || '').includes('使用前请阅读'), '声明页关闭', 15000, snapshot);
    check('首启声明页可关闭', true, '我已知悉');

    /* 选择器要用 .cast 限定：底栏导航里有一颗文案为「起卦」的 Tab，
     * 按文字找会先撞上它（点它只是切 Tab，永远等不到结果页）。
     * 起卦页的主按钮是 .cast 内唯一的 .btn-main。
     * （本段是 Node 模板字符串的内容，注释里不能出现反引号。） */
    const castBtn = await waitFor(
      () => doc().querySelector('.cast button.btn-main:not([disabled])'),
      '起卦按钮',
      15000,
      snapshot,
    );
    castBtn.click();
    await waitFor(
      () => /^#\\/result/.test(win().location.hash),
      '跳转到结果页',
      15000,
      () => {
        const toast = doc().querySelector('.toast .text');
        return snapshot() + ' ｜ toast=' + (toast ? toast.textContent : '无');
      },
    );
    check('起卦→结果页', true, win().location.hash.slice(0, 22) + '…');
    check('结果页地址栏自动带上分享参数', /^#\\/result\\?c=[A-Za-z0-9_-]+$/.test(win().location.hash));

    // ---- ② 开分享卡（结果页里那颗「生成分享卡片」） ----
    const shareBtn = await waitFor(() => doc().querySelector('.share-btn'), '分享卡片按钮');
    shareBtn.click();
    await waitFor(() => {
      const c = doc().querySelector('.share-canvas');
      return c && c.width > 0 && c.getBoundingClientRect().width > 0;
    }, '分享卡片绘制完成');
    check('分享弹层打开并绘制', true, doc().querySelector('.share-canvas').getAttribute('aria-label'));

    // ---- ③ 用分享链接换一盘（真浏览器里的深链恢复） ----
    win().location.hash = '#/result?c=' + DEEP_LINK;
    await waitFor(() => (doc().body.textContent || '').includes('水风井'), '深链恢复水风井', 15000, snapshot);
    check('分享链接在真浏览器里恢复整盘', true, '水风井');

    /* 换盘时推导是「先清空、后算好」，结果面板会卸载再重建，弹层随之关闭。
     * 所以这里要重新打开一次，并确认画的是**新**那一卦（不是上一张旧图）。
     * 顺便先量一次「没有弹层」时的结果页本身：手机端横向溢出的责任要分清楚
     * （是弹层挤出来的，还是结果页本来就宽）。 */
    const bareVw = frame.clientWidth;
    const bare = doc().documentElement.scrollWidth;
    check('结果页本身无横向溢出（手机 390）', bare <= bareVw + 1,
      'scrollWidth=' + bare + ' 视口=' + bareVw +
      ' 越界元素：' + outsiders(bareVw) + ' ｜ ' + widthProbe());

    await waitFor(() => doc().querySelector('.share-btn'), '换盘后的分享按钮', 15000, snapshot).then((b) => b.click());
    const relabel = await waitFor(
      () => {
        const c = doc().querySelector('.share-canvas');
        const label = c && c.width > 0 ? c.getAttribute('aria-label') : '';
        return label === '分享卡片：水风井' ? label : null;
      },
      '分享卡重绘为新卦',
      15000,
      snapshot,
    );
    check('换盘后分享卡画的是新卦', true, relabel);

    // ---- ④ 逐视口量排版 ----
    for (const [w, h, label] of VIEWPORTS) {
      frame.style.width = w + 'px';
      frame.style.height = h + 'px';
      await sleep(450); // 等应用自己的 resize 处理与重绘
      measure(label);
    }

    check('无运行时错误', runtimeErrors.length === 0, runtimeErrors.join(' | '));
  } catch (e) {
    check('用例执行完成', false, (e && e.message) || String(e));
  }

  try {
    await fetch('/report', { method: 'POST', body: JSON.stringify({ steps, runtimeErrors }) });
  } catch (e) {
    log('回传失败：' + e);
  }
})();
</script>
</body></html>`;
}

/* ---------- 静态服务（顺带收报告） ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function startServer() {
  let onReport = null;
  const report = new Promise((resolve) => {
    onReport = resolve;
  });

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url.startsWith('/report')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.writeHead(204).end();
        onReport(body);
      });
      return;
    }

    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/e2e.html') {
      res.writeHead(200, { 'content-type': MIME['.html'] }).end(harnessHtml());
      return;
    }
    /* Service Worker 一律 404：否则首次访问后它开始接管请求，
     * 后面几轮走的是缓存，量的就不是刚构建出来的产物了（应用自身对注册失败
     * 静默降级，不影响功能）。 */
    if (url === '/sw.js' || url.endsWith('/sw.js')) {
      res.writeHead(404).end();
      return;
    }

    const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
    const file = path.join(DIST, rel);
    // 目录穿越防护：只允许 dist 内的文件
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, report }));
  });
}

/* ---------- 主流程 ---------- */

function killTree(child) {
  if (!child || child.killed) return;
  try {
    child.kill();
  } catch {
    /* noop */
  }
  if (process.platform === 'win32' && child.pid) {
    // Chrome 会拉起一串子进程（渲染器 / GPU），只杀父进程会留孤儿占着 profile 目录
    try {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      /* noop */
    }
  }
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.log('  FAIL #E2E   dist/index.html 不存在，请先 npm run build');
    process.exit(1);
  }

  const browser = findBrowser();
  if (!browser) {
    const hint = process.env.CHROME_PATH
      ? `（CHROME_PATH=${process.env.CHROME_PATH} 不是一个可执行文件）`
      : '（可用 CHROME_PATH 指定）';
    console.log(`skip  #E2E   未检测到 Chrome / Edge ${hint}，已跳过`);
    process.exit(0);
  }

  const { server, port, report } = await startServer();
  const url = `http://127.0.0.1:${port}/e2e.html`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'plumora-e2e-'));

  const child = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--window-size=1200,1000',
      `--user-data-dir=${profile}`,
      url,
    ],
    { stdio: 'ignore' },
  );

  let payload = null;
  let why = '';
  let timer = null;
  try {
    payload = await Promise.race([
      report,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`等待测试页回传超时（${TIMEOUT_MS / 1000}s）`)), TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    why = (e && e.message) || String(e);
  } finally {
    clearTimeout(timer);
    killTree(child);
    server.close();
    setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500).unref?.();
  }

  if (!payload) {
    console.log(`  FAIL #E2E   ${why}`);
    console.log('  提示：浏览器路径 ' + browser);
    process.exit(1);
  }

  const { steps = [], runtimeErrors = [] } = JSON.parse(payload);
  for (const s of steps) {
    console.log(`${s.ok ? '  ok  ' : '  FAIL'} ${s.name}${s.ok ? '' : '  ← ' + s.detail}`);
  }
  if (runtimeErrors.length) console.log('  运行时错误：', runtimeErrors);

  const ok = steps.length > 0 && steps.every((s) => s.ok);
  console.log(ok ? '\n=== 分享卡片 E2E PASS ===' : '\n=== 分享卡片 E2E FAIL ===');
  process.exit(ok ? 0 : 1);
})();
