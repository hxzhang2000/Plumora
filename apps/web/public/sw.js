/* 观梅 · Plumora —— 离线 app shell 缓存
 *
 * 策略：stale-while-revalidate（有缓存先返回，后台更新）；导航请求离线时回退 index.html，
 * 保证 SPA 各路由离线可用。仅生产环境注册（main.ts 中 import.meta.env.PROD 守卫），
 * 开发环境不激活，避免挡住 HMR。
 *
 * 缓存名带版本号：注册时以 `sw.js?v=<APP_VERSION>` 传入（见 main.ts），
 * 于是**每次发版缓存名自动变**，activate 里顺带清掉旧缓存——
 * 不再依赖人工手改 CACHE 常量（改漏了会一直吃旧产物）。
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `plumora-shell-${VERSION}`;
const CORE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  /* ⚠️ 故意**不**在这里 skipWaiting()。
   *
   * 无条件 skipWaiting 会让新版 SW 立刻接管仍在使用旧产物的已打开页面，
   * 出现「新 SW + 旧 HTML/JS」的资源错配；而且用户完全无感，以为还在旧版。
   * 改为等页面在检测到新版本、用户点「更新」后 postMessage('SKIP_WAITING') 再接管，
   * 由 main.ts 监听 controllerchange 刷新页面（见 main.ts 的更新流程说明）。 */
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* 页面点了「更新」→ 让处于 waiting 的新 SW 立即接管 */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) {
        // 后台更新缓存
        fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(CACHE).then((c) => c.put(req, res.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res && res.status === 200) {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
        }
        return res;
      } catch {
        if (req.mode === 'navigate') {
          return (await caches.match('./index.html')) || (await caches.match('./'));
        }
        return cached;
      }
    })(),
  );
});
