import { fileURLToPath, URL } from 'node:url';

/**
 * 路径别名 —— vite.config.ts 与 vitest.config.ts 共用同一份，避免两处漂移。
 *
 * packages/* 直接指向源码（不预先构建），改动即时生效；
 * 这样 Web 端与（未来的）Android 端共享同一份领域实现。
 */
export const alias: Record<string, string> = {
  '@': fileURLToPath(new URL('../src', import.meta.url)),
  '@plumora/core/resolve': fileURLToPath(
    new URL('../../../packages/core/src/resolve.ts', import.meta.url),
  ),
  '@plumora/core': fileURLToPath(new URL('../../../packages/core/src/index.ts', import.meta.url)),
  /* ⚠️ 顺序敏感：别名按「前缀 + /」匹配，裸包名 `@plumora/knowledge` 会吞掉
   * `@plumora/knowledge/strokes` 这类子路径。子路径必须排在裸包名之前。
   *
   * 为什么全部拆成子路径：打包器只能按「入口」拆 chunk，不能跨入口把某个
   * 重数据摇掉。只要有一个模块 import 裸包名（=聚合层，含全部重数据），
   * 笔画表 88KB、六十四卦全表等就会被整体拖进那个 chunk。按需/懒加载
   * 的前提是消费方直接 import 具体的子路径。 */
  '@plumora/knowledge/trigrams': fileURLToPath(
    new URL('../../../packages/knowledge/src/trigrams.ts', import.meta.url),
  ),
  '@plumora/knowledge/hexagrams': fileURLToPath(
    new URL('../../../packages/knowledge/src/hexagrams.ts', import.meta.url),
  ),
  '@plumora/knowledge/bilingual': fileURLToPath(
    new URL('../../../packages/knowledge/src/bilingual.ts', import.meta.url),
  ),
  '@plumora/knowledge/shiYi': fileURLToPath(
    new URL('../../../packages/knowledge/src/shiYi.ts', import.meta.url),
  ),
  '@plumora/knowledge/han': fileURLToPath(
    new URL('../../../packages/knowledge/src/han.ts', import.meta.url),
  ),
  '@plumora/knowledge/strokes': fileURLToPath(
    new URL('../../../packages/knowledge/src/strokes.ts', import.meta.url),
  ),
  '@plumora/knowledge': fileURLToPath(
    new URL('../../../packages/knowledge/src/index.ts', import.meta.url),
  ),
  '@plumora/lunar': fileURLToPath(new URL('../../../packages/lunar/src/index.ts', import.meta.url)),
};
