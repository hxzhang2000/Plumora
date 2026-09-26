/* ============================================================
 * 文档用例 → 交付实现对拍
 *
 * 对拍对象：**packages/core + packages/knowledge**（交付实现）——见代码审查 D-4。
 *          早先版本曾对拍 UI 原型，改 packages/core 或改文档时脚本不报警；
 *          原型（docs/ui）已随定稿删除，现只对拍交付实现。
 *
 * 运行：node .workbuddy/checks/doc-case-check.js
 * 期望：全部通过、0 失败
 *
 * 分组：
 *   A. 03/07 文档的用例逐条对拍交付实现（数字/汉字起卦、卦象推导、
 *      生克、爻名、取余边界、笔画表、**农历口径**、64 卦表完整性）
 *
 * 其中「农历口径」一组是 D-1 的补课：闰月与年界这两处判定落在 packages/lunar，
 * 只对拍 core 会让它们永远无人核对。
 * ============================================================ */

const { core: C, knowledge: K } = require('./load-delivery.cjs');

let pass = 0;
let fail = 0;

function T(name, actual, expect) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expect);
  if (a === e) {
    pass++;
    console.log('  ok   ' + name);
  } else {
    fail++;
    console.log('  FAIL ' + name + '  actual=' + a + ' expect=' + e);
  }
}

const T3 = (u, l, m) => K.TRIGRAMS[u].name + '/' + K.TRIGRAMS[l].name + '/' + m;
const cast3 = (r) => T3(r.upper, r.lower, r.moving);
/** 交付实现用枚举（TI_SHENG_YONG / XIAO_XIONG），文档用中文 —— 比对前统一成中文 */
const relCn = (r) => C.RELATION_CN[r.relation] + '/' + C.DEGREE_CN[r.degree];
/** 汉字起卦：以笔画驱动，字面用占位汉字（core 只校验「是汉字」） */
const byChar = (strokes, extra) =>
  C.castByCharacter({
    strokes,
    chars: strokes.map((_, i) => ['梅', '花', '井'][i] ?? '梅'),
    standard: 'SIMPLIFIED',
    ...extra,
  });

/** 执行并返回抛出的异常（未抛则返回 undefined）——用于断言「已移除的模式 → CastInputError」 */
const castErr = (fn) => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e;
  }
};

console.log('== A. 文档用例 → 交付实现（packages/core）==');

console.log('-- 数字起卦 TC-N01..N04 --');
T('TC-N01 3,8', cast3(C.castByNumber(3, 8)), '离/坤/5');
T('TC-N02 8,8', cast3(C.castByNumber(8, 8)), '坤/坤/4');
T('TC-N03 24,24', cast3(C.castByNumber(24, 24)), '坤/坤/6');
// 一数模式已移除（07 TC-N04 新语义）：第二数缺失 → CastInputError，且拒绝原因可读
T('TC-N04 一数起卦已移除：第二数缺失抛 CastInputError', castErr(() => C.castByNumber(9, null, 7))?.name, 'CastInputError');
T('TC-N04 拒绝原因含「第二数无效」', /第二数无效/.test(castErr(() => C.castByNumber(9, undefined))?.message ?? ''), true);

console.log('-- 汉字笔画 TC-C01..C06 --');
T('TC-C01 梅11/花8 S=6', cast3(byChar([11, 8], { second: 6 })), '离/坤/1');
T('TC-C02 8/8 S=0', cast3(byChar([8, 8], { second: 0 })), '坤/坤/4');
// 一字模式已移除（07 TC-C03 新语义）：单字输入 → CastInputError，且拒绝原因可读
T('TC-C03 一字起卦已移除：单字输入抛 CastInputError', castErr(() => byChar([16]))?.name, 'CastInputError');
T('TC-C03 拒绝原因含「汉字数须为 2 个」', /汉字数须为 2 个/.test(castErr(() => byChar([16], { chars: ['甲'] }))?.message ?? ''), true);
T('TC-C04 2/2 S=2', byChar([2, 2], { second: 2 }).moving, 6);
T('TC-C05 1/1 S=59', byChar([1, 1], { second: 59 }).moving, 1);
T('TC-C06 11/8 S=1', byChar([11, 8], { second: 1 }).moving, 2);

console.log('-- 起卦方式下线后的兜底（07 TC-M01：旧记录不得渲染出 undefined）--');
T('TC-M01 在册方式照常返回中文', [C.methodCn('TIME'), C.methodCn('RANDOM')], ['时间起卦', '随机起卦']);
T('TC-M01 已下线的 SOUND 回退「其他方式」', C.methodCn('SOUND'), '其他方式');
T('TC-M01 METHOD_CN 里确无 SOUND 键', 'SOUND' in C.METHOD_CN, false);
T(
  'TC-M01 旧 SOUND 记录的派生名称不含 undefined',
  C.recordTitle({ question: null, benGuaName: '', method: 'SOUND', lunarLabel: '丙午年 八月十五' }),
  '丙午年 八月十五',
);

console.log('-- 卦象推导（含金标准 A/B）--');
const trio = (u, l, m, rule) => {
  const r = C.resolve(u, l, m, rule);
  return [
    r.ben.name,
    r.bian.name,
    r.hu.name,
    K.TRIGRAMS[r.ti].name + '体' + K.TRIGRAMS[r.yong].name + '用',
    relCn(r.judge),
  ].join(' | ');
};
T('金标准A 坎上巽下动1', trio(6, 5, 1), '水风井 | 水天需 | 火泽睽 | 坎体巽用 | 体生用/小凶');
T('金标准B 离上坤下动1', trio(3, 8, 1), '火地晋 | 火雷噬嗑 | 水山蹇 | 离体坤用 | 体生用/小凶');
T(
  'TC-H03 乾上乾下动1',
  (() => {
    const r = C.resolve(1, 1, 1);
    return r.bian.name + '/' + r.hu.name;
  })(),
  '天风姤/乾为天',
);
T(
  'TC-H04 坤上坤下动6',
  (() => {
    const r = C.resolve(8, 8, 6);
    return r.bian.name + '/' + r.hu.name;
  })(),
  '山地剥/坤为地',
);
T('既济互未济（互卦口径验证）', C.resolve(6, 3, 1).hu.name, '火水未济');

console.log('-- 生克 TC-F01..F05 / F07 --');
const J = (a, b) => relCn(C.judge(K.trigram(a), K.trigram(b)));
T('TC-F01 坎体/巽用', J(6, 5), '体生用/小凶');
T('TC-F02 巽体/坎用', J(5, 6), '用生体/大吉');
T('TC-F03 乾体/巽用', J(1, 5), '体克用/小吉');
T('TC-F04 巽体/乾用', J(5, 1), '用克体/大凶');
T('TC-F05 坎/坎', J(6, 6), '体用比和/吉');
T(
  'TC-F07 上用下体 算例A',
  (() => {
    const r = C.resolve(6, 5, 1, 'UPPER_YONG_LOWER_TI');
    return K.TRIGRAMS[r.ti].name + '体' + K.TRIGRAMS[r.yong].name + '用 ' + relCn(r.judge);
  })(),
  '巽体坎用 用生体/大吉',
);
T('TC-F06 25 组合穷举条数', C.judgeMatrix().length, 25);

console.log('-- 爻名 TC-LN01 --');
T(
  'TC-LN01 震为雷六爻爻名',
  C.resolve(4, 4, 1)
    .lines.map((v, i) => C.lineName(i + 1, v === 1))
    .join('、'),
  '初九、六二、六三、九四、六五、上六',
);

console.log('-- 取余边界 TC-M1/M2 --');
T('modTrigram', [C.modTrigram(8), C.modTrigram(16), C.modTrigram(9)], [8, 8, 1]);
T('modMoving', [C.modMoving(6), C.modMoving(12), C.modMoving(7)], [6, 6, 1]);
T('大数不溢出', C.castByNumber(999999999, 999999999).moving, C.modMoving(1999999998));

console.log('-- 笔画表 TC-ST01..03 --');
T('梅(繁)', K.STROKES['梅'].t, 11);
T('花(繁)', K.STROKES['花'].t, 8);
T('观/觀', [K.STROKES['观'].s, K.STROKES['观'].t], [6, 25]);
T('繁体字面经别名表归一', K.lookupStrokes('觀', 'TRADITIONAL').strokes, 25);

console.log('-- 农历口径 TC-LC01 / LC02 / LC06 / LC07（D-1 / C-1 的漂移点）--');
{
  const L = require('./load-delivery.cjs').lunar;
  const at = (y, m, d) => L.lunarAt(new Date(y, m - 1, d));
  const label = (y, m, d) => L.lunarLabelOf(new Date(y, m - 1, d));

  // TC-LC01 金标准：2026-09-25 = 丙午年 八月十五
  T('TC-LC01 2026-09-25 金标准', label(2026, 9, 25), '丙午年 八月十五');

  // TC-LC02 闰月按**本月份数**（不是 7、不是 6.5），且 isLeap 为真
  const leap = at(2025, 8, 1);
  T('TC-LC02 2025-08-01 lMonth 为本月份数', leap.lMonth, 6);
  T('TC-LC02 isLeap', leap.isLeap, true);
  T('TC-LC02 monthCn', leap.monthCn, '闰六月');

  // TC-LC06 闰月口径三连：与本月同月数、靠 isLeap 区分、lMonth 恒正、月名「闰」恰 1 次
  const base = at(2025, 7, 1); // 闰六月所属的六月
  T('TC-LC06 闰月与本月同月数', [leap.lMonth, base.lMonth], [6, 6]);
  T('TC-LC06 靠 isLeap 区分', [leap.isLeap, base.isLeap], [true, false]);
  T('TC-LC06 lMonth 恒为正', leap.lMonth > 0, true);
  const countRun = (s) => (s.match(/闰/g) ?? []).length;
  T('TC-LC06 闰月月名「闰」恰 1 次', countRun(leap.monthCn), 1);
  T('TC-LC06 非闰月月名不含「闰」', countRun(base.monthCn), 0);
  // D-1 本体：整条标签不得出现「闰闰」（monthCn 已含前缀，调用方不得再拼一次）
  T('D-1 闰月标签不含「闰闰」', label(2025, 8, 1).includes('闰闰'), false);
  T('D-1 闰月标签', label(2025, 8, 1), '乙巳年 闰六月初八');

  // TC-LC07 年界取农历年（正月初一为界），标签干支年与算法年支**同源**
  T('TC-LC07 2026-02-10 标签取农历年', label(2026, 2, 10), '乙巳年 腊月廿三');
  T('TC-LC07 2025-01-29 正月初一', label(2025, 1, 29), '乙巳年 正月初一');
  T(
    'TC-LC07 标签干支年与算法年支同源',
    [at(2026, 2, 10), at(2026, 9, 25)].map((lu) =>
      C.ganzhiYearOf(lu.lYear) + '/' + C.yearBranchNoOf(lu.lYear),
    ),
    ['乙巳/6', '丙午/7'],
  );
}

console.log('-- 64 卦表完整性 --');
const codes = Object.keys(K.HEXAGRAMS);
T('64 条', codes.length, 64);
T('卦代码均为两位段', codes.every((c) => /^\d{2}-\d{2}$/.test(c)), true);
T('无重复名', new Set(codes.map((c) => K.HEXAGRAMS[c].name)).size, 64);
T('全部有名', codes.filter((c) => !K.HEXAGRAMS[c].name).length, 0);
const kwBad = codes
  .map((c) => [K.HEXAGRAMS[c].name, K.HEXAGRAMS[c].keywords.length])
  .filter((x) => x[1] < 1 || x[1] > 5);
T('关键词条数均在 1–5（05 §3.4 规则 4）', kwBad, []);
T('知识库自检无问题', K.validateKnowledgeBase(), []);

/* ------------------------------------------------------------------ */

console.log('\n====', pass + ' pass, ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
