/* ============================================================
 * 应用设置持久化 —— 对应 04 文档 §三 DataStore 设置项
 * Web 端以 localStorage 承载（单机、无云同步，与 NFR-03 一致）
 * ============================================================ */

import type { CastMethod, TiYongRule } from '@plumora/core';
import type { StrokeStandard } from '@plumora/knowledge';

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface Settings {
  /** 笔画标准（FR-10） */
  strokeStandard: StrokeStandard;
  /** 默认起卦方式（FR-10） */
  defaultCastMethod: CastMethod;
  /** 体用判定规则（FR-10 / 03 §3.6） */
  tiYongRule: TiYongRule;
  /** 主题 */
  theme: ThemeMode;
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
