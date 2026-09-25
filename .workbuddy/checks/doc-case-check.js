/* ============================================================
 * 文档用例 → 交付实现对拍
 *
 * 对拍对象：**packages/core + packages/knowledge**（交付实现），
 *          不再是 docs/ui/build/core.js（UI 原型）——见代码审查 D-4。
 *          原实现只对拍原型，改 packages/core 或改文档时脚本不报警。
 *
 * 运行：node .workbuddy/checks/doc-case-check.js
 * 期望：全部通过、0 失败
 *
 * 分组：
 *   A. 03/07 文档的用例逐条对拍交付实现（数字/汉字/声音起卦、卦象推导、
 *      生克、爻名、取余边界、笔画表、**农历口径**、64 卦表完整性）
 *   B. 原型 docs/ui/build/core.js ↔ 交付实现 交叉一致性
 *      （D-1「原型闰闰六月」就是这条缺失导致的：改了 packages/core 忘了同步原型）
 *
 * 其中「农历口径」一组是 D-1 的补课：闰月与年界这两处判定落在 packages/lunar，
 * 只对拍 core 会让它们永远无人核对。
 * ============================================================ */

const path = require('node:path');
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
/** 交付实现用枚举（TI_SHENG_YONG / XIAO_XIONG），文档与原型用中文 —— 比对前统一成中文 */
const relCn = (r) => C.RELATION_CN[r.relation] + '/' + C.DEGREE_CN[r.degree];
/** 汉字起卦：以笔画驱动，字面用占位汉字（core 只校验「是汉字」） */
const byChar = (strokes, extra) =>
  C.castByCharacter({
    strokes,
    chars: strokes.map((_, i) => ['梅', '花', '井'][i] ?? '梅'),
    standard: 'SIMPLIFIED',
    ...extra,
  });

console.log('== A. 文档用例 → 交付实现（packages/core）==');

console.log('-- 数字起卦 TC-N01..N04 --');
T('TC-N01 3,8', cast3(C.castByNumber(3, 8)), '离/坤/5');
T('TC-N02 8,8', cast3(C.castByNumber(8, 8)), '坤/坤/4');
T('TC-N03 24,24', cast3(C.castByNumber(24, 24)), '坤/坤/6');
T('TC-N04 一数9+H7', cast3(C.castByNumber(9, null, 7)), '乾/坤/4');

console.log('-- 汉字笔画 TC-C01..C06 --');
T('TC-C01 梅11/花8 S=6', cast3(byChar([11, 8], { second: 6 })), '离/坤/1');
T('TC-C02 8/8 S=0', cast3(byChar([8, 8], { second: 0 })), '坤/坤/4');
T('TC-C03 一字16+H7', cast3(byChar([16], { hourNo: 7 })), '坤/艮/5');
T('TC-C04 2/2 S=2', byChar([2, 2], { second: 2 }).moving, 6);
T('TC-C05 1/1 S=59', byChar([1, 1], { second: 59 }).moving, 1);
T('TC-C06 11/8 S=1', byChar([11, 8], { second: 1 }).moving, 2);

console.log('-- 声音 TC-S01 --');
T('TC-S01 5,3', cast3(C.castBySound(5, 3)), '巽/离/2');

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

console.log('\n== B. 原型 docs/ui/build/core.js ↔ 交付实现 交叉一致性 ==');
console.log('   （原型是演示产物，但「改了 packages/core 忘了同步原型」会让演示说谎）');

let P;
try {
  P = require(path.join(__dirname, '..', '..', 'docs/ui/build/core.js'));
} catch (e) {
  P = null;
  console.log('  FAIL 原型 core.js 加载失败：' + e.message);
  fail++;
}

if (P) {
  // ① 64 卦：名字与关键词逐条一致
  const pKeys = Object.keys(P.HEX64).sort();
  T('原型 HEX64 键集合与交付一致', pKeys, codes.slice().sort());
  const kwDiff = codes.filter(
    (c) => (P.HEX64[c] ? P.HEX64[c][1] : '') !== K.HEXAGRAMS[c].keywords.join('、'),
  );
  T('原型 64 卦关键词与交付逐条一致', kwDiff, []);

  // ② 八卦：名称一致
  T(
    '原型 TRIGRAMS 名称与交付一致',
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => P.TRIGRAMS[n].name),
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => K.TRIGRAMS[n].name),
  );

  // ③ 笔画表：键集合与 s/t 数值一致（D-1 那类漂移最容易藏在数据表里）
  const pStroke = Object.keys(P.STROKES).sort();
  T('原型笔画表键集合与交付一致', pStroke, Object.keys(K.STROKES).sort());
  const strokeDiff = Object.keys(K.STROKES).filter(
    (ch) => !P.STROKES[ch] || P.STROKES[ch].s !== K.STROKES[ch].s || P.STROKES[ch].t !== K.STROKES[ch].t,
  );
  T('原型笔画数值与交付逐字一致', strokeDiff, []);

  // ④ 生克 summary 文案一致（D-10 的漂移点）
  const rels = [
    [6, 6],
    [6, 5],
    [5, 6],
    [1, 5],
    [5, 1],
  ];
  T(
    '原型生克 summary 文案与交付一致',
    rels.map(([a, b]) => P.judge(P.TRIGRAMS[a], P.TRIGRAMS[b]).summary),
    rels.map(([a, b]) => C.judge(K.trigram(a), K.trigram(b)).summary),
  );

  // ⑤ 卦象推导结果一致（含互卦口径）
  const pRes = (u, l, m) => {
    const r = P.resolve(u, l, m);
    return [r.ben.name, r.hu.name, r.bian.name].join('|');
  };
  const cRes = (u, l, m) => {
    const r = C.resolve(u, l, m);
    return [r.ben.name, r.hu.name, r.bian.name].join('|');
  };
  T(
    '原型 8 组卦象推导与交付一致',
    [
      [6, 5, 1],
      [3, 8, 1],
      [1, 1, 1],
      [8, 8, 6],
      [6, 3, 1],
      [4, 4, 1],
      [2, 2, 6],
      [7, 7, 3],
    ].map(([u, l, m]) => pRes(u, l, m)),
    [
      [6, 5, 1],
      [3, 8, 1],
      [1, 1, 1],
      [8, 8, 6],
      [6, 3, 1],
      [4, 4, 1],
      [2, 2, 6],
      [7, 7, 3],
    ].map(([u, l, m]) => cRes(u, l, m)),
  );
}

console.log('\n====', pass + ' pass, ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
