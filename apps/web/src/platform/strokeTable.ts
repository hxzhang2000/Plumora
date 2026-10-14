/* ============================================================
 * 笔画表按需加载 —— 起卦首屏不为「汉字起卦」付费
 *
 * 背景：汉字笔画底座是 27,584 字的生成物，gzip 约 88KB，而它只在
 * 「汉字」起卦方式下才用得到（时间 / 数字 / 随机三种方式一个字都用不上）。
 * 静态 import 会让每个用户打开首页就下载这 88KB —— 直接顶着
 * NFR-01「冷启动 ≤ 2s（中端机）」。改成本模块的按需加载后，
 * 首屏不再包含笔画表，只有真正切到汉字起卦才拉取。
 *
 * 用法（两条路径都要走本模块，避免各写一份状态）：
 *   · 显示层：选中「汉字」时调 preloadStrokes() 预热，让输入框的
 *     笔画提示直接可用（不必等用户敲第一个字才亮）。
 *   · 提交层：doCast() 里 await loadStrokes()，保证点击「起卦」时
 *     表一定就位 —— 用户手速快过网络也不会拿到 null。
 *
 * 加载失败（离线且未缓存）不抛给 UI：lookupStrokes() 返回 null，
 * 与「表中查无此字」同一条路径，由调用方引导用户手填笔画。
 * ============================================================ */

import type { StrokeLookup, StrokeStandard } from '@plumora/knowledge/strokes';

type StrokesModule = typeof import('@plumora/knowledge/strokes');

let loaded: StrokesModule | null = null;
let pending: Promise<StrokesModule | null> | null = null;

/** 笔画表是否已就位（用于区分「正在加载」与「查无此字」） */
export function strokesReady(): boolean {
  return loaded !== null;
}

/**
 * 加载笔画表。并发调用共用同一个 Promise；失败后清空缓存，
 * 下一次进入汉字起卦会重新尝试（而不是永久卡在失败态）。
 */
export function loadStrokes(): Promise<StrokesModule | null> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= import('@plumora/knowledge/strokes')
    .then((m) => {
      loaded = m;
      return m;
    })
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

/** 预热（不关心结果）：切到「汉字」时立刻调用，把等待藏在用户打字前 */
export function preloadStrokes(): void {
  void loadStrokes();
}

/**
 * 查笔画。表未就位时返回 null —— 调用方按「查无此字」处理即可：
 * UI 只在汉字模式下才渲染笔画提示，而该模式会先 preload，正常不会看到。
 */
export function lookupStrokes(
  char: string,
  standard: StrokeStandard,
  manualTable?: Readonly<Record<string, number>>,
): StrokeLookup | null {
  if (!loaded) {
    // 表未就位：只有用户手填过笔画的字才能立刻给出结果
    const manual = manualTable?.[char];
    return manual == null
      ? null
      : { strokes: manual, manual: true, fellBackToSimplified: false, resolvedChar: char };
  }
  return loaded.lookupStrokes(char, standard, manualTable);
}
