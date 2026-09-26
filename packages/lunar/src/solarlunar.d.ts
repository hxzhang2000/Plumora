/**
 * solarlunar 无官方类型声明（npm 包为 UMD 构建，仅暴露 JS）。
 * 此处按实际返回结构声明所需字段子集。
 */
declare module 'solarlunar' {
  export interface SolarLunarResult {
    lYear: number;
    lMonth: number;
    lDay: number;
    animal: string;
    yearCn: string;
    monthCn: string;
    dayCn: string;
    cYear: number;
    cMonth: number;
    cDay: number;
    gzYear: string;
    gzMonth: string;
    gzDay: string;
    isToday: boolean;
    isLeap: boolean;
    nWeek: number;
    ncWeek: string;
    isTerm: boolean;
    term: string;
  }

  export function solar2lunar(year: number, month: number, day: number): SolarLunarResult | -1;
  export function lunar2solar(
    year: number,
    month: number,
    day: number,
    isLeapMonth?: boolean,
  ): SolarLunarResult | -1;

  /** 农历 y 年闰月是哪个月（1–12）；无闰月返回 0（越界/非整数年亦返回 0） */
  export function leapMonth(year: number): number;
  /** 农历 y 年闰月天数（29/30）；无闰月返回 0 */
  export function leapDays(year: number): number;
  /** 农历 y 年 m 月（非闰月）天数（29/30）；月份越界返回 -1 */
  export function monthDays(year: number, month: number): number;

  /**
   * 实际运行时导出为一个对象（UMD 构建的 module.exports 即该对象本体），
   * 下列方法均挂在其上；命名导出仅作类型层面的等价声明。
   */
  const _default: {
    solar2lunar: typeof solar2lunar;
    lunar2solar: typeof lunar2solar;
    leapMonth: typeof leapMonth;
    leapDays: typeof leapDays;
    monthDays: typeof monthDays;
  };
  export default _default;
}
