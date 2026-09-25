import { fileURLToPath, URL } from 'node:url';

/**
 * 路径别名 —— vite.config.ts 与 vitest.config.ts 共用同一份，避免两处漂移。
 *
 * packages/* 直接指向源码（不预先构建），改动即时生效；
 * 这样 Web 端与（未来的）Android 端共享同一份领域实现。
 */
export const alias: Record<string, string> = {
  '@': fileURLToPath(new URL('../src', import.meta.url)),
  '@plumora/core': fileURLToPath(new URL('../../../packages/core/src/index.ts', import.meta.url)),
  '@plumora/knowledge': fileURLToPath(
    new URL('../../../packages/knowledge/src/index.ts', import.meta.url),
  ),
  '@plumora/lunar': fileURLToPath(new URL('../../../packages/lunar/src/index.ts', import.meta.url)),
};
