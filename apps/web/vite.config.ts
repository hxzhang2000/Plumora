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

export default defineConfig({
  plugins: [vue(), appVersionPlugin()],
  // 相对 base：产物可放任意子目录 / 静态托管，便于迁移与自托管部署
  base: './',
  resolve: { alias },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 800,
  },
});
