/* 当前排盘结果 —— 起卦后暂存，结果页与刷新都读它
 *
 * 只持久化「起卦输入 + 生效流派」，重新推导结果；
 * 这样知识库数据更新后，历史会话的渲染也会同步到最新口径。
 *
 * ⚠️ 推导（resolve）为什么是异步的：
 *   卦象推导要用六十四卦全表 + 卦辞爻辞（gzip 约 48KB），而首屏（起卦页）
 *   一个字都用不到它。静态 import 会让每个用户冷启动就下载这 48KB。
 *   所以这里把 resolve 走动态 import（@plumora/core/resolve），
 *   由 ensureResolved() 在「起卦后 / 结果页挂载时」触发。
 *   起卦时立刻预热一次，拉取与结果页 chunk 并行，正常看不到等待。
 */

import { ref, shallowRef } from 'vue';
import { castContext, type CastResult, type ResolvedHexagram, type TiYongRule } from '@plumora/core';
import { lunarLabelOf } from '@plumora/lunar';
import { decodeSharedCast } from '@/platform/shareLink';

const KEY = 'plumora.current-cast.v1';

export interface PendingCast {
  readonly cast: CastResult;
  /** 结果页顶部「起卦上下文」文案 */
  readonly context: string;
  /** 农历标签（非时间起卦取当前时刻农历） */
  readonly lunarLabel: string;
  readonly castAt: number;
  readonly tiYongRule: TiYongRule;
  /** 起卦前用户填写的「所问之事」（可为空串） */
  readonly question: string;
}

interface PersistedShape {
  cast: CastResult;
  tiYongRule: TiYongRule;
  castAt: number;
  question: string;
}

const current = ref<PendingCast | null>(null);

/** 推导结果（异步填充）。与 current 分开存放：current 是纯数据、可持久化，推导结果是派生物 */
const resolved = shallowRef<ResolvedHexagram | null>(null);
/** 已推导的「对象身份」标记：每次起卦 current 都是新对象，据此判断缓存是否还有效 */
let resolvedFor: PendingCast | null = null;
let inflight: Promise<ResolvedHexagram | null> | null = null;

function restore(): void {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as PersistedShape;
    current.value = materialize(p.cast, p.tiYongRule, p.castAt, p.question ?? '');
  } catch {
    current.value = null;
  }
}

function materialize(
  cast: CastResult,
  tiYongRule: TiYongRule,
  castAt: number,
  question: string,
): PendingCast {
  return {
    cast,
    context: castContext(cast),
    lunarLabel: cast.method === 'TIME' ? cast.label : lunarLabelOf(new Date(castAt)),
    castAt,
    tiYongRule,
    question,
  };
}

export function useCurrentCast() {
  return current;
}

/** 推导结果（未就绪时为 null —— 结果页据此显示占位） */
export function useResolvedCast() {
  return resolved;
}

/**
 * 确保当前卦例已推导。同一卦例重复调用共用一次推导；
 * 起卦时预热、结果页挂载时兜底（刷新/深链进来时预热还没发生）。
 *
 * 失败（离线且未缓存）返回 null：结果页停在占位态，不误报一个空卦。
 */
export function ensureResolved(): Promise<ResolvedHexagram | null> {
  const p = current.value;
  if (!p) {
    resolved.value = null;
    resolvedFor = null;
    inflight = null;
    return Promise.resolve(null);
  }
  if (resolvedFor === p && resolved.value) return Promise.resolve(resolved.value);
  if (resolvedFor !== p) {
    resolvedFor = p;
    inflight = import('@plumora/core/resolve')
      .then((m) => {
        // 期间又起了一卦：这次推导作废（新卦会自己发起一次）
        if (current.value !== p) return null;
        const r = m.resolve(p.cast.upper, p.cast.lower, p.cast.moving, p.tiYongRule);
        resolved.value = r;
        return r;
      })
      .catch(() => null);
  }
  return inflight ?? Promise.resolve(null);
}

export function clearCurrentCast(): void {
  current.value = null;
  resolved.value = null;
  resolvedFor = null;
  inflight = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/**
 * 接管一个卦例：置为当前、作废旧推导、预热、持久化。
 * 「新起一卦」与「打开分享链接」共用同一条路径，两边不会各自走样。
 */
function adopt(pending: PendingCast): PendingCast {
  current.value = pending;
  // 新卦：旧的推导结果与在途请求一并作废
  resolved.value = null;
  resolvedFor = null;
  inflight = null;
  // 立刻预热推导（与结果页 chunk 并行加载），避免结果页出现「推导中」空窗
  void ensureResolved();
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        cast: pending.cast,
        tiYongRule: pending.tiYongRule,
        castAt: pending.castAt,
        question: pending.question,
      } satisfies PersistedShape),
    );
  } catch {
    /* 忽略配额问题 */
  }
  return pending;
}

/** 起卦完成 → 暂存并持久化（question 为起卦前填写的「所问之事」） */
export function setCurrentCast(cast: CastResult, tiYongRule: TiYongRule, question = ''): PendingCast {
  return adopt(materialize(cast, tiYongRule, Date.now(), question.trim()));
}

/**
 * 采纳 URL 上的分享参数（`#/result?c=…`，编码见 platform/shareLink）。
 *
 * 何时不动：
 *   - 参数缺失 / 不合法（截断、被改、旧版本）→ 保持现状，让结果页走它原本的兜底。
 *   - 与当前卦例是同一盘（`castAt` 逐毫秒相同）→ 保持现状。刷新自己的结果页就是
 *     这种情况：本机 sessionStorage 里存着更完整的状态（含「所问之事」，而链接
 *     刻意不带它），不该被链接里的精简版覆盖掉。
 *
 * 何时接管：其余情况一律以链接为准 —— 点开别人的链接，期望看到的就是那一盘，
 * 而不是自己上次起的那一卦。
 *
 * @returns 是否真的接管了
 */
export function adoptSharedCast(raw: string | null | undefined): boolean {
  const shared = decodeSharedCast(raw);
  if (!shared) return false;
  if (current.value?.castAt === shared.castAt) return false;
  // 链接不含所问之事（隐私），恢复出来的这一盘 question 恒为空串
  adopt(materialize(shared.cast, shared.tiYongRule, shared.castAt, ''));
  return true;
}

restore();
