/* ============================================================
 * apps/web 冒烟测试
 *
 * 目标：不引入 jsdom / fake-indexeddb，用最小桩验证 Web 端的
 * 「非渲染逻辑」——路由、设置持久化、导出纯函数、排盘暂存。
 * 渲染层（.vue）由 vue-tsc + 人工验收覆盖。
 *
 * 覆盖红线：cast 暂存必须能端到端还原金标准算例 A（水风井）。
 * ============================================================ */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HexagramRecord } from '@plumora/core';

/* ---------- 环境桩：node 环境下补齐 localStorage / sessionStorage / DOM ---------- */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

/**
 * 最小元素桩。只为满足两处需求：
 *   ① platform/settings 的 applyTheme（setAttribute）
 *   ② vue 的 @vue/runtime-dom 在模块加载时执行 `doc.createElement('template')`
 * 渲染行为不在此覆盖（那属于 .vue 层，由 vue-tsc + 人工验收）。
 */
interface StubElement {
  attrs: Record<string, string>;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  appendChild(child: unknown): unknown;
  removeChild(child: unknown): unknown;
  addEventListener(): void;
  removeEventListener(): void;
  querySelector(): null;
}

function stubElement(): StubElement {
  const attrs: Record<string, string> = {};
  const el: StubElement = {
    attrs,
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
    getAttribute(name) {
      return attrs[name] ?? null;
    },
    removeAttribute(name) {
      delete attrs[name];
    },
    appendChild(child) {
      return child;
    },
    removeChild(child) {
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector() {
      return null;
    },
  };
  return el;
}

const htmlEl = stubElement();
const metaEl = stubElement();

(globalThis as Record<string, unknown>).localStorage = new MemoryStorage();
(globalThis as Record<string, unknown>).sessionStorage = new MemoryStorage();
(globalThis as Record<string, unknown>).document = {
  documentElement: htmlEl,
  head: stubElement(),
  body: stubElement(),
  createElement: () => stubElement(),
  createElementNS: () => stubElement(),
  createTextNode: () => stubElement(),
  createComment: () => stubElement(),
  querySelector: (sel: string) => (sel.includes('theme-color') ? metaEl : null),
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
};

/* ---------- 设置 ---------- */

describe('platform/settings', () => {
  it('无存储时返回默认值', async () => {
    const { loadSettings, DEFAULT_SETTINGS, SETTINGS_KEY } = await import('@/platform/settings');
    localStorage.removeItem(SETTINGS_KEY);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings().tiYongRule).toBe('MOVING_LINE');
    expect(loadSettings().recordLimit).toBe(0);
  });

  it('写入后可原样读回', async () => {
    const { loadSettings, saveSettings, DEFAULT_SETTINGS } = await import('@/platform/settings');
    saveSettings({
      ...DEFAULT_SETTINGS,
      strokeStandard: 'TRADITIONAL',
      defaultCastMethod: 'CHARACTER',
      theme: 'DARK',
      recordLimit: 500,
      disclaimerAcknowledged: true,
    });
    const back = loadSettings();
    expect(back.strokeStandard).toBe('TRADITIONAL');
    expect(back.defaultCastMethod).toBe('CHARACTER');
    expect(back.recordLimit).toBe(500);
    expect(back.disclaimerAcknowledged).toBe(true);
  });

  it('脏数据回退到默认值（缺失字段用默认补齐）', async () => {
    const { loadSettings, SETTINGS_KEY, DEFAULT_SETTINGS } = await import('@/platform/settings');
    localStorage.setItem(SETTINGS_KEY, '{ 这不是合法 JSON');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: 'DARK' }));
    const partial = loadSettings();
    expect(partial.theme).toBe('DARK');
    expect(partial.strokeStandard).toBe(DEFAULT_SETTINGS.strokeStandard);
  });

  it('resolveDark：显式主题优先于系统；SYSTEM 跟随系统', async () => {
    const { resolveDark } = await import('@/platform/settings');
    expect(resolveDark('DARK')).toBe(true);
    expect(resolveDark('LIGHT')).toBe(false);
    // node 环境无 window.matchMedia → SYSTEM 解析为 false
    expect(resolveDark('SYSTEM')).toBe(false);
  });

  it('applyTheme 写入 <html data-theme> 与 theme-color', async () => {
    const { applyTheme } = await import('@/platform/settings');
    applyTheme('DARK');
    expect(htmlEl.attrs['data-theme']).toBe('dark');
    expect(metaEl.attrs.content).toBe('#1C1A17');
    applyTheme('LIGHT');
    expect(htmlEl.attrs['data-theme']).toBe('light');
    expect(metaEl.attrs.content).toBe('#FAF7F0');
  });
});

/* ---------- 导出纯函数 ---------- */

const FIXTURE = {
  id: 1,
  createdAt: 1_790_000_000_000,
  updatedAt: 1_790_000_000_000,
  method: 'TIME',
  inputParams: '{}',
  lunarLabel: '丙午年 八月十五 午时',
  upperTrigram: 6,
  lowerTrigram: 5,
  movingLine: 1,
  benGuaCode: '06-05',
  benGuaName: '水风井',
  huGuaCode: '03-02',
  bianGuaCode: '06-01',
  tiTrigram: 6,
  yongTrigram: 5,
  tiYongRule: 'MOVING_LINE',
  relation: 'TI_SHENG_YONG',
  question: '问事,含逗号',
  note: null,
  verifyStatus: 'UNVERIFIED',
} as unknown as HexagramRecord;

const LOOKUP = {
  hexName: (code: string) => (code === '03-02' ? '火泽睽' : code === '06-01' ? '水天需' : code),
  lineName: () => '初六',
  tiYong: () => '体坎 用巽',
  methodCn: () => '时间',
  verifyCn: () => '未验',
};

describe('platform/records（纯函数部分）', () => {
  it('toExportBundle：schemaVersion/app 固定，records 按 createdAt 升序', async () => {
    const { toExportBundle } = await import('@/platform/records');
    const newer = { ...FIXTURE, id: 2, createdAt: 1_790_000_100_000 } as HexagramRecord;
    const bundle = toExportBundle([newer, FIXTURE]);
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.app).toBe('观梅 · Plumora');
    expect(bundle.records.map((r) => r.id)).toEqual([1, 2]);
    expect(Number.isNaN(Date.parse(bundle.exportedAt))).toBe(false);
  });

  it('toCsv：表头 12 列，含逗号字段被引号包裹', async () => {
    const { toCsv } = await import('@/platform/records');
    const csv = toCsv([FIXTURE], LOOKUP);
    const [header, row] = csv.split('\r\n');
    expect(header.split(',')).toHaveLength(12);
    expect(header.startsWith('时间,农历,方式,所问之事,本卦')).toBe(true);
    expect(row).toContain('"问事,含逗号"');
    expect(row).toContain('水风井');
    expect(row).toContain('火泽睽');
    expect(row).toContain('水天需');
    expect(row).toContain('体坎 用巽');
  });

  /**
   * 审查 W-6：CSV 公式注入必须被中和。
   *
   * 用户在「所问之事 / 备注」里写 `=cmd|' /C calc'!A0`，导出后在 Excel 打开会触发 DDE。
   * 引号包裹只解决字段分隔，Excel 仍会把 `"...=..."` 当公式求值——所以必须以
   * `'` 前缀把它变成文本。这里覆盖 = + - @ 与前导 Tab 五种危险开头。
   */
  it('toCsv：以 = + - @ 开头的字段被前缀单引号中和（公式注入）', async () => {
    const { toCsv } = await import('@/platform/records');
    const cases: [string, string][] = [
      ["=cmd|' /C calc'!A0", "'=cmd|' /C calc'!A0"],
      ['+1+1', "'+1+1"],
      ['-1+1', "'-1+1"],
      ['@SUM(A1)', "'@SUM(A1)"],
      ['\tTAB', "'\tTAB"],
    ];
    for (const [input, expectedCell] of cases) {
      const row = toCsv([{ ...FIXTURE, question: input } as HexagramRecord], LOOKUP).split('\r\n')[1];
      expect(row, `未中和：${input}`).toContain(expectedCell);
    }
  });

  it('toCsv：普通文本不被加前缀（不误伤）', async () => {
    const { toCsv } = await import('@/platform/records');
    const row = toCsv([{ ...FIXTURE, question: '这次面试能否通过' } as HexagramRecord], LOOKUP).split(
      '\r\n',
    )[1];
    expect(row).toContain('这次面试能否通过');
    expect(row).not.toContain("'这次");
  });

  it('exportFilename：guanmei_export_yyyyMMdd_HHmmss.ext', async () => {
    const { exportFilename } = await import('@/platform/records');
    const at = new Date(2026, 8, 25, 9, 5, 3);
    expect(exportFilename('json', at)).toBe('guanmei_export_20260925_090503.json');
    expect(exportFilename('csv', at)).toBe('guanmei_export_20260925_090503.csv');
  });
});

/* ---------- 排盘暂存（与 core 的端到端接线） ---------- */

describe('stores/cast', () => {
  beforeEach(async () => {
    vi.resetModules();
    sessionStorage.clear();
  });

  it('初始为空', async () => {
    const { useCurrentCast } = await import('@/stores/cast');
    expect(useCurrentCast().value).toBeNull();
  });

  it('暂存金标准算例 A：坎上巽下动 1 → 水风井 / 体生用小凶', async () => {
    const { setCurrentCast, useCurrentCast, useResolvedCast, ensureResolved } = await import(
      '@/stores/cast'
    );
    const { castByTimeParts } = await import('@plumora/core');

    // 丙午年八月十五午时（07 文档 TC-LC01 的等价输入）
    const cast = castByTimeParts(7, 8, 15, 7, { label: '丙午年 八月十五 午时' });
    const pending = setCurrentCast(cast, 'MOVING_LINE');

    // 推导是异步的（六十四卦全表按需加载，见 stores/cast.ts 文件头）
    expect(useResolvedCast().value).toBeNull();
    const resolved = await ensureResolved();
    expect(resolved).not.toBeNull();

    expect(resolved!.ben.name).toBe('水风井');
    expect(resolved!.bian.name).toBe('水天需');
    expect(resolved!.hu.name).toBe('火泽睽');
    expect(resolved!.moving).toBe(1);
    expect(resolved!.judge.degree).toBe('XIAO_XIONG');
    expect(pending.context).toContain('丙午年');
    // 注意：ref 会把对象包成 reactive 代理，故此处比字段而非对象身份
    const stored = useCurrentCast().value;
    expect(stored).not.toBeNull();
    expect(stored!.castAt).toBe(pending.castAt);
    expect(stored!.tiYongRule).toBe('MOVING_LINE');
    expect(useResolvedCast().value!.ben.name).toBe('水风井');
  });

  it('sessionStorage 持久化：重新载入模块后仍可还原', async () => {
    const mod1 = await import('@/stores/cast');
    const { castByTimeParts } = await import('@plumora/core');
    mod1.setCurrentCast(castByTimeParts(7, 8, 15, 7, { label: '丙午年 八月十五 午时' }), 'MOVING_LINE');
    expect(sessionStorage.length).toBeGreaterThan(0);

    vi.resetModules();
    const mod2 = await import('@/stores/cast');
    expect(mod2.useCurrentCast().value).not.toBeNull();
    // 还原后推导是惰性的：ensureResolved 才真正算（首屏不为它付费）
    expect(mod2.useResolvedCast().value).toBeNull();
    expect((await mod2.ensureResolved())!.ben.name).toBe('水风井');
  });

  it('ensureResolved 按卦例缓存：同一卦不重复推导', async () => {
    const { setCurrentCast, ensureResolved } = await import('@/stores/cast');
    const { castByTimeParts } = await import('@plumora/core');
    setCurrentCast(castByTimeParts(7, 8, 15, 7, { label: '丙午年 八月十五 午时' }), 'MOVING_LINE');
    const a = await ensureResolved();
    const b = await ensureResolved();
    expect(a).toBe(b); // 同一个对象身份 = 走了缓存
  });

  it('clearCurrentCast 清空内存与 sessionStorage', async () => {
    const { setCurrentCast, clearCurrentCast, useCurrentCast } = await import('@/stores/cast');
    const { castByTimeParts } = await import('@plumora/core');
    setCurrentCast(castByTimeParts(7, 8, 15, 7, { label: '丙午年 八月十五 午时' }), 'MOVING_LINE');
    clearCurrentCast();
    expect(useCurrentCast().value).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  /* ---------- 分享链接恢复（`#/result?c=…`）----------
   * 编解码本身在 test/share-link.test.ts；这里只钉住 store 的采纳策略：
   * 什么时候接管、什么时候必须保持现状不动。 */

  it('adoptSharedCast：合法链接接管整盘（问题不带过来）', async () => {
    const { adoptSharedCast, useCurrentCast, useResolvedCast, ensureResolved } = await import(
      '@/stores/cast'
    );
    const { castByNumber } = await import('@plumora/core');
    const { encodeSharedCast } = await import('@/platform/shareLink');

    // 朋友用数字起卦，17 / 8
    const cast = castByNumber(17, 8);
    const at = 1_790_000_000_000;
    expect(adoptSharedCast(encodeSharedCast(cast, 'MOVING_LINE', at))).toBe(true);

    const cur = useCurrentCast().value;
    expect(cur).not.toBeNull();
    expect(cur!.cast).toEqual(cast);
    expect(cur!.castAt).toBe(at);
    // 链接刻意不含所问之事（隐私）：恢复出来必须为空，不能沿用上一个卦例的问题
    expect(cur!.question).toBe('');

    // 接管后照常预热推导，结果页不必等：17/8 动 1 → 乾上坤下 → 天地否
    expect(useResolvedCast().value).toBeNull();
    expect((await ensureResolved())!.ben.name).toBe('天地否');
    expect(sessionStorage.length).toBeGreaterThan(0);
  });

  it('adoptSharedCast：参数缺失 / 不合法一律不动现有卦例', async () => {
    const { adoptSharedCast, setCurrentCast, useCurrentCast } = await import('@/stores/cast');
    const { castByTimeParts } = await import('@plumora/core');

    const mine = setCurrentCast(
      castByTimeParts(7, 8, 15, 7, { label: '丙午年 八月十五 午时' }),
      'MOVING_LINE',
      '我的问题',
    );
    for (const raw of [undefined, '', '!!!', 'YWJj']) {
      expect(adoptSharedCast(raw)).toBe(false);
    }
    // 逐字段与刚起的那一卦一致（current 是 ref，取出的是响应式代理，
    // 不能比对象身份）——包括用户填的「所问之事」，说明完全没被碰过。
    expect(useCurrentCast().value).toEqual(mine);
    expect(useCurrentCast().value!.question).toBe('我的问题');
  });

  it('adoptSharedCast：同一盘（castAt 相同）保持本机状态，不抹掉所问之事', async () => {
    const { adoptSharedCast, setCurrentCast, useCurrentCast } = await import('@/stores/cast');
    const { castByNumber } = await import('@plumora/core');
    const { encodeSharedCast } = await import('@/platform/shareLink');

    const cast = castByNumber(17, 8);
    // 自己起卦后地址栏被写入分享参数，随后刷新页面：链接与 sessionStorage 是同一盘，
    // 此时应以本机状态为准（它还带着用户填的「所问之事」）
    const mine = setCurrentCast(cast, 'MOVING_LINE', '这次面试能否通过');
    expect(adoptSharedCast(encodeSharedCast(cast, 'MOVING_LINE', mine.castAt))).toBe(false);

    const cur = useCurrentCast().value!;
    expect(cur.question).toBe('这次面试能否通过');
  });
});
