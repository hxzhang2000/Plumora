/* ============================================================
 * 六十四卦数据 —— 对应 docs/dev/05-卦象知识库设计.md v1.4 §3.1–§3.5
 *
 * 卦代码口径（04 文档 §2.5）：`上卦数-下卦数`，**两段各固定两位、不足补零**，
 * 如「06-05」= 坎上巽下 = 水风井。固定宽度便于作为索引键按字典序等同数值序排列，
 * 也与 04 §2.2 字段表、05 §3.1 schema 的示例逐字一致。
 * 先天数稳定，不依赖文字编码。
 * ============================================================ */

import { TRIGRAMS, type TrigramNumber, trigramLines } from './trigrams.js';

/** 卦代码：`上卦数-下卦数`，两段各两位（如 `06-05`） */
export type HexCode = string;

/** 先天数 → 两位代码段（1 → `01`，8 → `08`） */
function codePart(n: TrigramNumber): string {
  return String(n).padStart(2, '0');
}

/**
 * 由上下卦先天数生成规范卦代码。
 * 这是全仓**唯一**的代码生成点，避免各处各拼一份导致口径漂移。
 */
export function hexCodeOf(upper: TrigramNumber, lower: TrigramNumber): HexCode {
  return `${codePart(upper)}-${codePart(lower)}`;
}

/**
 * 归一化外部传入的卦代码：兼容历史/手写的非补零写法（`6-5` → `06-05`），
 * 非法形态原样返回（由调用方判空）。
 */
export function normalizeHexCode(code: string): HexCode {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(code.trim());
  if (!m) return code;
  const u = Number(m[1]);
  const l = Number(m[2]);
  if (u < 1 || u > 8 || l < 1 || l > 8) return code;
  return hexCodeOf(u as TrigramNumber, l as TrigramNumber);
}

export interface HexagramLine {
  /** 1–6，1 = 初爻 */
  readonly index: number;
  /** 爻名：初六 / 九二 / 上六 */
  readonly name: string;
  /** 爻辞原文 */
  readonly text: string;
}

export interface Hexagram {
  readonly code: HexCode;
  readonly upper: TrigramNumber;
  readonly lower: TrigramNumber;
  /** 卦名：水风井 */
  readonly name: string;
  /** 简称：井（用于 8×8 速查格；重卦取首字，如「乾为天」→「乾」） */
  readonly shortName: string;
  /** 六爻位编码（下爻 bit0）：`lower.binary | upper.binary << 3`，水风井 = 22 */
  readonly binary: number;
  /** 卦意关键词（手写笔记人工校对口径，1–5 条），见 05 文档 §3.5 */
  readonly keywords: readonly string[];
  /**
   * 卦辞全文（含「XX：」前缀）。
   * ⚠️ M1 待录入项（05 文档 §3.3）：需按《周易》通行本录入并两轮人工校对，
   *    未校对前保持 null，UI 显示「录入中」占位，**不得臆造文本**。
   */
  readonly guaci: string | null;
  /** 六爻爻辞，恒为 6 条或 null（同上，M1 待录入） */
  readonly lines: readonly HexagramLine[] | null;
  /** 仅乾（用九）、坤（用六）有值，其余为 null（05 文档 §3.1） */
  readonly yongText: string | null;
}

/**
 * 卦意关键词原始表（05 文档 §3.5 完整词表，录入基准）。
 * 键为卦代码，值为 [卦名, 关键词串（、分隔）]。
 */
const RAW: Readonly<Record<HexCode, readonly [string, string]>> = {
  '01-01': ['乾为天', '刚健、为天、为君主'], '01-02': ['天泽履', '履行、践行、礼貌、礼节'], '01-03': ['天火同人', '同行、同我一起、集结一起'], '01-04': ['天雷无妄', '不要妄想、不要妄念'], '01-05': ['天风姤', '相遇、邂逅、遇见'], '01-06': ['天水讼', '争斗、争讼、官非'], '01-07': ['天山遁', '遁走、潜藏、退走、消退'], '01-08': ['天地否', '不通、阻隔、闭塞'],
  '02-01': ['泽天夬', '决断、决策、奇怪'], '02-02': ['兑为泽', '喜悦、取悦、口舌'], '02-03': ['泽火革', '变革、改变'], '02-04': ['泽雷随', '跟从、跟随'], '02-05': ['泽风大过', '大的过分、过度、过错、不一般的行动'], '02-06': ['泽水困', '穷困、困境、困难'], '02-07': ['泽山咸', '威即感、感应、感情、夫妇之道'], '02-08': ['泽地萃', '聚集、汇聚、提炼'],
  '03-01': ['火天大有', '收获很大、收益很多'], '03-02': ['火泽睽', '睽违、离开、争吵'], '03-03': ['离为火', '明丽、美丽、依附'], '03-04': ['火雷噬嗑', '咬住、咬合、刑罚、刑狱'], '03-05': ['火风鼎', '饮食、蓄养贤人、烹制、制衡'], '03-06': ['火水未济', '未完成、未成功'], '03-07': ['火山旅', '旅行、不安定、路途'], '03-08': ['火地晋', '晋升、前进'],
  '04-01': ['雷天大壮', '极为强壮、力量强大'], '04-02': ['雷泽归妹', '婚嫁、出嫁'], '04-03': ['雷火丰', '丰盛、盛大、丰富'], '04-04': ['震为雷', '震动、威惧、震慑'], '04-05': ['雷风恒', '恒久、恒常、长久'], '04-06': ['雷水解', '解脱、解开、化解'], '04-07': ['雷山小过', '小的过错或过度、稍有越过限度'], '04-08': ['雷地豫', '喜悦、安乐、不豫之色'],
  '05-01': ['风天小畜', '小的积累、小的成就'], '05-02': ['风泽中孚', '诚信、朴实、踏实'], '05-03': ['风火家人', '家庭伦理、家庭关系'], '05-04': ['风雷益', '受益、增多'], '05-05': ['巽为风', '进入、风吹、谦逊'], '05-06': ['风水涣', '涣散、离散、分散'], '05-07': ['风山渐', '渐进、逐步'], '05-08': ['风地观', '观看、展示、展览'],
  '06-01': ['水天需', '需求、等待、期许、饮食、供养'], '06-02': ['水泽节', '节制、控制、把控、节约'], '06-03': ['水火既济', '已经完成'], '06-04': ['水雷屯', '屯积、积累、萌芽、初创艰难'], '06-05': ['水风井', '水牛、贤德'], '06-06': ['坎为水', '陷落、坑坎、危险'], '06-07': ['水山蹇', '跛脚、困难、艰难险阻'], '06-08': ['水地比', '相近、亲附'],
  '07-01': ['山天大畜', '大的积累、大的积蓄'], '07-02': ['山泽损', '损失、减少、受损'], '07-03': ['山火贲', '装饰、修饰、文饰'], '07-04': ['山雷颐', '颐养、休养、食物、安乐'], '07-05': ['山风蛊', '蛊惑、腐败、混乱'], '07-06': ['山水蒙', '启蒙、启发、教育'], '07-07': ['艮为山', '停止、终止'], '07-08': ['山地剥', '下落、剥落、衰落'],
  '08-01': ['地天泰', '亨通、安泰、通达'], '08-02': ['地泽临', '靠近、临变'], '08-03': ['地火明夷', '受伤、韬光养晦'], '08-04': ['地雷复', '恢复、归复、回归'], '08-05': ['地风升', '上升、发达、升起'], '08-06': ['地水师', '军队、众人'], '08-07': ['地山谦', '谦虚、谦逊'], '08-08': ['坤为地', '柔顺、柔和、包容、为地、为臣民'],
};

/** 重卦（乾为天…坤为地）取首字；其余取卦名第 3 字起（去掉「上卦字+下卦字」前缀） */
function shortNameOf(name: string): string {
  const pure = /^(\S)为(\S)$/.exec(name);
  return pure ? pure[1] : name.slice(2);
}

function build(code: HexCode): Hexagram {
  const [u, l] = code.split('-').map(Number) as [TrigramNumber, TrigramNumber];
  const [name, kw] = RAW[code];
  const binary = TRIGRAMS[l].binary | (TRIGRAMS[u].binary << 3);
  return Object.freeze({
    code,
    upper: u,
    lower: l,
    name,
    shortName: shortNameOf(name),
    binary,
    keywords: Object.freeze(kw.split('、')),
    guaci: null,
    lines: null,
    yongText: null,
  });
}

/** 六十四卦全表，键为卦代码 */
export const HEXAGRAMS: Readonly<Record<HexCode, Hexagram>> = Object.freeze(
  Object.fromEntries(Object.keys(RAW).map((code) => [code, build(code)])),
);

/** 六十四卦列表，按上卦宫（1→8）、下卦（1→8）顺序 */
export const HEXAGRAM_LIST: readonly Hexagram[] = Object.freeze(Object.values(HEXAGRAMS));

/** 按上下卦先天数取卦 */
export function getHexagram(upper: TrigramNumber, lower: TrigramNumber): Hexagram {
  const h = HEXAGRAMS[hexCodeOf(upper, lower)];
  if (!h) throw new Error(`未知卦组合：${upper}-${lower}`);
  return h;
}

/**
 * 按卦代码取卦。
 * 兼容非补零写法（`6-5` 等价 `06-05`），便于读取历史数据与手写参数。
 */
export function getHexagramByCode(code: HexCode): Hexagram | undefined {
  return HEXAGRAMS[code] ?? HEXAGRAMS[normalizeHexCode(code)];
}

/** 由六爻（自下而上，index 0 = 初爻）取卦 */
export function getHexagramByLines(lines: readonly number[]): Hexagram {
  if (lines.length !== 6) throw new Error(`六爻长度必须为 6，实际 ${lines.length}`);
  const bin = (lo: number) =>
    (lines[lo] & 1) | ((lines[lo + 1] & 1) << 1) | ((lines[lo + 2] & 1) << 2);
  const lower = trigramNumberOf(bin(0));
  const upper = trigramNumberOf(bin(3));
  return getHexagram(upper, lower);
}

function trigramNumberOf(binary: number): TrigramNumber {
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
    if (TRIGRAMS[n].binary === binary) return n;
  }
  throw new Error(`未知三爻位编码：${binary}`);
}

export interface KnowledgeBaseIssue {
  readonly rule: string;
  readonly detail: string;
}

/**
 * 知识库校验（05 文档 §3.4 五条规则）。
 * 返回问题列表；空数组表示通过。供单测与启动自检使用。
 */
export function validateKnowledgeBase(): KnowledgeBaseIssue[] {
  const issues: KnowledgeBaseIssue[] = [];
  const codes = Object.keys(HEXAGRAMS);

  // 规则 1：恰好 64 条，code 无重复，覆盖全部 8×8 组合
  if (codes.length !== 64) {
    issues.push({ rule: '1', detail: `卦数应为 64，实际 ${codes.length}` });
  }
  const expected = new Set<string>();
  for (const u of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
    for (const l of [1, 2, 3, 4, 5, 6, 7, 8] as const) expected.add(hexCodeOf(u, l));
  }
  for (const c of codes) {
    if (!expected.has(c)) issues.push({ rule: '1', detail: `出现非法卦代码：${c}` });
  }
  for (const c of expected) {
    if (!HEXAGRAMS[c]) issues.push({ rule: '1', detail: `缺少卦组合：${c}` });
  }
  const names = new Set(HEXAGRAM_LIST.map((h) => h.name));
  if (names.size !== 64) {
    issues.push({ rule: '1', detail: `卦名有重复，去重后仅 ${names.size} 个` });
  }

  for (const h of HEXAGRAM_LIST) {
    // 规则 2：lines 恒为 6 条（未录入时为 null，不算违规）
    if (h.lines !== null && h.lines.length !== 6) {
      issues.push({ rule: '2', detail: `${h.name} 的 lines 长度应为 6，实际 ${h.lines.length}` });
    }
    // 规则 3：binary 与 upper/lower 编码一致
    const expectedBinary = TRIGRAMS[h.lower].binary | (TRIGRAMS[h.upper].binary << 3);
    if (h.binary !== expectedBinary) {
      issues.push({
        rule: '3',
        detail: `${h.name}(${h.code}) binary 应为 ${expectedBinary}，实际 ${h.binary}`,
      });
    }
    // 规则 4：keywords 非空且 1–5 条
    if (h.keywords.length < 1 || h.keywords.length > 5) {
      issues.push({
        rule: '4',
        detail: `${h.name} keywords 条数应 1–5，实际 ${h.keywords.length}`,
      });
    }
    if (h.keywords.some((k) => !k.trim())) {
      issues.push({ rule: '4', detail: `${h.name} 存在空关键词` });
    }
    // 规则 5 的字段形态检查：yongText 仅乾坤有值
    if (h.yongText !== null && h.name !== '乾为天' && h.name !== '坤为地') {
      issues.push({ rule: '2', detail: `${h.name} 不应有 yongText` });
    }
  }

  return issues;
}

/** 六爻（自下而上）→ 展示用爻列表（自上而下），仅用于渲染 */
export function linesTopDown(lines: readonly number[]): number[] {
  return [...lines].reverse();
}

/** 三爻位编码 → 三爻列表（自下而上），供 UI 绘制重卦的半卦 */
export function binaryToLines(binary: number): [number, number, number] {
  return [binary & 1, (binary >> 1) & 1, (binary >> 2) & 1];
}

/** 断言工具：把 6 爻（自下而上）转为位编码，供测试对拍 */
export function linesToHexBinary(lines: readonly number[]): number {
  return lines.reduce((acc, v, i) => acc + ((v & 1) << i), 0);
}

/** 便于测试：取某卦的三爻结构描述 */
export function describeTrigram(n: TrigramNumber): string {
  return `${TRIGRAMS[n].name}[${trigramLines(n).join(',')}]`;
}
