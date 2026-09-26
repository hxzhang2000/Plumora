/* ============================================================
 * 手机框预览（真机框）—— 纯计算部分
 *
 * 为什么要它：用户在宽屏上切到「手机形态」时，原先只是把内容收窄铺满窗口，
 * 看不出真机上的实际观感。预览态把应用装进一个 390 × 844 的手机框里
 * （机身 + 圆角 + 灵动岛 + Home 指示条），窗口不够高时整体等比缩小。
 *
 * 这里只放不依赖宿主的纯函数（可直接单测，见 test/device-frame.test.ts）；
 * 状态与 DOM 写入在 stores/deviceFrame.ts，样式在 styles/frame.css。
 *
 * 判据 <html data-device="phone"> 与 <html data-layout> 同一套路：
 * CSS 只认属性，「宽屏 + 手机形态」的判定收口在一处 JS。
 * ============================================================ */

/** 逻辑屏尺寸（CSS 像素）—— 近似 iPhone 14/15 的 390 × 844 */
export const FRAME_W = 390;
export const FRAME_H = 844;

/** 机身外的舞台留白：横向 = 两侧边框（约 14px）+ 呼吸；纵向再多留一点，机身上下更透气 */
const FRAME_PAD_X = 72;
const FRAME_PAD_Y = 96;

/** 窗口极小时的缩放下限：再小就只剩一个色块，不如保持可读的最小机身 */
const FRAME_MIN_SCALE = 0.4;

/**
 * 等比缩放系数（≤ 1）。
 *
 * 为什么不改机身尺寸去适配窗口：宽度一旦偏离 390，框内的断点/间距就不是
 * 真机的样子了。缩放只影响「看得见的大小」，框内仍按 390 逻辑像素排版。
 */
export function frameScale(viewW: number, viewH: number): number {
  const raw = Math.min(1, (viewW - FRAME_PAD_X) / FRAME_W, (viewH - FRAME_PAD_Y) / FRAME_H);
  // 保留 3 位小数，避免 --frame-scale 出现 0.782312097 这种写进内联样式的长串
  return Math.round(Math.max(FRAME_MIN_SCALE, raw) * 1000) / 1000;
}

/**
 * 是否该套上真机框：宽屏 + 手机形态，两个条件缺一不可。
 *
 * - 窄屏（真机 / 小窗）恒为 false → 真实手机永远拿到普通响应式布局，
 *   框只是桌面上的预览外壳（产品约束：不得给真手机套框）。
 * - 桌面形态为 false → 电脑模式下套框毫无意义，切形态时应自动退出。
 */
export function frameEligible(layout: 'desk' | 'mobile', wide: boolean): boolean {
  return wide && layout === 'mobile';
}
