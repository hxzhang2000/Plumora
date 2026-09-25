/* ============================================================
 * 农历转换端口（Port）—— 六边形架构的依赖倒置点
 *
 * 时间起卦需要「公历 → 农历」转换，但转换实现是平台相关的：
 *   Web     → @plumora/lunar（内置 solarlunar 数据表）
 *   Android → lunar-java（02 文档原选型）
 *
 * 故 core 只定义接口，由各端注入实现，core 自身保持零外部依赖。
 * ============================================================ */

/**
 * 农历日期（只保留起卦所需字段）
 *
 * ⚠️ **年支口径（重要）**：时间起卦的「年数 Y」一律取 **农历年**（以正月初一为年界）
 * 的地支序数，即 `yearBranchNoOf(lYear)`；**不使用** `gzYear`。
 * `gzYear` 是**立春为界**的干支纪年（命理派口径），与农历年在「正月初一 → 立春」
 * 之间每年约 13 天不一致。若标签取 gzYear、算法取 lYear，这 13 天里界面会写
 * 「丙午年」而实际按巳=6 计算，用户按标签手算必然对不上（同一卦两个答案）。
 *
 * 因此：**年支与干支年标签必须同源**，由 `packages/core/src/modulus.ts` 的
 * `yearBranchNoOf` / `ganzhiYearOf` 统一派生；`gzYear` 仅作原始数据保留。
 */
export interface LunarDate {
  /** 农历年（数字），如 2026 */
  readonly lYear: number;
  /**
   * 农历月 1–12（闰月按本月份数，03 文档 §6.1）。
   * 约定恒为正数；若某端实现（如 lunar-java）用负数表示闰月，须在适配层
   * 或 `castByTime` 内取绝对值后返回。
   */
  readonly lMonth: number;
  /** 农历日 1–30 */
  readonly lDay: number;
  /** 是否闰月 */
  readonly isLeap: boolean;
  /**
   * 年干支，如「丙午」。**立春为界**，仅供展示原始数据；
   * 起卦与起卦标签请改用 `ganzhiYearOf(lYear)`（见上方「年支口径」）。
   */
  readonly gzYear: string;
  /** 月中文名，如「八月」「闰四月」（**已含「闰」前缀**，调用方不要重复添加） */
  readonly monthCn: string;
  /** 日中文名，如「十五」 */
  readonly dayCn: string;
}

/** 农历转换提供者 */
export interface LunarProvider {
  /**
   * 公历 → 农历。
   * @returns 超出支持范围（一般 1900–2100）时返回 null
   */
  solar2lunar(year: number, month: number, day: number): LunarDate | null;
}

/** 农历转换失败（03 文档 §6 / FR-01 边界：转换失败时禁止起卦并提示） */
export class LunarConversionError extends Error {
  constructor(
    readonly year: number,
    readonly month: number,
    readonly day: number,
  ) {
    super(`农历转换失败：${year}-${month}-${day} 超出支持范围`);
    this.name = 'LunarConversionError';
  }
}
