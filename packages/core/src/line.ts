/* ============================================================
 * 爻名命名规则 —— 对应 03 文档 §3.5
 *
 *   阳爻称「九」、阴爻称「六」；第 1 爻称「初」、第 6 爻称「上」；
 *   第 2–5 爻称「二 / 三 / 四 / 五」。
 * ============================================================ */

const MIDDLE_NAMES = ['', '', '二', '三', '四', '五'] as const;

/**
 * @param index 爻位 1–6（1 = 初爻，最下）
 * @param yang  是否为阳爻
 */
export function lineName(index: number, yang: boolean): string {
  if (index < 1 || index > 6 || !Number.isInteger(index)) {
    throw new Error(`爻位必须在 1–6 之间，实际 ${index}`);
  }
  const nine = yang ? '九' : '六';
  if (index === 1) return `初${nine}`;
  if (index === 6) return `上${nine}`;
  return `${nine}${MIDDLE_NAMES[index]}`;
}

/** 六爻（自下而上）→ 六个爻名 */
export function lineNames(lines: readonly number[]): string[] {
  return lines.map((v, i) => lineName(i + 1, v === 1));
}
