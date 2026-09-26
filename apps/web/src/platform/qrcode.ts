/* ============================================================
 * 二维码生成 —— 「手机扫码打开本页」
 *
 * 用 qrcode-generator（Kazuhiko Arase，MIT，零传递依赖、约 12KB）出矩阵，
 * 再自己拼 SVG path —— 比库自带的 createSvgTag 好控：
 *   · 尺寸随容器缩放（viewBox + 一个 path，不是几百个 <rect>）
 *   · 横向合并相邻模块，DOM 体积减半
 *   · 前景色固定深色、背景固定白色：**二维码不跟随主题**
 *     （浅色模块 + 深底色也能被部分现代解码器识别，但失败率明显上升，
 *      而扫码失败对这个功能来说等于功能不存在）
 *
 * 只做 Byte 模式（UTF-8）：URL 用不到数字/字母数字的压缩，
 * 而 Byte 模式对任何字符都成立，省掉一套分支。
 * ============================================================ */

import qrcodeFactory from 'qrcode-generator';

/**
 * 库的默认 stringToBytes 是逐字符 `charCodeAt(i) & 0xff` —— 非 ASCII 直接截断。
 * 中文路径 / 中文查询串会被编成一堆错字节，扫码得到乱码。必须换成真 UTF-8。
 */
qrcodeFactory.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));

export type QrEcc = 'L' | 'M' | 'Q' | 'H';

export interface QrMatrix {
  /** 每边模块数（不含静区） */
  readonly moduleCount: number;
  /** 版本 1–40 */
  readonly version: number;
  isDark(row: number, col: number): boolean;
}

export interface QrSvg {
  /** 含静区的总边长（模块数） */
  readonly size: number;
  readonly moduleCount: number;
  readonly viewBox: string;
  /** 单个 <path> 的 d：所有深色模块合并后的路径 */
  readonly path: string;
}

/**
 * 生成二维码矩阵。
 * @param text 内容（按 UTF-8 编码）
 * @param ecc 纠错等级。默认 M（15%）：URL 不算长、又要应付屏幕反光与打印。
 */
export function qrMatrix(text: string, ecc: QrEcc = 'M'): QrMatrix {
  if (!text) throw new Error('二维码内容为空');

  // 0 = 自动选能装下的最小版本（库会按容量推上去）
  const qr = qrcodeFactory(0, ecc);
  qr.addData(text, 'Byte');
  qr.make();

  const moduleCount = qr.getModuleCount();
  return {
    moduleCount,
    // 每边模块数 = 17 + 4 × 版本
    version: (moduleCount - 17) >> 2,
    isDark: (row: number, col: number) => qr.isDark(row, col),
  };
}

/**
 * 生成可内联的 SVG 数据。
 * @param opts.margin 静区宽度（模块数）。二维码规范要求 ≥ 4，别改小。
 */
export function qrSvg(text: string, opts: { ecc?: QrEcc; margin?: number } = {}): QrSvg {
  const margin = opts.margin ?? 4;
  const m = qrMatrix(text, opts.ecc ?? 'M');

  // 横向合并相邻深色模块：一行里连续 n 个黑块写成 M x y h n v 1 h -n z
  let d = '';
  for (let row = 0; row < m.moduleCount; row += 1) {
    let runStart = -1;
    for (let col = 0; col <= m.moduleCount; col += 1) {
      const dark = col < m.moduleCount && m.isDark(row, col);
      if (dark && runStart < 0) runStart = col;
      else if (!dark && runStart >= 0) {
        const x = runStart + margin;
        const y = row + margin;
        const w = col - runStart;
        d += `M${x} ${y}h${w}v1h-${w}z`;
        runStart = -1;
      }
    }
  }

  const size = m.moduleCount + margin * 2;
  return { size, moduleCount: m.moduleCount, viewBox: `0 0 ${size} ${size}`, path: d };
}

/** 按缩放比例把矩阵栅格化成 RGBA（仅供测试：给解码器当输入） */
export function qrRgba(
  text: string,
  scale = 4,
  margin = 4,
  ecc: QrEcc = 'M',
): { data: Uint8ClampedArray; width: number; height: number } {
  const m = qrMatrix(text, ecc);
  const span = m.moduleCount + margin * 2;
  const width = span * scale;
  const height = span * scale;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const row = Math.floor(y / scale) - margin;
    for (let x = 0; x < width; x += 1) {
      const col = Math.floor(x / scale) - margin;
      const dark =
        row >= 0 && col >= 0 && row < m.moduleCount && col < m.moduleCount && m.isDark(row, col);
      const i = (y * width + x) * 4;
      const v = dark ? 0 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}
