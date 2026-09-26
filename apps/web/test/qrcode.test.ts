/* ============================================================
 * 二维码测试 —— 「手机扫码打开本页」
 *
 * ⚠ 这里做的是**往返校验**：自己生成矩阵 → 栅格化 → 交给真实解码器 jsQR →
 *   断言解出来的文本与输入逐字相同。
 *
 * 为什么不能只断言「矩阵非空 / 尺寸对」：那类断言在编码逻辑写错时照样全绿
 * （错矩阵也是非空的），而用户扫码失败时我们完全没有信号。
 * 用解码器回读，等于把「手机上的扫码器能不能认出来」这件事搬进了 CI。
 * ============================================================ */

import { describe, expect, it, vi } from 'vitest';
import jsQR from 'jsqr';
import { qrMatrix, qrRgba, qrSvg } from '@/platform/qrcode';
import { lanUrls, shareTarget, type ShareTarget } from '@/platform/share';

/** 用解码器回读，返回解出的文本（解不出返回 null） */
function decode(text: string): string | null {
  const { data, width, height } = qrRgba(text);
  const res = jsQR(data, width, height);
  return res ? res.data : null;
}

describe('二维码生成（往返解码校验）', () => {
  it('短 URL 能被解回原文', () => {
    const url = 'http://192.168.1.5:5173/#/cast';
    expect(decode(url)).toBe(url);
  });

  it('带查询串与长 hash 的 URL（跨版本，需更大的码）', () => {
    const url = 'http://192.168.1.5:5173/?from=qr#/records/123?foo=bar';
    expect(decode(url)).toBe(url);
  });

  it('中文走 UTF-8（库的默认编码会把非 ASCII 截断）', () => {
    const url = 'http://192.168.1.5:5173/#/records?title=观梅占';
    expect(decode(url)).toBe(url);
  });

  it('长内容自动升版本（跨过版本 1 的容量上限）', () => {
    const url = 'http://192.168.1.5:5173/#/learn?' + 'x=1&'.repeat(40) + 'end=1';
    const m = qrMatrix(url);
    expect(m.version).toBeGreaterThan(2);
    expect(decode(url)).toBe(url);
  });

  it('空内容响亮失败（不是生成一个空码让用户扫了个寂寞）', () => {
    expect(() => qrMatrix('')).toThrow(/为空/);
  });

  it('SVG：静区默认 4 且模块被合并成单条 path', () => {
    const svg = qrSvg('http://192.168.1.5:5173/#/cast');
    // 静区是规范要求的 4 个模块（上下左右各 4 → 边长 +8）
    expect(svg.size).toBe(svg.moduleCount + 8);
    expect(svg.viewBox).toBe(`0 0 ${svg.size} ${svg.size}`);
    // 没有静区的话 path 会从 0 开始，说明 margin 没生效
    expect(svg.path.startsWith('M')).toBe(true);
    // 合并生效：段数应明显少于深色模块总数
    const segments = svg.path.split('M').length - 1;
    expect(segments).toBeGreaterThan(0);
    expect(segments).toBeLessThan(svg.moduleCount * svg.moduleCount);
  });
});

/* ------------------------------------------------------------------ */

describe('跨设备地址（shareTarget）', () => {
  /**
   * 只测纯逻辑，需要 location 与 document。
   * 用 vi.stubGlobal 换掉，测完还原。
   */
  function withHost(
    hostname: string,
    metaContent: string,
    fn: (get: () => ShareTarget) => void,
  ): void {
    const originals = { location: globalThis.location, document: globalThis.document };
    const url = `http://${hostname}:5173/app/#/records`;
    vi.stubGlobal('location', {
      href: url,
      hostname,
      pathname: '/app/',
      search: '',
      hash: '#/records',
    });
    vi.stubGlobal('document', {
      querySelector: (sel: string) =>
        sel === 'meta[name="plumora-lan-urls"]' ? { getAttribute: () => metaContent } : null,
    });
    try {
      fn(shareTarget);
    } finally {
      vi.stubGlobal('location', originals.location);
      vi.stubGlobal('document', originals.document);
    }
  }

  it('回环地址 + 有局域网地址 → 换成局域网地址，且保留路由 hash', () => {
    withHost('localhost', '["http://192.168.1.5:5173/"]', (get) => {
      const t = get();
      expect(t.viaLan).toBe(true);
      expect(t.url).toBe('http://192.168.1.5:5173/app/#/records');
      expect(t.note).toContain('同一个 Wi-Fi');
    });
  });

  it('回环地址 + 无局域网地址 → 原样返回并明确提示扫不了', () => {
    withHost('127.0.0.1', '[]', (get) => {
      const t = get();
      expect(t.viaLan).toBe(false);
      expect(t.url).toContain('127.0.0.1');
      expect(t.note).toContain('打不开');
    });
  });

  it('已经是局域网地址 → 原样使用，不做无谓改写', () => {
    withHost('192.168.1.5', '["http://192.168.1.5:5173/"]', (get) => {
      const t = get();
      expect(t.viaLan).toBe(false);
      expect(t.url).toBe('http://192.168.1.5:5173/app/#/records');
      expect(t.note).toBe('');
    });
  });

  it('公网地址（部署后）→ 原样使用', () => {
    withHost('plumora.example.com', '', (get) => {
      const t = get();
      expect(t.viaLan).toBe(false);
      expect(t.url).toBe('http://plumora.example.com:5173/app/#/records');
    });
  });

  it('meta 内容不是合法 JSON → 退回空列表，不抛异常', () => {
    withHost('localhost', '{oops', (get) => {
      expect(() => get()).not.toThrow();
      expect(lanUrls()).toEqual([]);
    });
  });
});
