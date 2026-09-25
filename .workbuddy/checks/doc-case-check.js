/* 临时核对脚本：把 03/07 文档中的用例逐条对拍 core.js 实现 */
const C = require("D:/hxzhang/MyGithubSoftware/Plumora/docs/ui/build/core.js");
let pass = 0, fail = 0;
function T(name, actual, expect) {
  const a = JSON.stringify(actual), e = JSON.stringify(expect);
  if (a === e) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + "  actual=" + a + " expect=" + e); }
}
const T3 = (u, l, m) => C.TRIGRAMS[u].name + "/" + C.TRIGRAMS[l].name + "/" + m;

console.log("== 数字起卦 TC-N01..N04 ==");
T("TC-N01 3,8", T3(...[C.castByNumber(3, 8).upper, C.castByNumber(3, 8).lower, C.castByNumber(3, 8).moving]), "离/坤/5");
T("TC-N02 8,8", (() => { const r = C.castByNumber(8, 8); return T3(r.upper, r.lower, r.moving); })(), "坤/坤/4");
T("TC-N03 24,24", (() => { const r = C.castByNumber(24, 24); return T3(r.upper, r.lower, r.moving); })(), "坤/坤/6");
T("TC-N04 一数9+H7", (() => { const r = C.castByNumber(9, null, 7); return T3(r.upper, r.lower, r.moving); })(), "乾/坤/4");

console.log("== 汉字笔画 TC-C01..C06 ==");
T("TC-C01 梅11/花8 S=6", (() => { const r = C.castByCharacter(11, 8, 6, 7); return T3(r.upper, r.lower, r.moving); })(), "离/坤/1");
T("TC-C02 8/8 S=0", (() => { const r = C.castByCharacter(8, 8, 0, 7); return T3(r.upper, r.lower, r.moving); })(), "坤/坤/4");
T("TC-C03 一字16+H7", (() => { const r = C.castByCharacter(16, null, 0, 7); return T3(r.upper, r.lower, r.moving); })(), "坤/艮/5");
T("TC-C04 2/2 S=2", C.castByCharacter(2, 2, 2, 7).moving, 6);
T("TC-C05 1/1 S=59", C.castByCharacter(1, 1, 59, 7).moving, 1);
T("TC-C06 11/8 S=1", C.castByCharacter(11, 8, 1, 7).moving, 2);

console.log("== 声音 TC-S01 ==");
T("TC-S01 5,3", (() => { const r = C.castBySound(5, 3); return T3(r.upper, r.lower, r.moving); })(), "巽/离/2");

console.log("== 卦象推导 ==");
T("金标准A 坎上巽下动1", (() => { const r = C.resolve(6, 5, 1); return [r.ben.name, r.bian.name, r.hu.name, C.TRIGRAMS[r.ti].name + "体" + C.TRIGRAMS[r.yong].name + "用", r.judge.relation + "/" + r.judge.degree].join(" | "); })(),
  "水风井 | 水天需 | 火泽睽 | 坎体巽用 | 体生用/小凶");
T("金标准B 离上坤下动1", (() => { const r = C.resolve(3, 8, 1); return [r.ben.name, r.bian.name, r.hu.name, C.TRIGRAMS[r.ti].name + "体" + C.TRIGRAMS[r.yong].name + "用", r.judge.relation + "/" + r.judge.degree].join(" | "); })(),
  "火地晋 | 火雷噬嗑 | 水山蹇 | 离体坤用 | 体生用/小凶");
T("TC-H03 乾上乾下动1", (() => { const r = C.resolve(1, 1, 1); return r.bian.name + "/" + r.hu.name; })(), "天风姤/乾为天");
T("TC-H04 坤上坤下动6", (() => { const r = C.resolve(8, 8, 6); return r.bian.name + "/" + r.hu.name; })(), "山地剥/坤为地");
T("既济互未济", C.resolve(6, 3, 1).hu.name, "火水未济");

console.log("== 生克 TC-F01..F05 ==");
const J = (a, b) => C.judge(C.TRIGRAMS[a], C.TRIGRAMS[b]).relation + "/" + C.judge(C.TRIGRAMS[a], C.TRIGRAMS[b]).degree;
T("TC-F01 坎体/巽用", J(6, 5), "体生用/小凶");
T("TC-F02 巽体/坎用", J(5, 6), "用生体/大吉");
T("TC-F03 乾体/巽用", J(1, 5), "体克用/小吉");
T("TC-F04 巽体/乾用", J(5, 1), "用克体/大凶");
T("TC-F05 坎/坎", J(6, 6), "体用比和/吉");
T("TC-F07 上用下体 算例A", (() => { const r = C.resolve(6, 5, 1, "UPPER_YONG_LOWER_TI"); return C.TRIGRAMS[r.ti].name + "体" + C.TRIGRAMS[r.yong].name + "用 " + r.judge.relation + "/" + r.judge.degree; })(), "巽体坎用 用生体/大吉");

console.log("== 爻名 TC-LN01 ==");
const ln = C.resolve(4, 4, 1).lines; // 震上震下? 4=震 binary1 → lines[1,0,0]
T("TC-LN01 [1,0,0,1,0,0]", ln.map((v, i) => C.lineName(i + 1, v === 1)).join("、"), "初九、六二、六三、九四、六五、上六");

console.log("== 取余边界 TC-M1/M2 ==");
T("modTrigram", [C.modTrigram(8), C.modTrigram(16), C.modTrigram(9)], [8, 8, 1]);
T("modMoving", [C.modMoving(6), C.modMoving(12), C.modMoving(7)], [6, 6, 1]);
T("大数不溢出", C.castByNumber(999999999, 999999999).moving, C.modMoving(1999999998));

console.log("== 笔画表 TC-ST01..03 ==");
T("梅(繁)", C.STROKES["梅"].t, 11);
T("花(繁)", C.STROKES["花"].t, 8);
T("观/觀", [C.STROKES["观"].s, C.STROKES["观"].t], [6, 25]);

console.log("== 64 卦表完整性 ==");
const keys = Object.keys(C.HEX64);
T("64 条", keys.length, 64);
T("无重复名", new Set(keys.map(k => C.HEX64[k][0])).size, 64);
const bad = keys.filter(k => { const [u, l] = k.split("-").map(Number); const bits = C.trigramLines(l).concat(C.trigramLines(u)); const bin = bits.reduce((s, v, i) => s + v * Math.pow(2, i), 0); return C.HEX64[k][0] === ""; });
T("全部有名", bad.length, 0);
// 关键词条数：05 文档 §3.4 规则 4 定为 1–5（水火既济原文仅 1 词）
const kwCount = keys.map(k => [C.HEX64[k][0], C.HEX64[k][1].split("、").length]).filter(x => x[1] < 1 || x[1] > 5);
console.log("  关键词条数越界(应 1-5):", JSON.stringify(kwCount));

console.log("\n====", pass + " pass, " + fail + " fail");
