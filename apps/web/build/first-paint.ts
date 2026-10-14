/* ============================================================
 * 首屏预算闸门 —— 让体积回归在**构建期**就失败，而不是发版后才发现
 *
 * 由来（2026-10-14）：上一轮「首屏瘦身」做完后，体积数字看着达标，但六十四卦
 * 全表（120KB 原始 / 46KB gzip）其实一直躺在首屏 chunk 里 —— 因为打包器误判
 * 它有副作用而把它搬回了入口。单测全绿、人工验收也看不出，只有把产物拆开
 * 逐个 grep 才会发现。
 *
 * 所以这里做两件事，都不依赖「有人记得去看体积报告」：
 *   ① 结构断言：重数据表**不得出现在任何 eager chunk 的模块清单里**
 *      —— 比体积阈值精确，直接指向「谁被错误地拖进了首屏」；
 *   ② 体积预算：首屏 gzip 超出预算即失败 —— 兜住①覆盖不到的缓慢膨胀。
 *
 * 失败信息里带上排查方向，避免下一个人只看到一个孤零零的数字。
 * ============================================================ */

import { gzipSync } from 'node:zlib';
import type { Plugin } from 'vite';

/**
 * 首屏（eager）chunk 的 gzip 预算。
 *
 * 现状 53.93 KB（2026-10-14 修完副作用误判后），留约 11% 余量。
 * 触到这条线说明**有新东西被拖进了首屏**，先查是不是重数据，再考虑调预算。
 */
const ENTRY_GZIP_BUDGET_KB = 60;

/** 绝不允许出现在首屏的「重数据表」——它们只在结果页 / 学习页 / 汉字起卦时才需要 */
const HEAVY_TABLES: ReadonlyArray<{ readonly match: RegExp; readonly label: string }> = [
  { match: /packages\/knowledge\/src\/hexagrams\.ts$/, label: '六十四卦全表（120KB）' },
  { match: /packages\/knowledge\/src\/strokes.*\.ts$/, label: '汉字笔画表（202KB）' },
  { match: /packages\/knowledge\/src\/shiYi.*\.ts$/, label: '十翼全文（71KB）' },
];

const norm = (id: string) => id.replace(/\\/g, '/');

export function firstPaintGuard(): Plugin {
  return {
    name: 'plumora-first-paint-guard',
    apply: 'build',
    generateBundle(_options, bundle) {
      const problems: string[] = [];
      let checked = 0;

      for (const [name, out] of Object.entries(bundle)) {
        // 只看 eager 入口 chunk —— 懒加载 chunk 带着重数据是设计意图
        if (out.type !== 'chunk' || !out.isEntry) continue;
        checked += 1;

        for (const table of HEAVY_TABLES) {
          if (out.moduleIds.some((id) => table.match.test(norm(id)))) {
            problems.push(`  · ${name} 里出现了「${table.label}」`);
          }
        }

        const kb = gzipSync(Buffer.from(out.code)).length / 1024;
        if (kb > ENTRY_GZIP_BUDGET_KB) {
          problems.push(
            `  · ${name} gzip ${kb.toFixed(2)} KB，超出预算 ${ENTRY_GZIP_BUDGET_KB} KB`,
          );
        } else {
          this.warn(`首屏 ${name}：gzip ${kb.toFixed(2)} KB / 预算 ${ENTRY_GZIP_BUDGET_KB} KB`);
        }
      }

      if (checked === 0) return;

      if (problems.length) {
        this.error(
          [
            '首屏预算超限：',
            ...problems,
            '',
            '排查方向：',
            '  1. 重数据必须 import 具体子路径（@plumora/knowledge/hexagrams 之类），',
            '     不能用裸包名 @plumora/knowledge —— 聚合层会把全部重数据一起拖进来；',
            '  2. 起卦/首屏用不到的视图要走 defineAsyncComponent 懒加载；',
            '  3. 确实有意放宽预算，再改 build/first-paint.ts 的 ENTRY_GZIP_BUDGET_KB。',
          ].join('\n'),
        );
      }
    },
  };
}
