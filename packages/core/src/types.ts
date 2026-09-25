/* ============================================================
 * 类型定义 —— 起卦结果、卦象推导结果、生克判定结果
 * 与 03 文档 §四（JudgeResult）、§五（参考实现骨架）、04 文档 §2.4（inputParams）对齐
 * ============================================================ */

import type { Element, Hexagram, StrokeStandard, TrigramNumber } from '@plumora/knowledge';

/** 起卦方式（04 文档 §2.2 method 字段取值） */
export type CastMethod = 'TIME' | 'NUMBER' | 'CHARACTER' | 'SOUND' | 'RANDOM';

/** 体用判定流派（03 文档 §3.6） */
export type TiYongRule =
  /** 通行规则（默认）：动爻所在之卦为用卦，另一卦为体卦 */
  | 'MOVING_LINE'
  /** 手写笔记流派：不问动爻位置，上卦恒为用、下卦恒为体 */
  | 'UPPER_YONG_LOWER_TI';

/** 生克关系（04 文档 §2.2 relation 字段取值） */
export type Relation =
  | 'YONG_SHENG_TI'
  | 'TI_SHENG_YONG'
  | 'TI_KE_YONG'
  | 'YONG_KE_TI'
  | 'BI_HE';

/** 吉凶程度分级（03 文档 §1.3 手写笔记口径） */
export type FortuneDegree = 'DA_JI' | 'XIAO_JI' | 'JI' | 'XIAO_XIONG' | 'DA_XIONG';

export const RELATION_CN: Readonly<Record<Relation, string>> = {
  YONG_SHENG_TI: '用生体',
  TI_SHENG_YONG: '体生用',
  TI_KE_YONG: '体克用',
  YONG_KE_TI: '用克体',
  BI_HE: '体用比和',
};

export const DEGREE_CN: Readonly<Record<FortuneDegree, string>> = {
  DA_JI: '大吉',
  XIAO_JI: '小吉',
  JI: '吉',
  XIAO_XIONG: '小凶',
  DA_XIONG: '大凶',
};

export const METHOD_CN: Readonly<Record<CastMethod, string>> = {
  TIME: '时间起卦',
  NUMBER: '数字起卦',
  CHARACTER: '汉字起卦',
  SOUND: '声音起卦',
  RANDOM: '随机起卦',
};

/* ---------- 起卦输入参数（中间量，供结果页「起卦上下文」复现） ---------- */

export interface TimeCastParams {
  readonly yearBranchNo: number;
  readonly lunarMonth: number;
  readonly lunarDay: number;
  readonly hourNo: number;
  /** S1 = 年支 + 月 + 日 */
  readonly s1: number;
  /** S2 = S1 + 时 */
  readonly s2: number;
  /** 是否为晚子时（23:00 后按次日计） */
  readonly shifted: boolean;
}

export interface NumberCastParams {
  readonly mode: 'ONE' | 'TWO';
  readonly n1: number;
  readonly n2?: number;
  readonly hourNo?: number;
  readonly sum?: number;
}

export interface CharacterCastParams {
  readonly mode: 'ONE' | 'TWO';
  readonly strokes: readonly number[];
  /** 两字模式的起卦秒钟数（0–59）；一字模式不参与计算（03 文档 §6.5） */
  readonly second?: number;
  readonly hourNo?: number;
  readonly sum?: number;
}

export interface SoundCastParams {
  readonly count1: number;
  readonly count2: number;
  readonly sum: number;
}

export interface RandomCastParams {
  readonly upper: number;
  readonly lower: number;
  readonly moving: number;
}

/* ---------- 起卦结果 ---------- */

interface CastCommon {
  readonly upper: TrigramNumber;
  readonly lower: TrigramNumber;
  /** 动爻 1–6（1 = 初爻） */
  readonly moving: number;
}

export interface TimeCast extends CastCommon {
  readonly method: 'TIME';
  /** 农历标签：丙午年 八月十五 午时 */
  readonly label: string;
  readonly params: TimeCastParams;
}

export interface NumberCast extends CastCommon {
  readonly method: 'NUMBER';
  readonly params: NumberCastParams;
}

export interface CharacterCast extends CastCommon {
  readonly method: 'CHARACTER';
  readonly chars: readonly string[];
  readonly strokes: readonly number[];
  readonly standard: StrokeStandard;
  readonly params: CharacterCastParams;
}

export interface SoundCast extends CastCommon {
  readonly method: 'SOUND';
  readonly params: SoundCastParams;
}

export interface RandomCast extends CastCommon {
  readonly method: 'RANDOM';
  readonly params: RandomCastParams;
}

export type CastResult = TimeCast | NumberCast | CharacterCast | SoundCast | RandomCast;

/* ---------- 04 文档 §2.4 的 inputParams JSON 形态 ---------- */

export type InputParams =
  | {
      type: 'TIME';
      yearBranchNo: number;
      lunarMonth: number;
      lunarDay: number;
      hourNo: number;
      /**
       * 是否晚子时（23:00 后按次日计，03 §6.2）。
       * 必存：晚子时与「次日 00:30」的四个数值完全相同，不存此标记则详情页
       * 无法说明该卦是按次日算的（C-8）。
       * 兼容历史数据：旧记录无此字段，读取时按 `false` 处理。
       */
      shifted?: boolean;
    }
  | { type: 'NUMBER'; mode: 'TWO'; n1: number; n2: number }
  | { type: 'NUMBER'; mode: 'ONE'; n1: number; hourNo: number }
  | {
      type: 'CHARACTER';
      mode: 'TWO';
      chars: string[];
      strokes: number[];
      standard: StrokeStandard;
      second: number;
    }
  | {
      type: 'CHARACTER';
      mode: 'ONE';
      chars: string[];
      strokes: number[];
      standard: StrokeStandard;
      hourNo: number;
    }
  | { type: 'SOUND'; count1: number; count2: number }
  | { type: 'RANDOM'; upper: number; lower: number; moving: number };

/* ---------- 生克判定结果（03 文档 §四 JudgeResult） ---------- */

export interface JudgeResult {
  readonly relation: Relation;
  readonly degree: FortuneDegree;
  /** 程度中文：大吉 / 小吉 / 吉 / 小凶 / 大凶 */
  readonly degreeCn: string;
  /** 传统断法文案：如「小凶，耗损精力」 */
  readonly traditional: string;
  /** 合并表述：如「体生用：小凶，耗损精力」 */
  readonly summary: string;
  readonly tiElement: Element;
  readonly yongElement: Element;
}

/* ---------- 卦象推导结果 ---------- */

export interface ResolvedHexagram {
  /** 本卦六爻，**自下而上**（index 0 = 初爻） */
  readonly lines: readonly number[];
  /** 变卦六爻，自下而上 */
  readonly changedLines: readonly number[];
  readonly upper: TrigramNumber;
  readonly lower: TrigramNumber;
  readonly moving: number;
  /** 动爻爻名：初六 / 九二 / 上六 */
  readonly movingLineName: string;
  readonly ben: Hexagram;
  readonly hu: Hexagram;
  readonly bian: Hexagram;
  readonly ti: TrigramNumber;
  readonly yong: TrigramNumber;
  readonly tiYongRule: TiYongRule;
  readonly judge: JudgeResult;
}
