/* ============================================================
 * 排盘文本 —— 「复制排盘」按钮与分享共用的纯文本渲染
 *
 * 为什么单独抽出来：结果页（ResultView）与卦例详情页（RecordDetailView）
 * 都要「复制排盘」，两处若各抄一份，措辞迟早漂移（一处改了体用、另一处忘了）。
 * 这里做**唯一定义点**，两端共用同一段文本。
 *
 * 纯函数、无副作用：便于单测，也可在将来 Android 端复用同结构。
 * ============================================================ */

import { methodCn, type ResolvedHexagram } from '@plumora/core';
import { TRIGRAMS } from '@plumora/knowledge';

export interface CastTextInput {
  readonly resolved: ResolvedHexagram;
  /** 起卦方式（旧记录可能是已下线的方式，走 methodCn 容错） */
  readonly method: string;
  /** 农历标签，如「丙午年 八月十五 午时」 */
  readonly lunarLabel: string;
}

/** 由推导结果拼出可复制的排盘纯文本 */
export function buildCastText({ resolved: r, method, lunarLabel }: CastTextInput): string {
  return [
    '【观梅 · Plumora 排盘】',
    lunarLabel,
    methodCn(method),
    `本卦：${r.ben.name}（${TRIGRAMS[r.upper].name}上${TRIGRAMS[r.lower].name}下）动爻 ${r.movingLineName}`,
    `互卦：${r.hu.name}　变卦：${r.bian.name}`,
    `体：${TRIGRAMS[r.ti].name}　用：${TRIGRAMS[r.yong].name}`,
    r.judge.summary,
    `本卦卦意：${r.ben.keywords.join('、')}`,
    '仅供传统文化学习研究使用',
  ]
    .filter(Boolean)
    .join('\n');
}
