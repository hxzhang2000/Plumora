/* ============================================================
 * 运行时冒烟的构建配置：把整个应用打成单文件 IIFE
 *
 * 与 vite.config.ts 的区别只有两点：
 *   ① 输出 IIFE（可在 jsdom / 无模块加载器的环境里直接 eval）
 *   ② 静态替换 process.env.NODE_ENV —— IIFE 在浏览器里没有 process 对象，
 *      不替换会在执行首行就抛 ReferenceError
 * 由 `npm run test:runtime` 调用，产物 .tmp-smoke-dist/ 已被 .gitignore 忽略。
 * ============================================================ */
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { alias } from './build/aliases';

export default defineConfig({
  plugins: [vue()],
  resolve: { alias },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: '.tmp-smoke-dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    minify: false,
    lib: {
      entry: 'src/main.ts',
      formats: ['iife'],
      name: 'PlumoraApp',
      fileName: () => 'app.js',
    },
  },
});
