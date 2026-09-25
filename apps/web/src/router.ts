/* ============================================================
 * 极简 hash 路由（零依赖）
 *
 * 为什么不用 vue-router：本项目要求「便于移植和共享」，路由只需支持
 * 3 个 Tab + 2 个详情视图；自持 60 行比引入一个框架依赖更划算，
 * 且 hash 路由在静态托管（含子目录部署）下无需服务端 rewrite 配置。
 * ============================================================ */

import { computed, readonly, ref } from 'vue';

export type RouteName = 'cast' | 'result' | 'records' | 'record-detail' | 'learn';

export interface Route {
  readonly name: RouteName;
  readonly params: Readonly<Record<string, string>>;
  readonly path: string;
}

const DEFAULT_ROUTE: Route = { name: 'cast', params: {}, path: '/cast' };

function parse(hash: string): Route {
  const path = (hash.replace(/^#/, '') || '/').split('?')[0];
  const seg = path.split('/').filter(Boolean);
  if (seg.length === 0) return DEFAULT_ROUTE;

  switch (seg[0]) {
    case 'cast':
      return { name: 'cast', params: {}, path: '/cast' };
    case 'result':
      return { name: 'result', params: {}, path: '/result' };
    case 'learn':
      return { name: 'learn', params: {}, path: '/learn' };
    case 'records':
      return seg[1]
        ? { name: 'record-detail', params: { id: seg[1] }, path: `/records/${seg[1]}` }
        : { name: 'records', params: {}, path: '/records' };
    default:
      return DEFAULT_ROUTE;
  }
}

const current = ref<Route>(parse(typeof location === 'undefined' ? '' : location.hash));

/**
 * 让地址栏与当前页面一致（审查 W-15）。
 *
 * 未知 hash（如 `#/foo`）会被 parse() 静默回退到 /cast：页面渲染的是起卦页，
 * 地址栏却仍是 `#/foo`——刷新、分享、收藏都会落到一个「不存在」的地址上。
 * 这里把回退结果写回 URL（replaceState 不触发 hashchange，不会自激）。
 * 只比 path 段，带查询串的合法地址（`#/cast?x=1`）不会被改写。
 */
function normalizeHash(): void {
  const raw = location.hash.replace(/^#/, '') || '/';
  if (raw.split('?')[0] === current.value.path) return;
  history.replaceState(null, '', `#${current.value.path}`);
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current.value = parse(location.hash);
    normalizeHash();
  });
  // 首次进入：既补上缺失的 hash（保证刷新与分享链接一致），也纠正未知 hash
  normalizeHash();
}

export const route = readonly(current);

/** 路由 → 底部/侧边导航的归属 Tab */
export const activeTab = computed<'cast' | 'records' | 'learn'>(() => {
  switch (current.value.name) {
    case 'records':
    case 'record-detail':
      return 'records';
    case 'learn':
      return 'learn';
    default:
      return 'cast';
  }
});

export function navigate(path: string): void {
  const next = path.startsWith('#') ? path : `#${path}`;
  if (location.hash === next) {
    current.value = parse(next);
    return;
  }
  location.hash = next;
}

/** 替换当前历史记录（用于重定向，不产生多余回退步骤） */
export function replaceRoute(path: string): void {
  const next = path.startsWith('#') ? path : `#${path}`;
  history.replaceState(null, '', next);
  current.value = parse(next);
}

/**
 * 路由层级中的「上级」（审查 W-14）。
 *
 * 原来靠 `history.length > 1` 判断能否回退：从外部站点深链进详情页时，
 * 历史栈里确实有上一页（那是别的网站），点「返回」会直接跳出应用。
 * 改成按层级判断——详情页的上级恒为列表页，落点可预测且永远留在应用内。
 */
const PARENT_PATH: Partial<Record<RouteName, string>> = {
  'record-detail': '/records',
};

export function goBack(fallback = '/cast'): void {
  const parent = PARENT_PATH[current.value.name];
  if (parent) {
    navigate(parent);
    return;
  }
  // Tab 页之间没有层级关系：能回浏览器上一页就回，否则落到 fallback
  if (history.length > 1) history.back();
  else replaceRoute(fallback);
}
