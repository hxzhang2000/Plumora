/* ============================================================
 * 应用设置持久化 —— 对应 04 文档 §三 DataStore 设置项
 * Web 端以 localStorage 承载（单机、无云同步，与 NFR-03 一致）
 * ============================================================ */

import { METHOD_CN, type CastMethod, type TiYongRule } from '@plumora/core';
import type { StrokeStandard } from '@plumora/knowledge';

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';

/**
 * 布局形态判定：自动识别「登录用的是手机还是电脑」，不再提供手动选择。
 *
 * 为什么收掉手动切换（用户 2026-10-13 要求）：
 * 手机 / 电脑可以从 UA、指针类型、屏幕尺寸可靠识别，让用户自己去选
 * 「电脑模式 / 手机模式」反而多一步无谓操作，选错了界面还会错乱。
 *
 * 识别口径（detectDeviceKind）：
 *   ① UA 命中移动端特征（Android / iPhone / Windows Phone…）→ 手机；
 *   ② 粗指针（触摸优先）+ 屏幕短边 < 500px → 手机（兜住 UA 不说
 *      "Mobile" 的小屏设备，如部分 Android Go / 功能机）；
 *   ③ 其余 → 电脑（含平板：UA 无 "Mobile" 时按电脑走，宽窄由视口决定）。
 *
 * 视口仍参与兜底（resolveLayout）：电脑设备 + 窄窗口（< 900px）→ 手机形态，
 * 桌面用户把窗口拉窄时布局照常自适应，不会挤出侧栏。
 */
export type EffectiveLayout = 'desk' | 'mobile';

/** 断点判据（06 §6.2）：< 900px 为移动端形态，≥ 900px 为桌面端形态 */
export const DESKTOP_QUERY = '(min-width: 900px)';

/** 移动端 UA 特征（覆盖 iOS / Android / Windows Phone / BlackBerry / Opera Mini） */
const MOBILE_UA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Windows Phone/i;

/** 触屏优先且屏幕短边 < 500px 时按手机处理（兜住 UA 不标准的移动设备） */
const SMALL_SCREEN_EDGE = 500;

/**
 * 识别设备种类（手机 / 电脑）。
 *
 * 纯启发式，不依赖任何外部库；宿主能力缺失时（SSR / 测试桩）按视口回落。
 */
export function detectDeviceKind(): EffectiveLayout {
  if (typeof navigator !== 'undefined' && MOBILE_UA.test(navigator.userAgent || '')) {
    return 'mobile';
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    typeof screen !== 'undefined' &&
    Math.min(screen.width, screen.height) < SMALL_SCREEN_EDGE
  ) {
    return 'mobile';
  }
  return 'desk';
}

/** 视口当前是否已达桌面断点（06 §6.2）。手机框预览也用它：窄屏 = 真机，不套框 */
export function matchesDesktop(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/**
 * 实际生效的布局形态：先识别设备，电脑设备再看视口宽度兜底。
 *
 * 手机恒为手机形态（真机视口本就 < 900px；个别「桌面站点」UA 的浏览器
 * 也会被窄视口拉回手机形态）；电脑设备宽窗为桌面形态，窄窗回落手机形态。
 */
export function resolveLayout(): EffectiveLayout {
  if (detectDeviceKind() === 'mobile') return 'mobile';
  return matchesDesktop() ? 'desk' : 'mobile';
}

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

/**
 * 清洗默认起卦方式。
 *
 * 起卦方式会随产品决策增减（声音/点数起卦已下线），但 localStorage 里存的
 * 是写入当时的值。不清洗的话，老用户升级后 `defaultCastMethod` 仍是 'SOUND'，
 * 起卦页的方式选择器三项全不选中、点「起卦」也无反应——用户只会以为应用坏了。
 */
export function sanitizeCastMethod(value: unknown): CastMethod {
  return typeof value === 'string' && value in METHOD_CN
    ? (value as CastMethod)
    : DEFAULT_SETTINGS.defaultCastMethod;
}

/**
 * 载入设置：白名单取键 + 起卦方式清洗。
 *
 * 白名单而不是 `{...DEFAULT, ...parsed}`：设置项会随产品决策增减
 * （手动布局选择已下线、声音起卦已下线），旧 localStorage 里的历史键
 * （如 layoutMode: 'DESKTOP'）必须被剥掉，否则会跟着 watch 永久写回存储。
 */
export function loadSettings(): Settings {
  const base: Settings = { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...base,
      ...(parsed.strokeStandard !== undefined && { strokeStandard: parsed.strokeStandard }),
      ...(parsed.tiYongRule !== undefined && { tiYongRule: parsed.tiYongRule }),
      ...(parsed.theme !== undefined && { theme: parsed.theme }),
      ...(parsed.recordLimit !== undefined && { recordLimit: parsed.recordLimit }),
      ...(parsed.disclaimerAcknowledged !== undefined && {
        disclaimerAcknowledged: parsed.disclaimerAcknowledged,
      }),
      defaultCastMethod: sanitizeCastMethod(parsed.defaultCastMethod),
    };
  } catch {
    return base;
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

/**
 * 把形态写入 `<html data-layout>`。
 *
 * CSS 的断点不再写 `@media (min-width: 900px)`，而是写
 * `[data-layout='desk'] &` —— 「设备识别」与「视口兜底」共用同一套选择器，
 * 不会出现两套各写一遍、日后改一处忘另一处的漂移。
 */
export function applyLayout(): void {
  document.documentElement.setAttribute('data-layout', resolveLayout());
}

/** 监听视口跨断点（电脑设备窄窗 ↔ 宽窗时重算）；返回取消订阅函数 */
export function watchViewport(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(DESKTOP_QUERY);
  const handler = () => onChange();
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
