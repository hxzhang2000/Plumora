/* ============================================================
 * 卦例记录领域模型 —— 对应 04 文档 §2.2 HexagramRecord 实体
 *
 * 放在 core（领域层）而非 Web 端：这是「起卦结果 → 持久化记录」的
 * 共享业务契约，Android 端建 Room 实体时字段一一对应，避免两端各写一份。
 *
 * 与 04 文档的差异（已在文档中登记）：
 *   tiYongRule —— 04 §2.2 未列该列。但记录只存 tiTrigram/yongTrigram，
 *   若不存流派，卦例详情无法说明「该体用是按哪个口径算的」。
 *   故本实现增加该字段，并同步登记到 04 文档 §2.2。
 * ============================================================ */

import { trigram } from '@plumora/knowledge';
import { judge } from './judge.js';
import { assertTrigramNumber } from './modulus.js';
import { resolve } from './resolve.js';
import { inputParamsOf } from './casters.js';
import { METHOD_CN } from './types.js';
import type { CastResult, ResolvedHexagram, TiYongRule } from './types.js';

/** 应验状态四态（01 FR-07 / 04 §2.2） */
export type VerifyStatus = 'UNVERIFIED' | 'VERIFIED' | 'PENDING' | 'INVALID';

export const VERIFY_STATUS_CN: Readonly<Record<VerifyStatus, string>> = {
  UNVERIFIED: '未验',
  VERIFIED: '应验',
  PENDING: '未验中',
  INVALID: '不验',
};

export const VERIFY_STATUS_LIST: readonly VerifyStatus[] = [
  'UNVERIFIED',
  'VERIFIED',
  'PENDING',
  'INVALID',
];

/** 卦例记录（与 04 §2.2 字段表一一对应） */
export interface HexagramRecord {
  /** 自增主键 */
  id: number;
  /** 起卦时间 epoch millis */
  createdAt: number;
  /** 最近编辑时间 epoch millis */
  updatedAt: number;
  /** 起卦方式 */
  method: CastResult['method'];
  /** 输入参数 JSON 字符串（04 §2.4 结构） */
  inputParams: string;
  /** 农历标签，如「丙午年 八月十五 午时」；非时间起卦存当前时刻农历 */
  lunarLabel: string;
  /** 上卦先天数 1–8 */
  upperTrigram: number;
  /** 下卦先天数 1–8 */
  lowerTrigram: number;
  /** 动爻 1–6 */
  movingLine: number;
  /** 本卦代码 `上卦数-下卦数` */
  benGuaCode: string;
  /** 本卦卦名（冗余列，便于关键字搜索） */
  benGuaName: string;
  huGuaCode: string;
  bianGuaCode: string;
  /** 体卦先天数（按起卦时的流派判定后落库） */
  tiTrigram: number;
  /** 用卦先天数 */
  yongTrigram: number;
  /** 起卦时生效的体用判定流派（见文件头说明） */
  tiYongRule: TiYongRule;
  /** 体用关系 */
  relation: ResolvedHexagram['judge']['relation'];
  /** 所问之事，≤200 字 */
  question: string | null;
  /** 备注 */
  note: string | null;
  /** 应验状态 */
  verifyStatus: VerifyStatus;
}

/** 新建记录（id 由存储层分配） */
export type NewHexagramRecord = Omit<HexagramRecord, 'id'>;

export interface BuildRecordInput {
  readonly cast: CastResult;
  readonly resolved: ResolvedHexagram;
  /** 农历标签；时间起卦用 cast.label，其余用当前时刻农历 */
  readonly lunarLabel: string;
  /** 默认取当前时间 */
  readonly now?: number;
}

/** 由「起卦结果 + 推导结果」组装一条可落库的记录 */
export function buildRecord(input: BuildRecordInput): NewHexagramRecord {
  const { cast, resolved: r, lunarLabel } = input;
  const now = input.now ?? Date.now();
  return {
    createdAt: now,
    updatedAt: now,
    method: cast.method,
    inputParams: JSON.stringify(inputParamsOf(cast)),
    lunarLabel: lunarLabel || '—',
    upperTrigram: r.upper,
    lowerTrigram: r.lower,
    movingLine: r.moving,
    benGuaCode: r.ben.code,
    benGuaName: r.ben.name,
    huGuaCode: r.hu.code,
    bianGuaCode: r.bian.code,
    tiTrigram: r.ti,
    yongTrigram: r.yong,
    tiYongRule: r.tiYongRule,
    relation: r.judge.relation,
    question: null,
    note: null,
    verifyStatus: 'UNVERIFIED',
  };
}

/** 卦名与所问之事都缺失时的最后兜底名称（正常数据不会走到这里） */
export const RECORD_TITLE_FALLBACK = '未命名卦例';

/**
 * 卦例的「名称」——列表主标题 / 详情页标题 / 删除确认文案统一取此值。
 *
 * 优先级（用户口径：**名称优先用占卜的目标，没有目标再用其他名称代替**）：
 *   ① `question`（所问之事，即占卜目标，用户填写）
 *   ② `benGuaName`（本卦卦名，如「水风井」）—— 冗余列，正常数据必有值
 *   ③ `起卦方式 · 农历标签`（卦名也缺失时的兜底，避免出现空白标题）
 *   ④ {@link RECORD_TITLE_FALLBACK}（数据整体异常时的最后兜底）
 *
 * 刻意**不落库**：名称是 `question` / `benGuaName` 的派生值。若存成列，用户在详情页
 * 改完「所问之事」后名称就会与被改的字段脱钩，还得靠迁移修数据（04 §2.6 禁止
 * destructive migration）。派生值天然与字段同步，两端（Web / Android）也只维护一份规则。
 *
 * 纯函数，无副作用：可直接用于模板渲染与单元测试。
 */
export function recordTitle(
  rec: Pick<HexagramRecord, 'question' | 'benGuaName' | 'method' | 'lunarLabel'>,
): string {
  const question = (rec.question ?? '').trim();
  if (question) return question;

  const guaName = (rec.benGuaName ?? '').trim();
  if (guaName) return guaName;

  // 直查 METHOD_CN 而非 methodCn()：已下线的方式（如声音起卦）在旧记录里仍有值，
  // 这里**不给片段**（undefined 被 filter 掉），让名称继续回退到卦名 / 固定兜底串，
  // 而不是把「其他方式」写进派生名称。界面上的方式标签另走 methodCn() 容错。
  const parts = [METHOD_CN[rec.method], (rec.lunarLabel ?? '').trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : RECORD_TITLE_FALLBACK;
}

/**
 * 卦例回放：由记录重建推导结果。
 *
 * 关键点：**体用取自记录落库的 tiTrigram/yongTrigram**，而不是按当前设置重算——
 * 否则用户切换「体用判定流派」后，历史卦例的体用会被悄悄改写（04 §2.2 正是为此存了这两个字段）。
 *
 * 落库字段一律经显式校验：脏数据（如 `tiTrigram: 0`）应在这里以「体卦先天数非法：0」
 * 响亮失败，而不是在下游 `TRIGRAMS[0].element` 处以 TypeError 崩溃。
 */
export function replayRecord(rec: HexagramRecord): ResolvedHexagram {
  const ti = assertTrigramNumber(rec.tiTrigram, '体卦先天数');
  const yong = assertTrigramNumber(rec.yongTrigram, '用卦先天数');
  const base = resolve(
    assertTrigramNumber(rec.upperTrigram, '上卦先天数'),
    assertTrigramNumber(rec.lowerTrigram, '下卦先天数'),
    rec.movingLine,
    rec.tiYongRule,
  );
  return {
    ...base,
    ti,
    yong,
    judge: judge(trigram(ti), trigram(yong)),
  };
}
