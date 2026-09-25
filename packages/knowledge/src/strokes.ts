/* ============================================================
 * 汉字笔画映射 —— 对应 docs/dev/05-卦象知识库设计.md v1.4 §4.1 / §4.2
 *
 * ⚠️ 当前为 MVP 子集（约 120 个高频字），与 UI 原型口径一致。
 *    正式版需扩充至「通用规范汉字表一级 3500 + 二级 4500」并按 §4.2 抽样校验。
 *    扩充时必须逐字比对辞书，**不得批量推测**。
 *
 * 查表口径（05 §4.1）：
 *   - 表键一律为**简体字面**，繁体笔画由 `t` 字段承载（缺省视为与简体相同）
 *   - 繁体字面（如「觀」）经 {@link TRADITIONAL_ALIAS} 归一到简体字面后取值
 * ============================================================ */

export type StrokeStandard = 'SIMPLIFIED' | 'TRADITIONAL';

export interface StrokeEntry {
  /** 简体标准笔画 */
  readonly s: number;
  /** 繁体标准笔画；缺省视为与简体相同（05 文档 §4.1 的约定） */
  readonly t?: number;
}

/** 笔画录入表（未冻结）—— 键为简体字面，勿直接导出 */
const STROKE_TABLE: Readonly<Record<string, StrokeEntry>> = {
  一: { s: 1 }, 二: { s: 2 }, 三: { s: 3 }, 四: { s: 5 }, 五: { s: 4 }, 六: { s: 4 }, 七: { s: 2 }, 八: { s: 2 }, 九: { s: 2 }, 十: { s: 2 },
  人: { s: 2 }, 大: { s: 3 }, 小: { s: 3 }, 中: { s: 4 }, 上: { s: 3 }, 下: { s: 3 }, 心: { s: 4 }, 手: { s: 4 }, 口: { s: 3 }, 目: { s: 5 },
  日: { s: 4 }, 月: { s: 4 }, 年: { s: 6 }, 时: { s: 7, t: 10 }, 分: { s: 4 }, 天: { s: 4 }, 地: { s: 6 }, 水: { s: 4 }, 火: { s: 4 }, 山: { s: 3 },
  石: { s: 5 }, 田: { s: 5 }, 土: { s: 3 }, 金: { s: 8 }, 木: { s: 4 }, 风: { s: 4, t: 9 }, 云: { s: 4, t: 12 }, 雨: { s: 8 }, 雪: { s: 11 }, 雷: { s: 13 },
  电: { s: 5, t: 13 }, 龙: { s: 5, t: 16 }, 马: { s: 3, t: 10 }, 牛: { s: 4 }, 羊: { s: 6 }, 鸟: { s: 5, t: 11 }, 鱼: { s: 8, t: 11 }, 虫: { s: 6 },
  梅: { s: 11, t: 11 }, 花: { s: 7, t: 8 }, 观: { s: 6, t: 25 }, 音: { s: 9 }, 乐: { s: 5, t: 15 }, 问: { s: 6, t: 11 }, 事: { s: 8 }, 吉: { s: 6 }, 凶: { s: 4 },
  春: { s: 9 }, 夏: { s: 10 }, 秋: { s: 9 }, 冬: { s: 5 }, 东: { s: 5, t: 8 }, 南: { s: 9 }, 西: { s: 6 }, 北: { s: 5 }, 国: { s: 8, t: 11 }, 家: { s: 10 },
  学: { s: 8, t: 16 }, 开: { s: 4, t: 12 }, 门: { s: 3, t: 8 }, 见: { s: 4, t: 7 }, 书: { s: 4, t: 10 }, 画: { s: 8, t: 12 }, 长: { s: 4, t: 8 }, 飞: { s: 3, t: 9 },
  爱: { s: 10, t: 13 }, 无: { s: 4, t: 12 }, 明: { s: 8 }, 白: { s: 5 }, 玉: { s: 5 }, 王: { s: 4 }, 君: { s: 7 }, 臣: { s: 6 }, 民: { s: 5 },
  生: { s: 5 }, 老: { s: 6 }, 子: { s: 3 }, 女: { s: 3 }, 男: { s: 7 }, 道: { s: 12 }, 德: { s: 15 }, 福: { s: 13 }, 禄: { s: 12 }, 寿: { s: 7, t: 14 },
  财: { s: 7, t: 10 }, 官: { s: 8 }, 病: { s: 10 }, 药: { s: 9, t: 19 }, 医: { s: 7, t: 18 }, 婚: { s: 11 }, 姻: { s: 9 }, 情: { s: 11 },
  考: { s: 6 }, 试: { s: 8, t: 13 }, 工: { s: 3 }, 作: { s: 7 }, 司: { s: 5 }, 公: { s: 4 }, 旅: { s: 10 }, 行: { s: 6 }, 住: { s: 7 },
  宅: { s: 6 }, 屋: { s: 9 }, 车: { s: 4, t: 7 }, 路: { s: 13 }, 桥: { s: 10, t: 16 }, 船: { s: 11 },
};

/**
 * 繁体字面 → 简体字面别名表（05 文档 §4.1）。
 *
 * 只登记「繁体形与简体形不同」且已在 {@link STROKE_TABLE} 中收字的字。
 * 笔画**数值**一律由 `t` 字段提供，不在此处重复录入 —— 同一数值在仓库里
 * 出现两份必然改一处漏一处（这正是本表用别名而非并列键的原因）。
 */
export const TRADITIONAL_ALIAS: Readonly<Record<string, string>> = Object.freeze({
  時: '时', 風: '风', 雲: '云', 電: '电', 龍: '龙', 馬: '马', 鳥: '鸟', 魚: '鱼',
  觀: '观', 樂: '乐', 問: '问', 東: '东', 國: '国', 學: '学', 開: '开', 門: '门',
  見: '见', 書: '书', 畫: '画', 長: '长', 飛: '飞', 愛: '爱', 無: '无', 壽: '寿',
  財: '财', 藥: '药', 醫: '医', 試: '试', 車: '车', 橋: '桥',
});

/**
 * 字 → 笔画（冻结）。`readonly` 只在编译期生效，运行时仍可改写；
 * 知识库是全局共享单例，UI 若原地改写会污染所有调用方。
 */
export const STROKES: Readonly<Record<string, StrokeEntry>> = Object.freeze(
  Object.fromEntries(Object.entries(STROKE_TABLE).map(([k, v]) => [k, Object.freeze(v)])),
);

export interface StrokeLookup {
  /** 该标准下的笔画数 */
  readonly strokes: number;
  /** 是否为用户手动补充（非内置表命中） */
  readonly manual: boolean;
  /** 是否回退到了简体值（繁体缺省） */
  readonly fellBackToSimplified: boolean;
  /**
   * 实际取值的表键。繁体输入（如「觀」）时为归一后的简体字面（「观」），
   * 供 UI 提示与排错；手动补充时等于输入字本身。
   */
  readonly resolvedChar: string;
}

/**
 * 查询笔画。查表 miss 返回 null —— 调用方（UI）据此弹出「手动输入笔画」对话框
 * （03 文档 §6.4：不自动猜测）。
 *
 * 繁体字面（如「觀」）先经 {@link TRADITIONAL_ALIAS} 归一到简体字面再取值，
 * 因此 `lookupStrokes('觀', 'TRADITIONAL') === 25`、`('觀', 'SIMPLIFIED') === 6`
 * —— 与 `('观', ...)` 的结果对称（标准决定「按哪个字形计画」，字面本身不决定）。
 *
 * @param manualTable 用户手动补充的笔画表（04 文档 §4.2「记住该字」）
 */
export function lookupStrokes(
  char: string,
  standard: StrokeStandard,
  manualTable?: Readonly<Record<string, number>>,
): StrokeLookup | null {
  const key = STROKES[char] ? char : (TRADITIONAL_ALIAS[char] ?? char);
  const entry = STROKES[key];
  if (!entry) {
    const manual = manualTable?.[char];
    if (manual == null) return null;
    return { strokes: manual, manual: true, fellBackToSimplified: false, resolvedChar: char };
  }
  if (standard === 'TRADITIONAL') {
    if (entry.t != null) {
      return { strokes: entry.t, manual: false, fellBackToSimplified: false, resolvedChar: key };
    }
    return { strokes: entry.s, manual: false, fellBackToSimplified: true, resolvedChar: key };
  }
  return { strokes: entry.s, manual: false, fellBackToSimplified: false, resolvedChar: key };
}

/** 是否为汉字（CJK 统一表意文字基本区 + 扩展 A） */
export function isHanChar(ch: string): boolean {
  return /^[\u3400-\u4DBF\u4E00-\u9FFF]$/.test(ch);
}
