/* ============================================================
 * 布局形态测试 —— 设备自动识别（手机 / 电脑）
 *
 * 为什么需要它：断点判据已从 `@media (min-width: 900px)` 改成
 * `<html data-layout>`，判据本身变成了一段 JS 逻辑。媒体查询永远不会写错，
 * 但这段 JS 会——比如「手机 UA 却去看视口宽度」「桌面窄窗不收口」
 * 这种一测就出来的错误。
 *
 * 手动「电脑 / 手机」切换已下线（2026-10-13 用户要求）：形态只由
 * detectDeviceKind() + 视口兜底决定，不再有 LayoutMode 三档。
 *
 * 只测纯函数 + DOM 属性，不测样式（样式靠运行时冒烟断言可见性）。
 * ============================================================ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ---------- 宿主桩：可控的 UA / 指针 / 屏幕 / 视口 ---------- */

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const PHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
/** iPadOS 13+ 桌面级 UA：无 "Mobile"，靠「短边大屏」按电脑走 */
const IPAD_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

const host = {
  userAgent: DESKTOP_UA,
  /** 视口是否 ≥ 900px（断点查询） */
  viewportIsDesktop: false,
  /** 指针是否粗（触摸优先） */
  pointerCoarse: false,
  /** 屏幕短边（CSS px） */
  screenShortEdge: 1920,
};

const viewportListeners: Array<() => void> = [];

function setViewport(isDesktop: boolean): void {
  host.viewportIsDesktop = isDesktop;
  for (const fn of viewportListeners) fn();
}

const windowStub = {
  matchMedia: (query: string) => ({
    get matches(): boolean {
      if (query.includes('900px')) return host.viewportIsDesktop;
      if (query.includes('pointer: coarse')) return host.pointerCoarse;
      return false; // 主题等查询本文件不关心
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
vi.stubGlobal('navigator', {
  get userAgent(): string {
    return host.userAgent;
  },
  maxTouchPoints: 0,
});
vi.stubGlobal('screen', {
  width: 1920,
  get height(): number {
    return host.screenShortEdge;
  },
});
vi.stubGlobal('document', {
  documentElement: {
    setAttribute: (n: string, v: string) => void (htmlAttrs[n] = String(v)),
    getAttribute: (n: string) => htmlAttrs[n] ?? null,
  },
});

const { DESKTOP_QUERY, applyLayout, detectDeviceKind, resolveLayout, watchViewport } = await import(
  '@/platform/settings'
);

function resetHost(): void {
  host.userAgent = DESKTOP_UA;
  host.viewportIsDesktop = false;
  host.pointerCoarse = false;
  host.screenShortEdge = 1920;
}

describe('设备识别（detectDeviceKind）', () => {
  beforeEach(() => {
    resetHost();
    viewportListeners.length = 0;
  });

  it('桌面 UA → 电脑', () => {
    expect(detectDeviceKind()).toBe('desk');
  });

  it('手机 UA（iPhone / Android / Windows Phone…）→ 手机', () => {
    host.userAgent = PHONE_UA;
    expect(detectDeviceKind()).toBe('mobile');
    host.userAgent = ANDROID_UA;
    expect(detectDeviceKind()).toBe('mobile');
    host.userAgent = 'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1) Mobile Safari/537.36 Edge/15.15254';
    expect(detectDeviceKind()).toBe('mobile');
  });

  it('iPad 桌面级 UA + 大屏 → 电脑（UA 无 Mobile，宽窄交还视口）', () => {
    host.userAgent = IPAD_UA;
    host.screenShortEdge = 1024; // 横屏短边
    expect(detectDeviceKind()).toBe('desk');
  });

  it('粗指针 + 屏幕短边 < 500px → 手机（兜住 UA 不标准的移动设备）', () => {
    host.pointerCoarse = true;
    host.screenShortEdge = 412;
    expect(detectDeviceKind()).toBe('mobile');
  });

  it('粗指针但大屏（Surface 等触摸本）→ 电脑，不误判', () => {
    host.pointerCoarse = true;
    host.screenShortEdge = 1440;
    expect(detectDeviceKind()).toBe('desk');
  });
});

describe('布局形态（resolveLayout）', () => {
  beforeEach(() => {
    resetHost();
    viewportListeners.length = 0;
    delete htmlAttrs['data-layout'];
  });

  it('手机恒为手机形态（不因视口宽度翻案）', () => {
    host.userAgent = PHONE_UA;
    host.viewportIsDesktop = false;
    expect(resolveLayout()).toBe('mobile');
    host.viewportIsDesktop = true;
    expect(resolveLayout()).toBe('mobile');
  });

  it('电脑 + 宽窗 → 桌面形态', () => {
    host.viewportIsDesktop = true;
    expect(resolveLayout()).toBe('desk');
  });

  it('电脑 + 窄窗 → 回落手机形态（窗口自适应兜底）', () => {
    host.viewportIsDesktop = false;
    expect(resolveLayout()).toBe('mobile');
  });

  it('断点判据是 900px', () => {
    expect(DESKTOP_QUERY).toBe('(min-width: 900px)');
  });

  it('applyLayout 把形态写进 <html data-layout>', () => {
    host.viewportIsDesktop = true;
    applyLayout();
    expect(htmlAttrs['data-layout']).toBe('desk');

    setViewport(false);
    applyLayout();
    expect(htmlAttrs['data-layout']).toBe('mobile');

    host.userAgent = PHONE_UA;
    setViewport(true);
    applyLayout();
    expect(htmlAttrs['data-layout']).toBe('mobile'); // 手机 UA 压过宽视口
  });

  it('视口跨断点会通知订阅者（电脑设备窄窗 ↔ 宽窗据此重算）', () => {
    const seen: string[] = [];
    const stop = watchViewport(() => {
      seen.push(resolveLayout());
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
