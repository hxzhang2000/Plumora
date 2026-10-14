/* ============================================================
 * 排盘分享链接 —— 把一次卦例编进 URL，别人打开就是同一盘
 *
 * 为什么除了一张图还要有链接：图发出去是「死」的——不能点、不能展开、
 * 转发几手之后没人说得清那是哪一卦。链接则能在对方手机上打开完整结果页
 * （本卦 / 互卦 / 变卦、体用生克、卦辞爻辞、六十四卦全图都在）。
 *
 * 为什么不带「所问之事」：链接会进群聊、进收藏夹，而问的往往是私事
 * （问财、问病、问姻缘）。只带卦象与起卦方式，问题本身留在本机。
 *
 * 编码：`{v, c: cast, r: rule, t: castAt}` → JSON → UTF-8 → base64url，
 * 挂在 `#/result?c=` 上。用 base64 而不是 percent-encoding：卦名 / 农历标签
 * 里全是汉字，一个汉字转义成 `%E4%B8%89` 要 9 个字符，base64 只要 4 个。
 *
 * 解析侧一律过结构校验：链接会被聊天软件截断、被人手改、或来自旧版本，
 * 这些情况只应表现为「没有分享参数」，绝不能把半个对象喂进推导流程
 * （`castContext` 会直接解引用 `cast.params`，缺字段就是一次白屏）。
 * ============================================================ */

import type { CastResult, TiYongRule } from '@plumora/core';

/** 分享参数在 hash 查询串里的键名：`#/result?c=…`（router 解析时按此取值） */
export const SHARE_PARAM = 'c';

/** 载荷版本。将来改结构时递增；旧链接会被安全丢弃（见 parsePayload） */
const PAYLOAD_VERSION = 1;

export interface SharedCast {
  readonly cast: CastResult;
  readonly tiYongRule: TiYongRule;
  /** 起卦时刻 epoch millis —— 决定非时间起卦的农历标签，必须原样带过去 */
  readonly castAt: number;
}

/* ---------- base64url（URL 安全，无需再 encodeURIComponent） ---------- */

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 解不出（非法字符 / 非法 UTF-8 序列）一律返回 null，由调用方当作「没有参数」 */
function fromBase64Url(payload: string): string | null {
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    // fatal: 半截的 UTF-8 序列直接抛错，不要让它解码成一串替换字符（U+FFFD）
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/* ---------- 结构校验 ----------
 * 只认「我们确实会读的字段」，逐字段过一遍。注意两点：
 *   ① 不校验整个 CastResult 的每个数字细节（那是 core 的领域），
 *      只保证下游会解引用的字段都在、类型对；
 *   ② 校验失败 = 丢弃整条参数，不做「尽量凑一个」的修补。 */

const METHODS = ['TIME', 'NUMBER', 'CHARACTER', 'RANDOM'] as const;
const RULES = ['MOVING_LINE', 'UPPER_YONG_LOWER_TI'] as const;
const PRECISIONS = ['SHICHEN', 'MINUTE', 'SECOND'] as const;
const STANDARDS = ['SIMPLIFIED', 'TRADITIONAL'] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isIn<T extends string>(v: unknown, list: readonly T[]): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

/** 先天数 1–8 */
function isTrigramNo(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 8;
}

function isInt(v: unknown, min: number, max: number): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

/** 起卦方式与共有的「上卦 / 下卦 / 动爻」 */
function isCommon(v: Record<string, unknown>): boolean {
  return isTrigramNo(v.upper) && isTrigramNo(v.lower) && isInt(v.moving, 1, 6);
}

function isCastResult(v: unknown): v is CastResult {
  if (!isRecord(v) || !isCommon(v)) return false;
  if (!isIn(v.method, METHODS)) return false;

  const p = v.params;
  if (!isRecord(p)) return false;

  switch (v.method) {
    case 'TIME':
      return (
        typeof v.label === 'string' &&
        typeof p.yearBranchNo === 'number' &&
        typeof p.lunarMonth === 'number' &&
        typeof p.lunarDay === 'number' &&
        typeof p.hourNo === 'number' &&
        typeof p.s1 === 'number' &&
        typeof p.s2 === 'number' &&
        typeof p.shifted === 'boolean' &&
        isIn(p.precision, PRECISIONS) &&
        isInt(p.minute, 0, 59) &&
        isInt(p.second, 0, 59) &&
        typeof p.movingSum === 'number'
      );
    case 'NUMBER':
      if (p.mode === 'TWO') return isInt(p.n1, 1, Number.MAX_SAFE_INTEGER) && typeof p.n2 === 'number';
      if (p.mode === 'ONE') return isInt(p.n1, 1, Number.MAX_SAFE_INTEGER) && typeof p.hourNo === 'number';
      return false;
    case 'CHARACTER':
      return (
        isIn(p.mode, ['ONE', 'TWO'] as const) &&
        Array.isArray(v.chars) &&
        v.chars.every((c) => typeof c === 'string' && c.length > 0) &&
        Array.isArray(v.strokes) &&
        v.strokes.every((s) => typeof s === 'number') &&
        // 字数与笔画数必须一一对应：不等长时 castContext 会渲染出「undefined 画」
        v.chars.length === v.strokes.length &&
        isIn(v.standard, STANDARDS) &&
        (p.mode === 'ONE' ? typeof p.hourNo === 'number' : isInt(p.second, 0, 59))
      );
    default:
      // RANDOM：params 就是上 / 下 / 动三数，已由 isCommon 覆盖
      return isCommon(p);
  }
}

function parsePayload(data: unknown): SharedCast | null {
  if (!isRecord(data)) return null;
  if (data.v !== PAYLOAD_VERSION) return null;
  if (!isCastResult(data.c)) return null;
  if (!isIn(data.r, RULES)) return null;
  const at = data.t;
  if (typeof at !== 'number' || !Number.isFinite(at) || at <= 0) return null;
  return { cast: data.c, tiYongRule: data.r, castAt: at };
}

/* ---------- 对外接口 ---------- */

/** 卦例 → 分享参数值（`#/result?c=<此值>` 的右半截） */
export function encodeSharedCast(cast: CastResult, tiYongRule: TiYongRule, castAt: number): string {
  return toBase64Url(JSON.stringify({ v: PAYLOAD_VERSION, c: cast, r: tiYongRule, t: castAt }));
}

/** 分享参数值 → 卦例；任何不合法（空 / 截断 / 篡改 / 旧版本）都返回 null */
export function decodeSharedCast(raw: string | null | undefined): SharedCast | null {
  if (!raw) return null;
  const json = fromBase64Url(raw);
  if (!json) return null;
  try {
    return parsePayload(JSON.parse(json));
  } catch {
    return null;
  }
}

/** 可导航的分享路径（不含 `#`）：`/result?c=…` */
export function sharedResultPath(
  cast: CastResult,
  tiYongRule: TiYongRule,
  castAt: number,
): string {
  return `/result?${SHARE_PARAM}=${encodeSharedCast(cast, tiYongRule, castAt)}`;
}

/**
 * 把某个绝对地址的 hash 换成排盘分享路径。
 *
 * base 通常来自 `shareTarget()`——它负责把本机 localhost 换成局域网地址
 * （手机上扫/点才打得开）。这里只换 hash，path / query / 部署子目录都保留。
 */
export function withSharedCast(
  base: string,
  cast: CastResult,
  tiYongRule: TiYongRule,
  castAt: number,
): string {
  return `${base.replace(/#.*$/, '')}#${sharedResultPath(cast, tiYongRule, castAt)}`;
}
