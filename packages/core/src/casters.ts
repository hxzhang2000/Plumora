/* ============================================================
 * 五种起卦方法 —— 对应 03 文档 §二
 *   §2.1 时间起卦  §2.2 数字起卦  §2.3 汉字笔画起卦  §2.4 声音起卦  §2.5 随机起卦
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
  type SoundCast,
  type TimeCast,
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
 * 动爻 = 同上之和 mod 6，余 0 取 6
 *
 * 入参一律要求**整数**：非整数若被静默接受，`params` 会记录 15.5 这类脏值，
 * 而 `modTrigram` 内部 `Math.trunc` 却按 15 计算 —— 展示的中间量与真实结果不符。
 */
export function castByTimeParts(
  yearBranchNo: number,
  lunarMonth: number,
  lunarDay: number,
  hourNo: number,
  opts: { shifted?: boolean; label?: string } = {},
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
  const s1 = yearBranchNo + lunarMonth + lunarDay;
  const s2 = s1 + hourNo;
  return {
    method: 'TIME',
    upper: modTrigram(s1),
    lower: modTrigram(s2),
    moving: modMoving(s2),
    label: opts.label ?? '',
    params: { yearBranchNo, lunarMonth, lunarDay, hourNo, s1, s2, shifted: opts.shifted ?? false },
  };
}

/**
 * 时间起卦（日历入口）。
 * 晚子时（23:00 后）按**次日**日数与子时起卦（03 文档 §6.2）。
 */
export function castByTime(date: Date, lunar: LunarProvider): TimeCast {
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
    // 干支年**必须与 yearBranchNo 同源**（均由 lYear 派生）。
    // 若此处改用 lu.gzYear（立春为界的干支年），每年「正月初一 → 立春」约 13 天里
    // 标签与算法会互相矛盾：界面写「丙午年」而实际按巳=6 计算，用户手算必然对不上。
    // monthCn 已含「闰」前缀（如「闰四月」），此处不再拼接，避免出现「闰闰四月」
    label: `${ganzhiYearOf(lu.lYear)}年 ${lu.monthCn}${lu.dayCn} ${hourBranchName(hourNo)}时`,
  });
}

/* ------------------------------------------------------------------
 * §2.2 数字起卦
 * ------------------------------------------------------------------ */

/**
 * 数字起卦。
 * @param n1 第一数（上卦）
 * @param n2 第二数（下卦）；传 null/undefined 走「一数模式」
 * @param hourNo 一数模式所需的当前时辰序数（1–12）
 */
export function castByNumber(n1: number, n2?: number | null, hourNo?: number): NumberCast {
  if (!isValidNumber(n1)) {
    throw new CastInputError(`第一数无效：${n1}（须为 1–${NUMBER_MAX} 的整数，0 无效）`);
  }

  if (n2 == null) {
    if (hourNo == null || !Number.isInteger(hourNo) || hourNo < 1 || hourNo > 12) {
      throw new CastInputError(`一数模式需要有效的时辰序数（1–12 的整数），实际 ${hourNo}`);
    }
    const s = n1 + hourNo;
    return {
      method: 'NUMBER',
      upper: modTrigram(n1),
      lower: modTrigram(s),
      moving: modMoving(s),
      params: { mode: 'ONE', n1, hourNo, sum: s },
    };
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
 * §2.3 汉字笔画起卦
 * ------------------------------------------------------------------ */

export interface CharacterCastInput {
  /** 两字模式传 [A, B]，一字模式传 [T] */
  readonly strokes: readonly number[];
  readonly chars: readonly string[];
  readonly standard: StrokeStandard;
  /** 起卦瞬间秒钟数 0–59（仅两字模式参与动爻，03 文档 §6.5） */
  readonly second?: number;
  /** 一字模式所需的时辰序数（1–12） */
  readonly hourNo?: number;
}

/**
 * 汉字笔画起卦。
 *
 * 两字：upper = A mod 8；lower = B mod 8；moving = (A + B + 秒) mod 6
 * 一字：upper = T mod 8；lower = (T + 时) mod 8；moving = (T + 时) mod 6（**不加秒**）
 */
export function castByCharacter(input: CharacterCastInput): CharacterCast {
  const { strokes, chars, standard, second, hourNo } = input;

  // chars 与 strokes 必须一一对应：不等长时字会静默丢失（`{strokes:[11,8],chars:['梅']}`
  // 会丢掉第二字）或渲染出「undefined 16 画」（`{strokes:[16],chars:[]}`）。
  if (chars.length !== strokes.length) {
    throw new CastInputError(
      `汉字数与笔画数必须一一对应：${chars.length} 个字 / ${strokes.length} 个笔画`,
    );
  }
  if (chars.length === 0) {
    throw new CastInputError('至少需要一个汉字');
  }
  if (chars.length > 2) {
    throw new CastInputError(`汉字数须为 1 个（一字）或 2 个（两字），实际 ${chars.length}`);
  }

  if (strokes.length === 1) {
    // 一字模式（03 文档 §6.5：不追加秒钟数）
    const t = strokes[0];
    if (!Number.isInteger(t) || t < 1) throw new CastInputError(`笔画数无效：${t}`);
    if (hourNo == null || !Number.isInteger(hourNo) || hourNo < 1 || hourNo > 12) {
      throw new CastInputError(`一字模式需要有效的时辰序数（1–12 的整数），实际 ${hourNo}`);
    }
    const s = t + hourNo;
    return {
      method: 'CHARACTER',
      chars: [...chars],
      strokes: [...strokes],
      standard,
      upper: modTrigram(t),
      lower: modTrigram(s),
      moving: modMoving(s),
      params: { mode: 'ONE', strokes: [...strokes], hourNo, sum: s },
    };
  }

  if (strokes.length !== 2) {
    throw new CastInputError(`笔画数须为 1 个（一字）或 2 个（两字），实际 ${strokes.length}`);
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
 * §2.4 声音（点数）起卦
 * ------------------------------------------------------------------ */

/** 单组计数上限（FR-04 边界） */
export const SOUND_COUNT_MAX = 999;

export function castBySound(count1: number, count2: number): SoundCast {
  for (const [label, v] of [
    ['上卦组', count1],
    ['下卦组', count2],
  ] as const) {
    if (!Number.isInteger(v) || v < 1 || v > SOUND_COUNT_MAX) {
      throw new CastInputError(`${label}点数无效：${v}（须为 1–${SOUND_COUNT_MAX} 的整数）`);
    }
  }
  const sum = count1 + count2;
  return {
    method: 'SOUND',
    upper: modTrigram(count1),
    lower: modTrigram(count2),
    moving: modMoving(sum),
    params: { count1, count2, sum },
  };
}

/* ------------------------------------------------------------------
 * §2.5 随机起卦（P2，模拟「外应」）
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

/** 随机起卦：上卦 1–8、下卦 1–8、动爻 1–6（03 文档 §2.5） */
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
    case 'SOUND':
      return { type: 'SOUND', count1: cast.params.count1, count2: cast.params.count2 };
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
      parts.push(
        `年支${cast.params.yearBranchNo}＋月${cast.params.lunarMonth}＋日${cast.params.lunarDay}＝${cast.params.s1}`,
        `＋时${cast.params.hourNo}＝${cast.params.s2}`,
      );
      break;
    case 'NUMBER':
      if (cast.params.mode === 'TWO') {
        parts.push(
          `两数 ${cast.params.n1}、${cast.params.n2}`,
          `和 ${cast.params.sum} → 动爻取 ${cast.moving}`,
        );
      } else {
        parts.push(
          `一数 ${cast.params.n1} ＋ 时辰 ${cast.params.hourNo}`,
          `和 ${cast.params.sum} → 动爻取 ${cast.moving}`,
        );
      }
      break;
    case 'CHARACTER':
      if (cast.params.mode === 'TWO') {
        parts.push(
          cast.chars.map((c, i) => `「${c}」${cast.strokes[i]} 画`).join(' · '),
          `秒 ${cast.params.second}`,
          `和 ${cast.params.sum} → 动爻取 ${cast.moving}`,
        );
      } else {
        parts.push(
          `「${cast.chars[0]}」${cast.strokes[0]} 画`,
          `＋时辰 ${cast.params.hourNo}`,
          `和 ${cast.params.sum} → 动爻取 ${cast.moving}`,
        );
      }
      break;
    case 'SOUND':
      parts.push(
        `点数 ${cast.params.count1}、${cast.params.count2}`,
        `和 ${cast.params.sum} → 动爻取 ${cast.moving}`,
      );
      break;
    case 'RANDOM':
      parts.push('随机取数（模拟外应）');
      break;
  }
  return parts.join(' · ');
}
