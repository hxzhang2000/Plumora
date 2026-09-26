import fs from 'node:fs';
import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Plugin } from 'vite';
import { alias } from './build/aliases';

/**
 * 把产品版本写进产物的 <html>：
 *   - <meta name="app-version"> 供部署后核对「线上跑的是哪个版本」
 *   - data-version 落在 <html> 上，便于自动化脚本 / DevTools 一眼看出
 * 版本真源为仓根 version.json（与 Android 端共用同一版本号，见 docs/dev/08 §一）。
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
      return {
        // 同时覆盖 `<html>` 与 `<html lang="...">` 两种写法
        html: html.replace(
          /<html\b/,
          `<html data-app-version="${version}" data-app-stage="${stage ?? ''}"`,
        ),
        tags: [
          { tag: 'meta', attrs: { name: 'app-version', content: version }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'app-stage', content: stage ?? '' }, injectTo: 'head' },
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

export default defineConfig({
  plugins: [vue(), appVersionPlugin(), lanUrlsPlugin()],
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
  },
});
