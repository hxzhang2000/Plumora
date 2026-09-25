/* ============================================================
 * @plumora/core —— 观梅 · Plumora 起卦核心算法
 *
 * 平台无关纯逻辑（仅依赖 @plumora/knowledge 的数据），无 DOM / Node / 框架依赖。
 * 规则来源：docs/dev/03-起卦核心算法设计.md v1.4，实现逐条对照。
 *
 * 农历转换通过 LunarProvider 端口注入（见 ./lunar.ts），
 * Web 端实现为 @plumora/lunar，Android 端可换 lunar-java。
 * ============================================================ */

export {
  modTrigram,
  modMoving,
  hourNumber,
  hourBranchName,
  yearBranchNoOf,
  ganzhiYearOf,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  NUMBER_MAX,
  isValidNumber,
} from './modulus.js';

export {
  judge,
  judgeElements,
  judgeMatrix,
  generates,
  overcomes,
  elementCn,
} from './judge.js';

export { lineName, lineNames } from './line.js';

export { resolve, resolveFromLines, huLines, changedOf, binaryToLines } from './resolve.js';

export {
  castByTime,
  castByTimeParts,
  castByNumber,
  castByCharacter,
  castBySound,
  castByRandom,
  inputParamsOf,
  castContext,
  CastInputError,
  SOUND_COUNT_MAX,
} from './casters.js';
export type { CharacterCastInput, RandomSource } from './casters.js';

export { LunarConversionError } from './lunar.js';
export type { LunarDate, LunarProvider } from './lunar.js';

export {
  VERIFY_STATUS_CN,
  VERIFY_STATUS_LIST,
  RECORD_TITLE_FALLBACK,
  recordTitle,
  buildRecord,
  replayRecord,
} from './record.js';
export type { VerifyStatus, HexagramRecord, NewHexagramRecord, BuildRecordInput } from './record.js';

export {
  RELATION_CN,
  DEGREE_CN,
  METHOD_CN,
} from './types.js';
export type {
  CastMethod,
  CastResult,
  TimeCast,
  NumberCast,
  CharacterCast,
  SoundCast,
  RandomCast,
  TimeCastParams,
  NumberCastParams,
  CharacterCastParams,
  SoundCastParams,
  RandomCastParams,
  InputParams,
  JudgeResult,
  ResolvedHexagram,
  TiYongRule,
  Relation,
  FortuneDegree,
} from './types.js';
