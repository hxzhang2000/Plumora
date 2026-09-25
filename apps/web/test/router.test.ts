/* ============================================================
 * hash 路由测试（07 文档 TC-W12「路由解析与导航」）
 *
 * 为什么单开一个文件：router.ts 在**模块顶层**读 location.hash 并注册
 * window 的 hashchange 监听，所以必须在 import 之前把宿主桩装好；
 * 而 vitest 默认按文件隔离环境，独立文件里改全局最干净。
 *
 * 覆盖审查报告的两条：
 *   W-14 goBack 依赖 history.length → 外链深链会跳出应用
 *   W-15 未知 hash 静默回退到 /cast 但不改写 URL
 * ============================================================ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ---------- 宿主桩：location / history / window / document ---------- */

let currentHash = '#/cast';
const hashListeners: Array<() => void> = [];
let historyLength = 1;
let backCount = 0;

/** 真浏览器里 location.hash 赋值会（异步）触发 hashchange；桩同步派发，便于断言 */
const locationStub = {
  get hash(): string {
    return currentHash;
  },
  set hash(v: string) {
    const next = v.startsWith('#') ? v : `#${v}`;
    if (next === currentHash) return;
    currentHash = next;
    for (const fn of hashListeners) fn();
  },
};

const historyStub = {
  get length(): number {
    return historyLength;
  },
  /** replaceState 不触发 hashchange —— 桩必须保持这个语义，否则会掩盖自激 bug */
  replaceState(_data: unknown, _title: string, url?: string): void {
    if (typeof url === 'string') currentHash = url.startsWith('#') ? url : `#${url}`;
  },
  back(): void {
    backCount += 1;
  },
};

const windowStub = {
  addEventListener(type: string, fn: () => void): void {
    if (type === 'hashchange') hashListeners.push(fn);
  },
  removeEventListener(): void {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};

/** @vue/runtime-dom 在模块加载时会 document.createElement('template')，补最小元素桩 */
function stubElement() {
  const attrs: Record<string, string> = {};
  return {
    attrs,
    setAttribute: (n: string, v: string) => void (attrs[n] = String(v)),
    getAttribute: (n: string) => attrs[n] ?? null,
    removeAttribute: (n: string) => void delete attrs[n],
    appendChild: (c: unknown) => c,
    removeChild: (c: unknown) => c,
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
  };
}

(globalThis as Record<string, unknown>).window = windowStub;
(globalThis as Record<string, unknown>).location = locationStub;
(globalThis as Record<string, unknown>).history = historyStub;
(globalThis as Record<string, unknown>).document = {
  documentElement: stubElement(),
  head: stubElement(),
  body: stubElement(),
  createElement: () => stubElement(),
  createElementNS: () => stubElement(),
  createTextNode: () => stubElement(),
  createComment: () => stubElement(),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
};

/** 每次以指定初始 hash 重新加载 router 模块（模块顶层会立即解析并规范化地址） */
async function loadRouter(initialHash: string) {
  vi.resetModules();
  hashListeners.length = 0;
  backCount = 0;
  historyLength = 1;
  currentHash = initialHash;
  return import('@/router');
}

beforeEach(() => {
  vi.resetModules();
});

describe('router：路径解析', () => {
  it('四个 Tab 路径与详情路径各自落到正确路由', async () => {
    const { route } = await loadRouter('#/cast');
    expect(route.value.name).toBe('cast');

    const r2 = await loadRouter('#/records');
    expect(r2.route.value.name).toBe('records');
    expect(r2.route.value.path).toBe('/records');

    const r3 = await loadRouter('#/records/123');
    expect(r3.route.value.name).toBe('record-detail');
    expect(r3.route.value.params.id).toBe('123');
    expect(r3.route.value.path).toBe('/records/123');

    const r4 = await loadRouter('#/learn');
    expect(r4.route.value.name).toBe('learn');
  });

  it('无 hash 时补写 #/cast，保证刷新与分享链接一致', async () => {
    await loadRouter('');
    expect(currentHash).toBe('#/cast');
  });

  it('未知路径回退到起卦页，并把地址栏一并改写（W-15）', async () => {
    const { route } = await loadRouter('#/foo');
    expect(route.value.name).toBe('cast');
    // 关键断言：地址与页面必须一致，否则刷新/分享会落到不存在的地址上
    expect(currentHash).toBe('#/cast');
  });

  it('带查询串的合法地址不被改写（只比 path 段）', async () => {
    await loadRouter('#/cast?x=1');
    expect(currentHash).toBe('#/cast?x=1');
  });

  it('hashchange 到未知路径时同样纠正地址', async () => {
    const { route } = await loadRouter('#/cast');
    locationStub.hash = '#/nope';
    expect(route.value.name).toBe('cast');
    expect(currentHash).toBe('#/cast');
  });
});

describe('router：导航与 Tab 归属', () => {
  it('navigate 更新当前路由，activeTab 把详情页归到「卦例」', async () => {
    const { route, navigate, activeTab } = await loadRouter('#/cast');
    expect(activeTab.value).toBe('cast');

    navigate('/records');
    expect(route.value.name).toBe('records');
    expect(activeTab.value).toBe('records');

    navigate('/records/7');
    expect(route.value.name).toBe('record-detail');
    expect(activeTab.value).toBe('records');

    navigate('/learn');
    expect(activeTab.value).toBe('learn');
  });

  it('replaceRoute 只改地址不改历史栈（不触发 hashchange）', async () => {
    const { route, replaceRoute } = await loadRouter('#/cast');
    replaceRoute('/records');
    expect(currentHash).toBe('#/records');
    expect(route.value.name).toBe('records');
  });
});

describe('router：goBack（W-14）', () => {
  it('详情页的「返回」按层级回到列表页，不依赖 history.length', async () => {
    // 深链进详情页：history.length 为 1（应用内没有上一页）
    const { route, goBack } = await loadRouter('#/records/9');
    historyLength = 1;
    goBack('/records');
    expect(route.value.name).toBe('records');
    expect(backCount).toBe(0);
  });

  it('即使浏览器历史里有上一页（外链深链），也不会跳出应用', async () => {
    const { route, goBack } = await loadRouter('#/records/9');
    historyLength = 5; // 上一页可能是别的网站
    goBack('/records');
    expect(route.value.name).toBe('records');
    expect(backCount).toBe(0); // 关键：没有调用 history.back()
  });

  it('Tab 页无层级关系：能回上一页就回，否则落到 fallback', async () => {
    const { route, goBack } = await loadRouter('#/result');
    historyLength = 3;
    goBack('/cast');
    expect(backCount).toBe(1);

    backCount = 0;
    historyLength = 1;
    goBack('/cast');
    expect(backCount).toBe(0);
    expect(route.value.name).toBe('cast');
  });
});
