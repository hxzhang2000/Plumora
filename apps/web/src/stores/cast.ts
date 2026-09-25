/* 当前排盘结果 —— 起卦后暂存，结果页与刷新都读它
 *
 * 只持久化「起卦输入 + 生效流派」，重新推导结果；
 * 这样知识库数据更新后，历史会话的渲染也会同步到最新口径。
 */

import { ref } from 'vue';
import { castContext, resolve, type CastResult, type ResolvedHexagram, type TiYongRule } from '@plumora/core';
import { lunarLabelOf } from '@plumora/lunar';

const KEY = 'plumora.current-cast.v1';

export interface PendingCast {
  readonly cast: CastResult;
  readonly resolved: ResolvedHexagram;
  /** 结果页顶部「起卦上下文」文案 */
  readonly context: string;
  /** 农历标签（非时间起卦取当前时刻农历） */
  readonly lunarLabel: string;
  readonly castAt: number;
  readonly tiYongRule: TiYongRule;
}

interface PersistedShape {
  cast: CastResult;
  tiYongRule: TiYongRule;
  castAt: number;
}

const current = ref<PendingCast | null>(null);

function restore(): void {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as PersistedShape;
    current.value = materialize(p.cast, p.tiYongRule, p.castAt);
  } catch {
    current.value = null;
  }
}

function materialize(cast: CastResult, tiYongRule: TiYongRule, castAt: number): PendingCast {
  return {
    cast,
    resolved: resolve(cast.upper, cast.lower, cast.moving, tiYongRule),
    context: castContext(cast),
    lunarLabel: cast.method === 'TIME' ? cast.label : lunarLabelOf(new Date(castAt)),
    castAt,
    tiYongRule,
  };
}

export function useCurrentCast() {
  return current;
}

/** 起卦完成 → 暂存并持久化 */
export function setCurrentCast(cast: CastResult, tiYongRule: TiYongRule): PendingCast {
  const castAt = Date.now();
  const pending = materialize(cast, tiYongRule, castAt);
  current.value = pending;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ cast, tiYongRule, castAt } satisfies PersistedShape));
  } catch {
    /* 忽略配额问题 */
  }
  return pending;
}

export function clearCurrentCast(): void {
  current.value = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

restore();
