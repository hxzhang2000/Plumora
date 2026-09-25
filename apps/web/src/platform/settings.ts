/* ============================================================
 * 应用设置持久化 —— 对应 04 文档 §三 DataStore 设置项
 * Web 端以 localStorage 承载（单机、无云同步，与 NFR-03 一致）
 * ============================================================ */

import type { CastMethod, TiYongRule } from '@plumora/core';
import type { StrokeStandard } from '@plumora/knowledge';

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';

/**
 * 布局形态：AUTO = 跟视口宽度走；DESKTOP / MOBILE = 用户强制指定。
 *
 * 为什么要它：CSS 媒体查询只能读视口宽度，用户无法在宽屏上主动切到「手机模式」
 * （看效果 / 截图 / 给窄屏设备对拍），也无法在窄屏上切回「电脑模式」。
 * 强制值会写进 `<html data-layout>`，CSS 的断点判断全部改由该属性驱动（见 §布局）。
 */
export type LayoutMode = 'AUTO' | 'DESKTOP' | 'MOBILE';

/** 断点判据（06 §6.2）：< 900px 为移动端形态，≥ 900px 为桌面端形态 */
export const DESKTOP_QUERY = '(min-width: 900px)';

/** 实际生效的布局形态 */
export type EffectiveLayout = 'desk' | 'mobile';

export interface Settings {
  /** 笔画标准（FR-10） */
  strokeStandard: StrokeStandard;
  /** 默认起卦方式（FR-10） */
  defaultCastMethod: CastMethod;
  /** 体用判定规则（FR-10 / 03 §3.6） */
  tiYongRule: TiYongRule;
  /** 主题 */
  theme: ThemeMode;
  /** 布局形态：AUTO 跟视口，DESKTOP / MOBILE 强制 */
  layoutMode: LayoutMode;
  /** 保留记录上限：0 = 不限制 */
  recordLimit: 0 | 500 | 1000;
  /** 首启声明页已确认 */
  disclaimerAcknowledged: boolean;
}

export const SETTINGS_KEY = 'plumora.settings.v1';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  strokeStandard: 'SIMPLIFIED',
  defaultCastMethod: 'TIME',
  tiYongRule: 'MOVING_LINE',
  theme: 'SYSTEM',
  layoutMode: 'AUTO',
  recordLimit: 0,
  disclaimerAcknowledged: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 隐私模式 / 配额满：静默降级为「本次会话内有效」 */
  }
}

/* ---------- 主题 ---------- */

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveDark(theme: ThemeMode): boolean {
  if (theme === 'DARK') return true;
  if (theme === 'LIGHT') return false;
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;
}

/** 把主题写入 <html data-theme>（06 §4.1） */
export function applyTheme(theme: ThemeMode): void {
  const dark = resolveDark(theme);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#1C1A17' : '#FAF7F0');
}

/** 监听系统主题变化（theme = SYSTEM 时生效）；返回取消订阅函数 */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(DARK_QUERY);
  const handler = () => onChange();
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

/* ---------- 布局形态 ---------- */

function matchesDesktop(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/** 把 LayoutMode 解析成实际形态：强制值优先，AUTO 才看视口宽度 */
export function resolveLayout(mode: LayoutMode): EffectiveLayout {
  if (mode === 'DESKTOP') return 'desk';
  if (mode === 'MOBILE') return 'mobile';
  return matchesDesktop() ? 'desk' : 'mobile';
}

/**
 * 把形态写入 `<html data-layout>`。
 *
 * CSS 的断点不再写 `@media (min-width: 900px)`，而是写
 * `[data-layout='desk'] &` —— 这样「用户强制」与「视口自适应」共用同一套选择器，
 * 不会出现两套各写一遍、日后改一处忘另一处的漂移。
 */
export function applyLayout(mode: LayoutMode): void {
  document.documentElement.setAttribute('data-layout', resolveLayout(mode));
}

/** 监听视口跨断点（仅 AUTO 下需要重算）；返回取消订阅函数 */
export function watchViewport(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(DESKTOP_QUERY);
  const handler = () => onChange();
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

/** 「切换」按钮的下一个形态：当前是桌面形态就切手机，反之切电脑 */
export function nextToggleLayout(mode: LayoutMode): LayoutMode {
  return resolveLayout(mode) === 'desk' ? 'MOBILE' : 'DESKTOP';
}
