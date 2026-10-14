import fs from 'node:fs';
import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Plugin } from 'vite';
import { alias } from './build/aliases';
import { firstPaintGuard } from './build/first-paint';

/**
 * 把产品版本写进产物的 <html>：
 *   - <meta name="app-version"> 供部署后核对「线上跑的是哪个版本」
 *   - data-version 落在 <html> 上，便于自动化脚本 / DevTools 一眼看出
 * 版本真源为仓根 version.json（与 Android 端共用同一版本号，见 docs/dev/08 §一）。
 *
 * 同时注入**分享预览**用的 og 标签。
 *
 * og:image 必须是**绝对 URL**：微信 / Facebook / iMessage 等抓取端不会解析
 * 相对路径，拿到相对地址等于没有预览图。仓里没有部署域名（也不该硬编码），
 * 因此按构建期环境变量 `PLUMORA_SITE_URL` 拼；未设置时退回相对路径——
 * 至少 <title>/<description> 这类能被解析的标签仍然生效。
 * 例：PLUMORA_SITE_URL=https://hxzhang2000.github.io/Plumora npm run build
 */
function appVersionPlugin(): Plugin {
  const versionJson = path.resolve(__dirname, '../../version.json');

  return {
    name: 'plumora-app-version',
    transformIndexHtml(html) {
      const { version, stage } = JSON.parse(fs.readFileSync(versionJson, 'utf8')) as {
        version: string;
        stage?: string;
      };
      const siteUrl = (process.env.PLUMORA_SITE_URL || '').replace(/\/+$/, '');
      const ogImage = siteUrl ? `${siteUrl}/icon-512.png` : './icon-512.png';
      const description =
        '观梅 · Plumora —— 梅花易数起卦排盘工具：时间 / 数字 / 汉字起卦，本互变三卦、体用生克，仅供传统文化学习与研究使用。';
      return {
        // 同时覆盖 `<html>` 与 `<html lang="...">` 两种写法
        html: html.replace(
          /<html\b/,
          `<html data-app-version="${version}" data-app-stage="${stage ?? ''}"`,
        ),
        tags: [
          { tag: 'meta', attrs: { name: 'app-version', content: version }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'app-stage', content: stage ?? '' }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:title', content: '观梅 · Plumora' }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:description', content: description }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image', content: ogImage }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:title', content: '观梅 · Plumora' }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:description', content: description }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:image', content: ogImage }, injectTo: 'head' },
        ],
      };
    },
  };
}

/**
 * 把 dev server 的**局域网地址**写进页面 meta。
 *
 * 为什么需要：「手机扫码打开本页」要能工作，dev server 必须监听局域网，
 * 而且页面得知道那个地址——浏览器 JS 拿不到本机的局域网 IP，
 * 只有 dev server 自己知道（vite 的 resolvedUrls.network）。
 * 用户在电脑上开的是 localhost，直接拿 location.href 做二维码，
 * 手机扫出来是它自己的 localhost，打不开且看不出原因。
 *
 * 生产构建（build）下 ctx.server 为 undefined → 写入空数组，
 * 此时 share.ts 直接用 location.href，正是想要的行为。
 */
function lanUrlsPlugin(): Plugin {
  return {
    name: 'plumora-lan-urls',
    transformIndexHtml(html, ctx) {
      const network = ctx.server?.resolvedUrls?.network ?? [];
      return {
        // 不改 HTML 本体，只追加 meta —— 但 html 字段是必填的，原样透传
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { name: 'plumora-lan-urls', content: JSON.stringify(network) },
            injectTo: 'head',
          },
        ],
      };
    },
  };
}

/**
 * 把 packages/* 的纯数据 / 纯函数模块如实告知打包器：**无模块级副作用**。
 *
 * 这两个包在自己的 package.json 里已经声明了 `"sideEffects": false`，
 * 但 `resolve.alias` 把包名直接指向了 `src/index.ts`（绝对路径），
 * 打包器不会再去读那份声明 —— 于是它按保守默认（有副作用）处理。
 *
 * 后果不是「多留几个字节」，而是**整块被搬回首屏**（2026-10-14 查明）：
 * Rollup 对「有副作用」的 chunk 会执行 `hoistTransitiveImports`，把只被懒加载
 * 链到的传递依赖以空导入的形式挂进入口 chunk，确保副作用先跑。六十四卦全表
 * （120KB 原始 / 46KB gzip）就是这样回到首屏的 —— 而它其实一个副作用都没有。
 *
 * 它的三条入边本来就全是懒加载：
 *   platform/knowledgeSearch → 学习页、core/resolve → 结果/记录页、
 *   knowledge/src/index 聚合层（已被摇树丢弃）。
 * 也就是说代码侧早已按需拆分，纯粹是打包器误判了副作用。
 *
 * 修好这一处后首屏从 265.66KB/gzip 101.50KB 降到 144.83KB/gzip 53.93KB，
 * 六十四卦全表自动落回自己的 chunk，**不需要任何 manualChunks 手工干预**。
 *
 * 判定严格限定在这两个包内：`knowledge` 全是冻结的数据表，`core` 全是纯函数，
 * 都没有模块级副作用；其余（Vue 组件、样式、第三方）一律保持打包器默认口径，
 * 由它自己按 package.json 的 sideEffects 与代码做副作用分析。
 * （Rollup 的 `HasModuleSideEffects` 类型只收 `boolean`，不能用 `null` 表示
 *   「交还默认」，所以这里显式返回 `true` —— 与默认行为等价。）
 */
function pureDomainModule(id: string): boolean {
  const p = id.replace(/\\/g, '/');
  if (/\/packages\/(knowledge|core)\/src\//.test(p)) return false;
  return true; // 其余模块保持打包器默认口径（有副作用 → 由它自己做副作用分析）
}

export default defineConfig({
  plugins: [vue(), appVersionPlugin(), lanUrlsPlugin(), firstPaintGuard()],
  // 相对 base：产物可放任意子目录 / 静态托管，便于迁移与自托管部署
  base: './',
  resolve: { alias },
  server: {
    // 监听全部网卡（含局域网），而不是只监听 127.0.0.1：
    // 手机要在同一 Wi-Fi 下访问到本机，仅回环地址是不够的。
    // 注意这会把开发服务暴露到局域网——只在开发期生效，生产构建产物是纯静态文件。
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      treeshake: { moduleSideEffects: pureDomainModule },
    },
  },
});
