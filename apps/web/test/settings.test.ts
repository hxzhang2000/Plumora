/* ============================================================
 * 设置持久化测试 —— 重点：起卦方式下线后的旧设置清洗
 *
 * 为什么需要它：声音（点数）起卦下线后，老用户 localStorage 里的
 * `defaultCastMethod` 仍是 'SOUND'。不清洗的话起卦页三项方式全不选中，
 * 点「起卦」也无反应——用户只会以为应用坏了，而开发者本地是干净配置，永远复现不了。
 *
 * 只测纯逻辑 + localStorage 桩，不碰 DOM。
 * ============================================================ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ---------- 宿主桩：内存版 localStorage ---------- */

const store = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

const { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, sanitizeCastMethod } =
  await import('@/platform/settings');

function seed(method: string): void {
  store.set(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, defaultCastMethod: method }));
}

describe('设置载入与起卦方式清洗', () => {
  beforeEach(() => {
    store.clear();
  });

  it('无存储 → 默认时间起卦', () => {
    expect(loadSettings().defaultCastMethod).toBe('TIME');
  });

  it('已下线的「声音」→ 回落默认（否则方式选择器全不选中、点起卦无反应）', () => {
    seed('SOUND');
    expect(loadSettings().defaultCastMethod).toBe('TIME');
  });

  it('在册方式原样保留（防止清洗过度收紧）', () => {
    for (const m of ['TIME', 'NUMBER', 'CHARACTER', 'RANDOM'] as const) {
      seed(m);
      expect(loadSettings().defaultCastMethod).toBe(m);
    }
  });

  it('其余设置项不受清洗影响', () => {
    store.set(
      SETTINGS_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, defaultCastMethod: 'SOUND', strokeStandard: 'TRADITIONAL' }),
    );
    const s = loadSettings();
    expect(s.defaultCastMethod).toBe('TIME');
    expect(s.strokeStandard).toBe('TRADITIONAL');
  });

  it('脏值 / 非字符串 / 非法 JSON 一律回落到默认', () => {
    expect(sanitizeCastMethod('SOUND')).toBe('TIME');
    expect(sanitizeCastMethod('')).toBe('TIME');
    expect(sanitizeCastMethod(undefined)).toBe('TIME');
    expect(sanitizeCastMethod(42)).toBe('TIME');
    store.set(SETTINGS_KEY, '{ not json');
    expect(loadSettings().defaultCastMethod).toBe('TIME');
  });
});
