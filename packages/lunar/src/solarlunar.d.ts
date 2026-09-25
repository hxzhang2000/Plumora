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

  const _default: {
    solar2lunar: typeof solar2lunar;
    lunar2solar: typeof lunar2solar;
  };
  export default _default;
}
