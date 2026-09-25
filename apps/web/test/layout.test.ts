/* ============================================================
 * 布局形态测试 —— 「电脑模式 / 手机模式」切换
 *
 * 为什么需要它：断点判据已从 `@media (min-width: 900px)` 改成
 * `<html data-layout>`，判据本身变成了一段 JS 逻辑。媒体查询永远不会写错，
 * 但这段 JS 会——比如「强制 MOBILE 时仍去看视口宽度」这种一测就出来的错误。
 *
 * 只测纯函数 + DOM 属性，不测样式（样式靠运行时冒烟断言可见性）。
 * ============================================================ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ---------- 宿主桩：可控的 matchMedia ---------- */

let viewportIsDesktop = false;
const viewportListeners: Array<() => void> = [];

function setViewport(isDesktop: boolean): void {
  viewportIsDesktop = isDesktop;
  for (const fn of viewportListeners) fn();
}

const windowStub = {
  matchMedia: (query: string) => ({
    // 只认断点查询；主题查询一律 false（本文件不测主题）
    get matches(): boolean {
      return query.includes('900px') ? viewportIsDesktop : false;
    },
    media: query,
    addEventListener: (_type: string, fn: () => void) => void viewportListeners.push(fn),
    removeEventListener: (_type: string, fn: () => void) => {
      const i = viewportListeners.indexOf(fn);
      if (i >= 0) viewportListeners.splice(i, 1);
    },
  }),
};

/** 最小 documentElement 桩，用于断言 data-layout 真的被写上去 */
const htmlAttrs: Record<string, string> = {};

vi.stubGlobal('window', windowStub);
vi.stubGlobal('document', {
  documentElement: {
    setAttribute: (n: string, v: string) => void (htmlAttrs[n] = String(v)),
    getAttribute: (n: string) => htmlAttrs[n] ?? null,
  },
});

const {
  DESKTOP_QUERY,
  applyLayout,
  nextToggleLayout,
  resolveLayout,
  watchViewport,
} = await import('@/platform/settings');

describe('布局形态（layoutMode）', () => {
  beforeEach(() => {
    viewportIsDesktop = false;
    viewportListeners.length = 0;
    delete htmlAttrs['data-layout'];
  });

  it('AUTO 跟随视口：窄屏 mobile、宽屏 desk', () => {
    viewportIsDesktop = false;
    expect(resolveLayout('AUTO')).toBe('mobile');
    viewportIsDesktop = true;
    expect(resolveLayout('AUTO')).toBe('desk');
  });

  it('强制值不受视口影响（否则「宽屏上切手机模式」会失效）', () => {
    viewportIsDesktop = true;
    expect(resolveLayout('MOBILE')).toBe('mobile');
    expect(resolveLayout('DESKTOP')).toBe('desk');

    viewportIsDesktop = false;
    expect(resolveLayout('MOBILE')).toBe('mobile');
    expect(resolveLayout('DESKTOP')).toBe('desk');
  });

  it('断点判据是 900px', () => {
    expect(DESKTOP_QUERY).toBe('(min-width: 900px)');
  });

  it('切换按钮在三档下都指向「另一种形态」', () => {
    viewportIsDesktop = true;
    expect(nextToggleLayout('AUTO')).toBe('MOBILE'); // 宽屏 → 切手机
    expect(nextToggleLayout('DESKTOP')).toBe('MOBILE');
    expect(nextToggleLayout('MOBILE')).toBe('DESKTOP');

    viewportIsDesktop = false;
    expect(nextToggleLayout('AUTO')).toBe('DESKTOP'); // 窄屏 → 切电脑
    expect(nextToggleLayout('MOBILE')).toBe('DESKTOP');
  });

  it('连续切换两次回到原形态（不会出现「切不回来」）', () => {
    viewportIsDesktop = true;
    const first = nextToggleLayout('AUTO'); // 宽屏 → 手机
    const second = nextToggleLayout(first); // 手机 → 电脑
    expect(resolveLayout('AUTO')).toBe('desk');
    expect(resolveLayout(first)).toBe('mobile');
    expect(resolveLayout(second)).toBe('desk'); // 与 AUTO 在宽屏下的结果一致
  });

  it('applyLayout 把形态写进 <html data-layout>', () => {
    viewportIsDesktop = false;
    applyLayout('AUTO');
    expect(htmlAttrs['data-layout']).toBe('mobile');

    applyLayout('DESKTOP');
    expect(htmlAttrs['data-layout']).toBe('desk');

    applyLayout('MOBILE');
    expect(htmlAttrs['data-layout']).toBe('mobile');
  });

  it('视口跨断点会通知订阅者（AUTO 下据此重算）', () => {
    const seen: string[] = [];
    const stop = watchViewport(() => {
      seen.push(resolveLayout('AUTO'));
    });

    setViewport(false);
    setViewport(true);
    setViewport(false);

    expect(seen).toEqual(['mobile', 'desk', 'mobile']);

    // 取消订阅后不再触发（否则 store 会泄漏监听）
    stop();
    setViewport(true);
    expect(seen.length).toBe(3);
  });
});
