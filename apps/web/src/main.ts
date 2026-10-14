import { createApp, watch } from 'vue';
import App from './App.vue';
import { APP_VERSION } from './generated/version';
import { SHARE_PARAM } from './platform/shareLink';
import { serviceWorkerUrl } from './platform/pwa';
import { route } from './router';
import { adoptSharedCast } from './stores/cast';
import { toast } from './stores/toast';
import './styles/tokens.css';
import './styles/base.css';
import './styles/glyph.css';
import './styles/frame.css';

/* ---------------------------------------------------------------
 * 分享链接恢复（`#/result?c=…`，编码见 platform/shareLink）
 *
 * 一个 watch 覆盖全部入口：首次打开链接（immediate）、在同一标签页里粘贴
 * 地址（hashchange）、浏览器前进后退。放在 mount 之前，结果页首次渲染时
 * 当前卦例已经就位，不会闪一下「回起卦页」。
 * 编排放在 main.ts 而不是 store 里：store 只认数据，谁把 URL 喂给它属于
 * 应用装配层的事。采纳与否的策略见 adoptSharedCast。
 * ------------------------------------------------------------- */
watch(route, () => adoptSharedCast(route.value.params[SHARE_PARAM]), { immediate: true });

createApp(App).mount('#app');

/* ---------------------------------------------------------------
 * 生产环境注册 Service Worker：手机端可「添加到主屏幕」并离线可用
 * （开发环境不激活，避免挡住 HMR）
 * ------------------------------------------------------------- */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  /* 是否**已被**某个 SW 控制。
   *
   * 首次访问时页面尚未受控（false）——此时 activate 里的 clients.claim() 也会
   * 触发一次 controllerchange，但那不是「有新版」，不能据此刷新（否则首次
   * 打开就白刷一次）。只有本次进入前已被控制（true），controllerchange 才意味着
   * 「用户点了更新、新 SW 接管」，这时才刷新页面。 */
  const hadController = !!navigator.serviceWorker.controller;

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  /** 提示用户有新版本：点「更新」→ 通知 waiting 的 SW 接管 → controllerchange 刷新 */
  const promptUpdate = (worker: ServiceWorker) => {
    toast(
      '发现新版本',
      { label: '更新', run: () => worker.postMessage('SKIP_WAITING') },
      12000,
    );
  };

  window.addEventListener('load', () => {
    /* 相对 document.baseURI 注册，并带上版本号：
     *   ① 子目录部署（如 GitHub Pages 的 /Plumora/）下，绝对路径 '/sw.js' 会 404，
     *      SW 静默注册失败、离线与可安装全部失效；相对地址才与 base: './' 一致。
     *   ② ?v=<版本> 让 sw.js 每次发版都以「新脚本」被识别，缓存名随之更新。
     *   地址计算抽到 platform/pwa.ts（便于单测，防止回归成绝对路径）。 */
    const swUrl = serviceWorkerUrl(document.baseURI, APP_VERSION);
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        // 页面加载时新版本已在等待（上一次没点更新就关掉了页面）
        if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // installed + 已有控制器 = 新版就绪、正处于 waiting
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              promptUpdate(installing);
            }
          });
        });
      })
      .catch(() => {
        /* 注册失败不影响正常使用，仅失去离线能力 */
      });
  });
}
