/* ============================================================
 * 排盘分享链接编解码（platform/shareLink）
 *
 * 这个模块的输入来自**任何人**：链接会被聊天软件截断、被人手动改、
 * 被旧版本生成。所以测试的重心不是「正常路径能跑」，而是
 * **异常路径一律安静地失败** —— 参数不合法必须解析成 null，
 * 让调用方退回「没有分享参数」，而不是把半个对象喂进推导流程。
 *
 * 另一条要钉死的是隐私：链接里**不能**出现所问之事。
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { castByCharacter, castByNumber, castByRandom, castByTimeParts } from '@plumora/core';
import type { CastResult } from '@plumora/core';
import {
  decodeSharedCast,
  encodeSharedCast,
  SHARE_PARAM,
  sharedResultPath,
  withSharedCast,
} from '@/platform/shareLink';

const AT = 1_790_000_000_000;

const timeCast = castByTimeParts(7, 8, 15, 7, { label: '丙午年 八月十五 午时' });
const numberCast = castByNumber(17, 8);
const charCast = castByCharacter({ strokes: [11, 8], chars: ['梅', '花'], standard: 'SIMPLIFIED', second: 30 });

/** 字符串 → base64（按 UTF-8 走一遍：btoa 直接吃汉字会抛 InvalidCharacterError） */
function b64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function b64json(v: unknown): string {
  return b64(JSON.stringify(v));
}

/** 取回载荷原文（测试专用：用于断言「链接里到底装了什么」） */
function payloadOf(encoded: string): Record<string, unknown> {
  const b64v = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64v + '='.repeat((4 - (b64v.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

describe('shareLink：往返', () => {
  it('四种起卦方式的卦例都能原样还原（含起卦时刻与体用流派）', () => {
    const randomCast = castByRandom(() => 0.5);
    const casts: CastResult[] = [timeCast, numberCast, charCast, randomCast];

    for (const cast of casts) {
      const round = decodeSharedCast(encodeSharedCast(cast, 'UPPER_YONG_LOWER_TI', AT));
      expect(round).not.toBeNull();
      expect(round!.cast).toEqual(cast);
      expect(round!.tiYongRule).toBe('UPPER_YONG_LOWER_TI');
      expect(round!.castAt).toBe(AT);
    }
  });

  it('载荷只装 {v, c, r, t} —— 所问之事等本机信息不进链接', () => {
    const keys = Object.keys(payloadOf(encodeSharedCast(numberCast, 'MOVING_LINE', AT))).sort();
    expect(keys).toEqual(['c', 'r', 't', 'v']);
    // 二次确认：载荷里没有 question 一类的键
    expect(JSON.stringify(payloadOf(encodeSharedCast(numberCast, 'MOVING_LINE', AT)))).not.toContain(
      'question',
    );
  });

  it('编码结果是 URL 安全的（不含 + / =，无需再转义）', () => {
    const encoded = encodeSharedCast(timeCast, 'MOVING_LINE', AT);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('shareLink：非法输入一律解析为 null', () => {
  const bad: Array<[string, string | null | undefined]> = [
    ['undefined', undefined],
    ['空串', ''],
    ['不是 base64 的字符', '!!!not-base64!!!'],
    ['合法 base64 但不是 JSON', b64('hello world')],
    ['JSON 数组', b64json([1, 2, 3])],
    ['版本不符（旧链接）', b64json({ v: 99, c: numberCast, r: 'MOVING_LINE', t: AT })],
    ['版本位缺失', b64json({ c: numberCast, r: 'MOVING_LINE', t: AT })],
    ['流派非法', b64json({ v: 1, c: numberCast, r: 'WHATEVER', t: AT })],
    ['起卦时刻非法', b64json({ v: 1, c: numberCast, r: 'MOVING_LINE', t: 0 })],
    ['方式非法', b64json({ v: 1, c: { ...numberCast, method: 'SOUND' }, r: 'MOVING_LINE', t: AT })],
    ['上卦越界（9）', b64json({ v: 1, c: { ...numberCast, upper: 9 }, r: 'MOVING_LINE', t: AT })],
    ['动爻越界（7）', b64json({ v: 1, c: { ...numberCast, moving: 7 }, r: 'MOVING_LINE', t: AT })],
    ['动爻为 0', b64json({ v: 1, c: { ...numberCast, moving: 0 }, r: 'MOVING_LINE', t: AT })],
    [
      'params 缺失（castContext 会在此崩）',
      b64json({ v: 1, c: { method: 'TIME', upper: 6, lower: 5, moving: 1, label: '' }, r: 'MOVING_LINE', t: AT }),
    ],
    [
      '时间起卦 precision 非法',
      b64json({ v: 1, c: { ...timeCast, params: { ...timeCast.params, precision: 'HOUR' } }, r: 'MOVING_LINE', t: AT }),
    ],
    [
      '汉字起卦笔画数与字数不齐',
      b64json({ v: 1, c: { ...charCast, strokes: [11] }, r: 'MOVING_LINE', t: AT }),
    ],
  ];

  for (const [name, raw] of bad) {
    it(name, () => {
      expect(decodeSharedCast(raw)).toBeNull();
    });
  }

  it('被截断的链接（聊天气泡里常见的断尾）', () => {
    const encoded = encodeSharedCast(timeCast, 'MOVING_LINE', AT);
    expect(decodeSharedCast(encoded.slice(0, Math.floor(encoded.length / 2)))).toBeNull();
    expect(decodeSharedCast(encoded.slice(0, -3))).toBeNull();
  });
});

describe('shareLink：拼地址', () => {
  it('sharedResultPath 形如 /result?c=…（键名与 router 取值一致）', () => {
    const path = sharedResultPath(numberCast, 'MOVING_LINE', AT);
    expect(path.startsWith(`/result?${SHARE_PARAM}=`)).toBe(true);
    expect(decodeSharedCast(path.slice(`/result?${SHARE_PARAM}=`.length))!.cast).toEqual(numberCast);
  });

  it('withSharedCast 只换 hash，保留协议 / 子目录 / 查询串', () => {
    const url = withSharedCast(
      'http://192.168.1.8:5173/Plumora/?debug=1#/cast',
      numberCast,
      'MOVING_LINE',
      AT,
    );
    expect(url.startsWith('http://192.168.1.8:5173/Plumora/?debug=1#/result?c=')).toBe(true);
    expect(url).not.toContain('#/cast');
  });

  it('withSharedCast 对没有 hash 的地址也能用', () => {
    const url = withSharedCast('https://example.com/plumora/', numberCast, 'MOVING_LINE', AT);
    expect(url.startsWith('https://example.com/plumora/#/result?c=')).toBe(true);
  });
});
