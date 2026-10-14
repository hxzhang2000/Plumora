/* ============================================================
 * 四种起卦方法 —— 对应 03 文档 §二
 *   §2.1 时间起卦  §2.2 数字起卦  §2.3 汉字笔画起卦  §2.4 随机起卦
 *
 * 原 §2.4「声音（点数）起卦」已按产品决策移除；随机起卦顺延为 §2.4。
 * 「一数起卦」与「一字起卦」同已移除，数字/汉字起卦仅保留两数、两字模式；
 * 旧记录里 mode='ONE' 的数据仍可读（types.ts / inputParamsOf / castContext 保留兼容分支）。
 * ============================================================ */

import type { StrokeStandard } from '@plumora/knowledge';
import { LunarConversionError, type LunarProvider } from './lunar.js';
import {
  NUMBER_MAX,
  ganzhiYearOf,
  hourBranchName,
  hourNumber,
  isValidNumber,
  modMoving,
  modTrigram,
  yearBranchNoOf,
} from './modulus.js';
import {
  METHOD_CN,
  type CastResult,
  type CharacterCast,
  type InputParams,
  type NumberCast,
  type RandomCast,
  type TimeCast,
  type TimePrecision,
} from './types.js';

/** 起卦输入非法（03 文档 §6.3 等边界裁定） */
export class CastInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CastInputError';
  }
}

/* ------------------------------------------------------------------
 * §2.1 时间起卦（年月日时）
 * ------------------------------------------------------------------ */

/**
 * 时间起卦的纯数值入口 —— 与日历转换解耦，便于单测直接对拍 07 文档 TC-T01–T03。
 *
 * 上卦 = (年支序数 + 农历月 + 农历日) mod 8，余 0 取 8
 * 下卦 = (年支序数 + 农历月 + 农历日 + 时辰序数) mod 8，余 0 取 8
 * 动爻 = (上式之和 + 细项) mod 6，余 0 取 6
 *
 * 细项（03 文档 §6.6）：precision 为 MINUTE 时取分钟数、SECOND 时取分钟 + 秒数、
 * SHICHEN（缺省）时为 0。**细项只作用于动爻**，上 / 下卦不受影响。
 *
 * 入参一律要求**整数**：非整数若被静默接受，`params` 会记录 15.5 这类脏值，
 * 而 `modTrigram` 内部 `Math.trunc` 却按 15 计算 —— 展示的中间量与真实结果不符。
 */
export function castByTimeParts(
  yearBranchNo: number,
  lunarMonth: number,
  lunarDay: number,
  hourNo: number,
  opts: {
    shifted?: boolean;
    label?: string;
    /** 时间精度口径；缺省 SHICHEN（传统时辰，合 03 文档 §2.1 原公式） */
    precision?: TimePrecision;
    /** 起卦时刻分钟 0–59；手动输入时间为 0 */
    minute?: number;
    /** 起卦时刻秒钟 0–59；手动输入时间为 0 */
    second?: number;
  } = {},
): TimeCast {
  if (!Number.isInteger(hourNo) || hourNo < 1 || hourNo > 12) {
    throw new CastInputError(`时辰序数须为 1–12 的整数，实际 ${hourNo}`);
  }
  if (!Number.isInteger(yearBranchNo) || yearBranchNo < 1 || yearBranchNo > 12) {
    throw new CastInputError(`年支序数须为 1–12 的整数，实际 ${yearBranchNo}`);
  }
  if (!Number.isInteger(lunarMonth) || lunarMonth < 1 || lunarMonth > 12) {
    throw new CastInputError(`农历月须为 1–12 的整数，实际 ${lunarMonth}`);
  }
  if (!Number.isInteger(lunarDay) || lunarDay < 1 || lunarDay > 30) {
    throw new CastInputError(`农历日须为 1–30 的整数，实际 ${lunarDay}`);
  }
  const precision = opts.precision ?? 'SHICHEN';
  const minute = opts.minute ?? 0;
  const second = opts.second ?? 0;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new CastInputError(`分钟须为 0–59 的整数，实际 ${minute}`);
  }
  if (!Number.isInteger(second) || second < 0 || second > 59) {
    throw new CastInputError(`秒钟须为 0–59 的整数，实际 ${second}`);
  }
  const s1 = yearBranchNo + lunarMonth + lunarDay;
  const s2 = s1 + hourNo;
  const movingSum = s2 + fineOfTime(precision, minute, second);
  return {
    method: 'TIME',
    upper: modTrigram(s1),
    lower: modTrigram(s2),
    moving: modMoving(movingSum),
    label: opts.label ?? '',
    params: {
      yearBranchNo,
      lunarMonth,
      lunarDay,
      hourNo,
      s1,
      s2,
      shifted: opts.shifted ?? false,
      precision,
      minute,
      second,
      movingSum,
    },
  };
}

/**
 * 动爻细项：在 S2 之外追加参与 mod 6 的时间量（03 文档 §6.6）。
 * SHICHEN → 0（纯传统时辰口径）；MINUTE → 分钟；SECOND → 分钟 + 秒。
 */
function fineOfTime(precision: TimePrecision, minute: number, second: number): number {
  if (precision === 'SECOND') return minute + second;
  if (precision === 'MINUTE') return minute;
  return 0;
}

/**
 * 时间起卦（日历入口）。
 * 晚子时（23:00 后）按**次日**日数与子时起卦（03 文档 §6.2）。
 *
 * @param opts.precision 时间精度口径（03 §6.6）；缺省 SHICHEN 即纯传统时辰口径。
 *   分钟 / 秒取 `date` 的本地时分秒——「用当前时刻」入口因此可在同一时辰内
 *   得到不同动爻；手动输入时间（只填到时）分秒恒为 0，与传统口径等价。
 */
export function castByTime(
  date: Date,
  lunar: LunarProvider,
  opts: { precision?: TimePrecision } = {},
): TimeCast {
  const hour = date.getHours();
  let y = date.getFullYear();
  let m = date.getMonth() + 1;
  let d = date.getDate();
  let hourNo: number;
  let shifted = false;

  if (hour >= 23) {
    // 晚子时：按次日子时（年支亦随次日切换）
    const next = new Date(y, m - 1, d + 1);
    y = next.getFullYear();
    m = next.getMonth() + 1;
    d = next.getDate();
    hourNo = 1;
    shifted = true;
  } else {
    hourNo = hourNumber(hour);
  }

  const lu = lunar.solar2lunar(y, m, d);
  if (!lu) throw new LunarConversionError(y, m, d);

  // 闰月兜底：部分农历库（如 lunar-java）用**负数月份**表示闰月，
  // 而 LunarProvider 端口约定 lMonth 恒为正的本月份数（03 §6.1）。
  const lunarMonth = Math.abs(lu.lMonth);

  // 年支序数：子=1 … 亥=12（农历年口径，见 modulus.ts 的「年支口径」段）
  const yearBranchNo = yearBranchNoOf(lu.lYear);

  return castByTimeParts(yearBranchNo, lunarMonth, lu.lDay, hourNo, {
    shifted,
    precision: opts.precision ?? 'SHICHEN',
    minute: date.getMinutes(),
    second: date.getSeconds(),
    // 干支年**必须与 yearBranchNo 同源**（均由 lYear 派生）。
    // 若此处改用 lu.gzYear（立春为界的干支年），每年「正月初一 → 立春」约 13 天里
    // 标签与算法会互相矛盾：界面写「丙午年」而实际按巳=6 计算，用户手算必然对不上。
    // monthCn 已含「闰」前缀（如「闰四月」），此处不再拼接，避免出现「闰闰四月」
    label: `${ganzhiYearOf(lu.lYear)}年 ${lu.monthCn}${lu.dayCn} ${hourBranchName(hourNo)}时`,
  });
}

/* ------------------------------------------------------------------
 * §2.2 数字起卦（仅两数模式；一数模式已移除，见 03 文档）
 * ------------------------------------------------------------------ */

/**
 * 数字起卦（**仅两数模式**；一数起卦已按产品决策移除，旧记录读取仍兼容）。
 * @param n1 第一数（上卦）
 * @param n2 第二数（下卦）——必填；缺失/无效抛 {@link CastInputError}（第二数无效）
 */
export function castByNumber(n1: number, n2: number): NumberCast {
  if (!isValidNumber(n1)) {
    throw new CastInputError(`第一数无效：${n1}（须为 1–${NUMBER_MAX} 的整数，0 无效）`);
  }

  if (!isValidNumber(n2)) {
    throw new CastInputError(`第二数无效：${n2}（须为 1–${NUMBER_MAX} 的整数，0 无效）`);
  }
  const sum = n1 + n2;
  return {
    method: 'NUMBER',
    upper: modTrigram(n1),
    lower: modTrigram(n2),
    moving: modMoving(sum),
    params: { mode: 'TWO', n1, n2, sum },
  };
}

/* ------------------------------------------------------------------
 * §2.3 汉字笔画起卦（仅两字模式；一字模式已移除，见 03 文档）
 * ------------------------------------------------------------------ */

export interface CharacterCastInput {
  /** 两字模式的笔画数 [A, B]（一字起卦已移除，仅接受 2 个汉字） */
  readonly strokes: readonly number[];
  readonly chars: readonly string[];
  readonly standard: StrokeStandard;
  /** 起卦瞬间秒钟数 0–59（参与动爻，03 文档 §6.5） */
  readonly second?: number;
}

/**
 * 汉字笔画起卦（**仅两字模式**；一字起卦已按产品决策移除，旧记录读取仍兼容）。
 *
 * 两字：upper = A mod 8；lower = B mod 8；moving = (A + B + 秒) mod 6
 */
export function castByCharacter(input: CharacterCastInput): CharacterCast {
  const { strokes, chars, standard, second } = input;

  // chars 与 strokes 必须一一对应：不等长时字会静默丢失（`{strokes:[11,8],chars:['梅']}`
  // 会丢掉第二字）或渲染出「undefined 16 画」（`{strokes:[16],chars:[]}`）。
  if (chars.length !== strokes.length) {
    throw new CastInputError(
      `汉字数与笔画数必须一一对应：${chars.length} 个字 / ${strokes.length} 个笔画`,
    );
  }
  if (chars.length !== 2) {
    throw new CastInputError(`汉字数须为 2 个（两字起卦，一字起卦已移除），实际 ${chars.length}`);
  }

  if (strokes.length !== 2) {
    throw new CastInputError(`笔画数须为 2 个（两字起卦），实际 ${strokes.length}`);
  }
  const [a, b] = strokes;
  if (!Number.isInteger(a) || a < 1 || !Number.isInteger(b) || b < 1) {
    throw new CastInputError(`笔画数无效：${a} / ${b}`);
  }
  const sec = second ?? 0;
  if (!Number.isInteger(sec) || sec < 0 || sec > 59) {
    throw new CastInputError(`秒钟数须为 0–59，实际 ${sec}`);
  }
  const sum = a + b + sec;
  return {
    method: 'CHARACTER',
    chars: [...chars],
    strokes: [...strokes],
    standard,
    upper: modTrigram(a),
    lower: modTrigram(b),
    moving: modMoving(sum),
    params: { mode: 'TWO', strokes: [...strokes], second: sec, sum },
  };
}

/* ------------------------------------------------------------------
 * §2.4 随机起卦（P2，模拟「外应」）
 * ------------------------------------------------------------------ */

/** 可注入的随机源，便于测试（默认 crypto.getRandomValues） */
export type RandomSource = () => number;

const defaultRandom: RandomSource = () => {
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } };
  if (g.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    g.crypto.getRandomValues(buf);
    return buf[0] / 0x1_0000_0000;
  }
  return Math.random();
};

/** 随机起卦：上卦 1–8、下卦 1–8、动爻 1–6（03 文档 §2.4） */
export function castByRandom(random: RandomSource = defaultRandom): RandomCast {
  const pick = (max: number): number => {
    const r = random();
    // 随机源的契约是 [0, 1)。若返回 1 或越界值，`floor(r * max) + 1` 会算出 9 / 7
    // 这类不存在的卦数——过去用 `as 1|2|…|8` 断言把它掩盖了，脏数据要到下游
    // 取卦时才以 TypeError 暴露。此处直接按契约拒绝。
    if (!Number.isFinite(r) || r < 0 || r >= 1) {
      throw new CastInputError(`随机源须返回 [0, 1) 区间的数，实际 ${r}`);
    }
    return Math.floor(r * max) + 1;
  };
  const upper = pick(8);
  const lower = pick(8);
  const moving = pick(6);
  return {
    method: 'RANDOM',
    // modTrigram 对 1–8 是恒等映射，同时把结果收窄为 TrigramNumber（无需 as 断言）
    upper: modTrigram(upper),
    lower: modTrigram(lower),
    moving,
    params: { upper, lower, moving },
  };
}

/**
 * 每日一卦：以「年月日」为种子的确定性起卦，同一天结果稳定、隔天更新。
 * 用 FNV-1a 哈希日期串做种子，喂给 mulberry32 得到一个可复现的随机源，
 * 再复用 castByRandom 的取卦逻辑——保证和「随机起卦」共用同一套取值契约。
 */
export function castByDaily(date: Date = new Date()): RandomCast {
  const seedStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let state = h >>> 0;
  const seeded: RandomSource = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return castByRandom(seeded);
}

/* ------------------------------------------------------------------
 * 派生：inputParams（04 文档 §2.4）与结果页「起卦上下文」文案
 * ------------------------------------------------------------------ */

/** 起卦结果 → 持久化用的 inputParams JSON（04 文档 §2.4） */
export function inputParamsOf(cast: CastResult): InputParams {
  switch (cast.method) {
    case 'TIME':
      return {
        type: 'TIME',
        yearBranchNo: cast.params.yearBranchNo,
        lunarMonth: cast.params.lunarMonth,
        lunarDay: cast.params.lunarDay,
        hourNo: cast.params.hourNo,
        // 落库晚子时标记：否则「23:30 起卦」与「次日 00:30 起卦」的 inputParams
        // 完全同形，详情页无法复盘「按次日计」（C-8）
        shifted: cast.params.shifted,
        // 时间精度与细项一并落库：否则「同一时辰两次起卦」的 inputParams 同形，
        // 详情页无法复盘动爻为何不同（03 §6.6 复现性要求）
        precision: cast.params.precision,
        minute: cast.params.minute,
        second: cast.params.second,
        movingSum: cast.params.movingSum,
      };
    case 'NUMBER':
      return cast.params.mode === 'TWO'
        ? { type: 'NUMBER', mode: 'TWO', n1: cast.params.n1, n2: cast.params.n2 as number }
        : { type: 'NUMBER', mode: 'ONE', n1: cast.params.n1, hourNo: cast.params.hourNo as number };
    case 'CHARACTER':
      return cast.params.mode === 'TWO'
        ? {
            type: 'CHARACTER',
            mode: 'TWO',
            chars: [...cast.chars],
            strokes: [...cast.strokes],
            standard: cast.standard,
            second: cast.params.second as number,
          }
        : {
            type: 'CHARACTER',
            mode: 'ONE',
            chars: [...cast.chars],
            strokes: [...cast.strokes],
            standard: cast.standard,
            hourNo: cast.params.hourNo as number,
          };
    case 'RANDOM':
      return {
        type: 'RANDOM',
        upper: cast.params.upper,
        lower: cast.params.lower,
        moving: cast.params.moving,
      };
  }
}

/**
 * 起卦上下文文案（结果页顶部一行）。
 * 放在 core 而非 UI 层：文案口径需要与算法同步演进，且 Android 端要复用同一套措辞。
 */
export function castContext(cast: CastResult): string {
  const parts: string[] = [METHOD_CN[cast.method]];
  switch (cast.method) {
    case 'TIME':
      parts.push(cast.label);
      if (cast.params.shifted) parts.push('晚子时 · 按次日计');
      // 细项确实改变了取余之和才展示：手动输入时间（分秒为 0）与传统时辰口径
      // 完全等价，展示「分钟 0」只会是无意义噪声；「用当前时刻」则在细项生效时
      // 让用户看到动爻究竟由哪个分 / 秒推来（03 §6.6 复现性）
      if (cast.params.movingSum !== cast.params.s2) {
        parts.push(
          cast.params.precision === 'SECOND'
            ? `分 ${cast.params.minute} 秒 ${cast.params.second}`
            : `分钟 ${cast.params.minute}`,
        );
      }
      break;
    case 'NUMBER':
      if (cast.params.mode === 'TWO') {
        parts.push(`两数 ${cast.params.n1}、${cast.params.n2}`);
      } else {
        // 旧数据（一数模式）兼容分支保留结构；原算式文案已按产品要求整体移除
      }
      break;
    case 'CHARACTER':
      if (cast.params.mode === 'TWO') {
        parts.push(
          cast.chars.map((c, i) => `「${c}」${cast.strokes[i]} 画`).join(' · '),
          `秒 ${cast.params.second}`,
        );
      } else {
        parts.push(`「${cast.chars[0]}」${cast.strokes[0]} 画`);
      }
      break;
    case 'RANDOM':
      parts.push('随机取数（模拟外应）');
      break;
  }
  return parts.join(' · ');
}
