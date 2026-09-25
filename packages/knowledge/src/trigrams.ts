/* ============================================================
 * 八卦基础数据 —— 对应 docs/dev/05-卦象知识库设计.md v1.4 §2.1 / §2.2
 *
 * 约定（与 03 文档 §1.1 一致）：
 *   - 先天八卦数：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8
 *   - binary 为三爻位编码，**下爻为 bit0**（乾 0b111 = 7，坤 0b000 = 0）
 *   - 爻列表一律自下而上（index 0 = 初爻）
 *
 * 本文件为纯数据，不含任何算法与运行时依赖，可被 Web / Android 共用。
 * ============================================================ */

/** 五行。03 文档 §五 `enum class Element` 与 05 文档 §2.1 schema 均以枚举值存储。 */
export type Element = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER';

/** 五行中文名（UI 展示用） */
export const ELEMENT_CN: Readonly<Record<Element, string>> = Object.freeze({
  WOOD: '木',
  FIRE: '火',
  EARTH: '土',
  METAL: '金',
  WATER: '水',
});

/** 先天八卦数 1–8 */
export type TrigramNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Trigram {
  /** 先天八卦数 */
  readonly number: TrigramNumber;
  /** 卦名：乾 */
  readonly name: string;
  /** Unicode 卦符：☰ */
  readonly symbol: string;
  /** 三爻位编码，下爻为 bit0 */
  readonly binary: number;
  readonly element: Element;
  /** 卦性：刚健 */
  readonly nature: string;
  /** 人伦（家庭角色）：父 */
  readonly family: string;
  /** 方位：西北 */
  readonly direction: string;
  /** 时令：秋、九十月之交 */
  readonly season: string;
  /** 天时 */
  readonly weather: string;
  /** 人伦（万物类象口径） */
  readonly figures: string;
  /** 地理 */
  readonly geo: string;
  /** 身体 */
  readonly body: string;
  /** 动物 */
  readonly animals: string;
  /** 静物 */
  readonly objects: string;
  /** 性情 / 人事 */
  readonly affairs: string;
  /** 五味（由五行推导：金辛 火苦 木酸 水咸 土甘） */
  readonly taste: string;
}

/**
 * 八卦类象总表（**未冻结的录入表**，勿直接导出）。
 * 条目取自 05 文档 §2.2「八卦万物类象总表（传统条目摘编）」，
 * 该表同时是 UI 学习页「八卦类象速查」的渲染来源。
 */
const TRIGRAM_TABLE: Readonly<Record<TrigramNumber, Trigram>> = {
  1: {
    number: 1, name: '乾', symbol: '☰', binary: 0b111, element: 'METAL',
    nature: '刚健', family: '父', direction: '西北', season: '秋、九十月之交',
    weather: '天、冰、雹',
    figures: '父、君、老人、领导',
    geo: '京都、大郡、形胜之地、高亢之所',
    body: '首、骨、肺',
    animals: '马、天鹅、狮、象',
    objects: '金玉、宝珠、圆物、木果、冠',
    affairs: '刚健、果决、多动少静',
    taste: '辛辣',
  },
  2: {
    number: 2, name: '兑', symbol: '☱', binary: 0b011, element: 'METAL',
    nature: '悦', family: '少女', direction: '西', season: '秋',
    weather: '雨泽、新月、星',
    figures: '少女、妾、歌伎、伶人',
    geo: '泽、水际、缺池、废井、山崩破裂之地',
    body: '舌、口、肺、痰、涎',
    animals: '羊、泽中之物',
    objects: '金刃、金类、乐器、废物、缺口之物、带口之器',
    affairs: '喜悦、口舌、谗毁、饮食',
    taste: '辛辣',
  },
  3: {
    number: 3, name: '离', symbol: '☲', binary: 0b101, element: 'FIRE',
    nature: '丽', family: '中女', direction: '南', season: '夏五月',
    weather: '电、虹、霓、霞、日',
    figures: '中女、文人、大腹人',
    geo: '南方、干亢之地、窑、炉冶之所、向阳处',
    body: '目、心、上焦',
    animals: '雉、龟、鳖、蟹、螺、蚌、介虫',
    objects: '书、文、甲胄、干戈、槁木、干燥之物、彩色之物',
    affairs: '聪明、文明、虚心、美容',
    taste: '苦',
  },
  4: {
    number: 4, name: '震', symbol: '☳', binary: 0b001, element: 'WOOD',
    nature: '动', family: '长男', direction: '东', season: '春三月',
    weather: '雷',
    figures: '长男',
    geo: '东方、树木、闹市、大途、竹林草木茂盛之地',
    body: '足、肝、发、声音',
    animals: '龙、蛇、虫',
    objects: '木竹、萑苇、乐器（属木者）、花草繁鲜之物',
    affairs: '动、惊恐、奋进',
    taste: '酸',
  },
  5: {
    number: 5, name: '巽', symbol: '☴', binary: 0b110, element: 'WOOD',
    nature: '入', family: '长女', direction: '东南', season: '春夏之交、三五八之年月',
    weather: '风',
    figures: '长女、秀士、寡妇、僧道',
    geo: '东南方、草木茂秀之地、花果菜园、山林',
    body: '股、肱、气、风疾',
    animals: '鸡、百禽、山林中之禽虫',
    objects: '木香、绳、直物、竹木、工巧之器',
    affairs: '进入、不定、进退不果、文书',
    taste: '酸',
  },
  6: {
    number: 6, name: '坎', symbol: '☵', binary: 0b010, element: 'WATER',
    nature: '陷', family: '中男', direction: '北', season: '冬十一月',
    weather: '雨、月、雪、霜、露',
    figures: '中男、江湖人、舟人、盗贼',
    geo: '北方、江湖、溪涧、泉井、卑湿之地',
    body: '耳、血、肾、腰',
    animals: '豕、鱼、水族',
    objects: '酒、水具、有核之物、柔脆之物、丛棘、酒器',
    affairs: '险陷、隐伏、外柔内刚、智谋',
    taste: '咸',
  },
  7: {
    number: 7, name: '艮', symbol: '☶', binary: 0b100, element: 'EARTH',
    nature: '止', family: '少男', direction: '东北', season: '冬春之交',
    weather: '云、雾、山岚',
    figures: '少男、闲人、山中人、童子',
    geo: '东北方、山径、近山城、丘陵、坟墓、东北之地',
    body: '手、指、骨、鼻、背',
    animals: '虎、狗、鼠、百兽、山中之物',
    objects: '山路、石阶、土堆、门限、土石之物',
    affairs: '阻止、静、笃实、保守',
    taste: '甘',
  },
  8: {
    number: 8, name: '坤', symbol: '☷', binary: 0b000, element: 'EARTH',
    nature: '顺', family: '母', direction: '西南', season: '辰戌丑未月、六七八月',
    weather: '阴云、雾气、冰霜',
    figures: '母、老妇、农夫、乡人、众人',
    geo: '田野、乡里、平地、西南方',
    body: '腹、脾、肉、胃',
    animals: '牛、百兽、牝马',
    objects: '布帛、丝绵、五谷、釜、瓦器、柔韧之物',
    affairs: '柔顺、包容、众多、安静',
    taste: '甘',
  },
};

/**
 * 八卦类象总表（冻结）。`readonly` 只在编译期生效，运行时仍可被改写；
 * 知识库是全局共享单例，UI 若原地排序/改写会污染所有调用方，故此处显式冻结。
 */
export const TRIGRAMS: Readonly<Record<TrigramNumber, Trigram>> = Object.freeze(
  Object.fromEntries(
    Object.entries(TRIGRAM_TABLE).map(([k, v]) => [k, Object.freeze(v)]),
  ),
) as Readonly<Record<TrigramNumber, Trigram>>;

/** 按先天数升序排列的八卦列表（乾→坤），UI 学习页按此顺序渲染 */
export const TRIGRAM_LIST: readonly Trigram[] = Object.freeze(
  [1, 2, 3, 4, 5, 6, 7, 8].map((n) => TRIGRAMS[n as TrigramNumber]),
);

/** 类象速查表的列键 */
export type TrigramCategoryKey = keyof Trigram;

/** 类象速查表列定义（未冻结录入表）—— 类目名称与 05 文档 §2.2 表头逐字一致 */
const TRIGRAM_CATEGORY_TABLE: readonly {
  readonly key: TrigramCategoryKey;
  readonly label: string;
}[] = [
  { key: 'figures', label: '人伦' },
  { key: 'weather', label: '天时' },
  { key: 'geo', label: '地理' },
  { key: 'body', label: '身体' },
  { key: 'animals', label: '动物' },
  { key: 'objects', label: '静物' },
  { key: 'affairs', label: '性情人事' },
  { key: 'direction', label: '方位' },
  { key: 'season', label: '时令' },
  { key: 'taste', label: '五味' },
];

/** 类象速查表列定义（冻结） */
export const TRIGRAM_CATEGORIES: readonly {
  readonly key: TrigramCategoryKey;
  readonly label: string;
}[] = Object.freeze(TRIGRAM_CATEGORY_TABLE.map((c) => Object.freeze(c)));

/** 取八卦；number 非法时抛错（知识库数据损坏属编程错误，不静默降级） */
export function trigram(n: TrigramNumber): Trigram {
  const t = TRIGRAMS[n];
  if (!t) throw new Error(`未知先天八卦数：${n}`);
  return t;
}

/** 由三爻位编码反查八卦先天数 */
export function trigramByBinary(binary: number): TrigramNumber {
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
    if (TRIGRAMS[n].binary === binary) return n;
  }
  throw new Error(`未知三爻位编码：${binary}`);
}

/** 三爻列表，自下而上（index 0 = 初爻） */
export function trigramLines(n: TrigramNumber): [number, number, number] {
  const b = TRIGRAMS[n].binary;
  return [b & 1, (b >> 1) & 1, (b >> 2) & 1];
}

/** 三爻列表 → 位编码 */
export function linesToBinary(bits: readonly number[]): number {
  return (bits[0] & 1) | ((bits[1] & 1) << 1) | ((bits[2] & 1) << 2);
}
