/* ============================================================
 * 五行生克判定 —— 对应 03 文档 §1.3、§四
 *
 * 程度分级（手写笔记口径）：
 *   用生体 → 大吉；体克用 → 小吉；体用比和 → 吉；体生用 → 小凶；用克体 → 大凶
 * ============================================================ */

import { ELEMENT_CN, type Element, type Trigram } from '@plumora/knowledge';
import {
  DEGREE_CN,
  RELATION_CN,
  type FortuneDegree,
  type JudgeResult,
  type Relation,
} from './types.js';

/** 五行相生环：木 → 火 → 土 → 金 → 水 → 木 */
const GENERATION_CYCLE: readonly Element[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

/** 五行相克：木克土、土克水、水克火、火克金、金克木 */
const OVERCOMING: Readonly<Record<Element, Element>> = {
  WOOD: 'EARTH',
  EARTH: 'WATER',
  WATER: 'FIRE',
  FIRE: 'METAL',
  METAL: 'WOOD',
};

/** a 是否生 b */
export function generates(a: Element, b: Element): boolean {
  return GENERATION_CYCLE[(GENERATION_CYCLE.indexOf(a) + 1) % 5] === b;
}

/** a 是否克 b */
export function overcomes(a: Element, b: Element): boolean {
  return OVERCOMING[a] === b;
}

/** 传统断法文案（03 文档 §1.3「传统断法」列） */
const TRADITIONAL: Readonly<Record<Relation, string>> = {
  YONG_SHENG_TI: '吉，有外力帮助',
  TI_KE_YONG: '吉，能掌控局面',
  BI_HE: '吉，顺利和谐',
  TI_SHENG_YONG: '小凶，耗损精力',
  YONG_KE_TI: '凶，受制于人',
};

/** 关系 → 程度分级（固定映射，03 文档 §四） */
const DEGREE_OF: Readonly<Record<Relation, FortuneDegree>> = {
  YONG_SHENG_TI: 'DA_JI',
  TI_KE_YONG: 'XIAO_JI',
  BI_HE: 'JI',
  TI_SHENG_YONG: 'XIAO_XIONG',
  YONG_KE_TI: 'DA_XIONG',
};

/**
 * 体用五行生克判定（核心）。
 * 比和（五行相同）优先判定（03 文档 §四）。
 */
export function judgeElements(tiElement: Element, yongElement: Element): JudgeResult {
  let relation: Relation;
  if (tiElement === yongElement) relation = 'BI_HE';
  else if (generates(yongElement, tiElement)) relation = 'YONG_SHENG_TI';
  else if (generates(tiElement, yongElement)) relation = 'TI_SHENG_YONG';
  else if (overcomes(tiElement, yongElement)) relation = 'TI_KE_YONG';
  else relation = 'YONG_KE_TI';

  const degree = DEGREE_OF[relation];
  const traditional = TRADITIONAL[relation];

  return {
    relation,
    degree,
    degreeCn: DEGREE_CN[degree],
    traditional,
    summary: `${RELATION_CN[relation]}：${traditional}`,
    tiElement,
    yongElement,
  };
}

/** 体卦、用卦 → 生克判定 */
export function judge(ti: Trigram, yong: Trigram): JudgeResult {
  return judgeElements(ti.element, yong.element);
}

/** 全 25 组合穷举（07 文档 TC-F06） */
export function judgeMatrix(): {
  tiElement: Element;
  yongElement: Element;
  relation: Relation;
  degree: FortuneDegree;
}[] {
  const out: {
    tiElement: Element;
    yongElement: Element;
    relation: Relation;
    degree: FortuneDegree;
  }[] = [];
  for (const a of GENERATION_CYCLE) {
    for (const b of GENERATION_CYCLE) {
      const r = judgeElements(a, b);
      out.push({ tiElement: a, yongElement: b, relation: r.relation, degree: r.degree });
    }
  }
  return out;
}

/** 五行中文名 */
export function elementCn(e: Element): string {
  return ELEMENT_CN[e];
}
