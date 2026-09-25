/* ============================================================
 * 观梅 · Plumora — 起卦核心算法（与 docs/dev/03-起卦核心算法设计.md v1.5 对应）
 * 可在 Node（module.exports）与浏览器（window.GMCore）双环境运行
 * ============================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GMCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- 八卦基础（先天八卦数 1-8；binary 下爻为 bit0） ---------- */
  var TRIGRAMS = {
    1: { name: "乾", symbol: "乾", binary: 7, element: "金", nature: "刚健", family: "父", weather: "天、冰、雹", figures: "君、父、老人、领导", geo: "京都、大郡、形胜之地、高亢之所", body: "首、骨、肺", animals: "马、天鹅、狮、象", objects: "金玉、宝珠、圆物、木果、冠", affairs: "刚健、果决、多动少静", dir: "西北", season: "秋、九十月之交" },
    2: { name: "兑", symbol: "兑", binary: 3, element: "金", nature: "悦", family: "少女", weather: "雨泽、新月、星", figures: "少女、妾、歌伎、伶人", geo: "泽、水际、缺池、废井", body: "舌、口、肺", animals: "羊、泽中之物", objects: "金刃、乐器、缺口之物", affairs: "喜悦、口舌、饮食", dir: "西", season: "秋" },
    3: { name: "离", symbol: "离", binary: 5, element: "火", nature: "丽", family: "中女", weather: "电、虹、霞、日", figures: "中女、文人、大腹人", geo: "南方、干亢之地、窑炉", body: "目、心、上焦", animals: "雉、龟、鳖、蟹、螺、蚌", objects: "书文、甲胄、干燥之物、彩色之物", affairs: "聪明、文明、虚心", dir: "南", season: "夏五月" },
    4: { name: "震", symbol: "震", binary: 1, element: "木", nature: "动", family: "长男", weather: "雷", figures: "长男", geo: "东方、树木、闹市、大途、竹林", body: "足、肝、发", animals: "龙、蛇、虫", objects: "木竹、乐器（属木者）、花草", affairs: "动、惊恐、奋进", dir: "东", season: "春三月" },
    5: { name: "巽", symbol: "巽", binary: 6, element: "木", nature: "入", family: "长女", weather: "风", figures: "长女、秀士、寡妇、僧道", geo: "东南方、草木茂秀之地、花果菜园", body: "股、肱、气", animals: "鸡、百禽", objects: "木香、绳、直物、竹木工巧之器", affairs: "进入、进退不果、文书", dir: "东南", season: "春夏之交" },
    6: { name: "坎", symbol: "坎", binary: 2, element: "水", nature: "陷", family: "中男", weather: "雨、月、雪、霜、露", figures: "中男、江湖人、舟人", geo: "北方、江湖、溪涧、泉井、卑湿之地", body: "耳、血、肾、腰", animals: "豕、鱼、水族", objects: "酒、水具、有核之物、丛棘", affairs: "险陷、隐伏、智谋", dir: "北", season: "冬十一月" },
    7: { name: "艮", symbol: "艮", binary: 4, element: "土", nature: "止", family: "少男", weather: "云、雾、山岚", figures: "少男、闲人、山中人、童子", geo: "东北方、山径、丘陵、坟墓", body: "手、指、骨、鼻、背", animals: "虎、狗、鼠、百兽", objects: "山路、石阶、土堆、门限", affairs: "阻止、静、笃实、保守", dir: "东北", season: "冬春之交" },
    8: { name: "坤", symbol: "坤", binary: 0, element: "土", nature: "顺", family: "母", weather: "阴云、雾气、冰霜", figures: "母、老妇、农夫、众人", geo: "田野、乡里、平地、西南方", body: "腹、脾、肉、胃", animals: "牛、百兽、牝马", objects: "布帛、丝绵、五谷、瓦器、柔韧之物", affairs: "柔顺、包容、众多、安静", dir: "西南", season: "辰戌丑未月、六七八月" }
  };

  /* ---------- 六十四卦：key = "上卦数-下卦数"（两段各两位，不足补零）→ [卦名, 卦意关键词（人工校对口径 2026-09-25）] ---------- */
  var HEX64 = {
    "01-01": ["乾为天", "刚健、为天、为君主"], "01-02": ["天泽履", "履行、践行、礼貌、礼节"], "01-03": ["天火同人", "同行、同我一起、集结一起"], "01-04": ["天雷无妄", "不要妄想、不要妄念"], "01-05": ["天风姤", "相遇、邂逅、遇见"], "01-06": ["天水讼", "争斗、争讼、官非"], "01-07": ["天山遁", "遁走、潜藏、退走、消退"], "01-08": ["天地否", "不通、阻隔、闭塞"],
    "02-01": ["泽天夬", "决断、决策、奇怪"], "02-02": ["兑为泽", "喜悦、取悦、口舌"], "02-03": ["泽火革", "变革、改变"], "02-04": ["泽雷随", "跟从、跟随"], "02-05": ["泽风大过", "大的过分、过度、过错、不一般的行动"], "02-06": ["泽水困", "穷困、困境、困难"], "02-07": ["泽山咸", "威即感、感应、感情、夫妇之道"], "02-08": ["泽地萃", "聚集、汇聚、提炼"],
    "03-01": ["火天大有", "收获很大、收益很多"], "03-02": ["火泽睽", "睽违、离开、争吵"], "03-03": ["离为火", "明丽、美丽、依附"], "03-04": ["火雷噬嗑", "咬住、咬合、刑罚、刑狱"], "03-05": ["火风鼎", "饮食、蓄养贤人、烹制、制衡"], "03-06": ["火水未济", "未完成、未成功"], "03-07": ["火山旅", "旅行、不安定、路途"], "03-08": ["火地晋", "晋升、前进"],
    "04-01": ["雷天大壮", "极为强壮、力量强大"], "04-02": ["雷泽归妹", "婚嫁、出嫁"], "04-03": ["雷火丰", "丰盛、盛大、丰富"], "04-04": ["震为雷", "震动、威惧、震慑"], "04-05": ["雷风恒", "恒久、恒常、长久"], "04-06": ["雷水解", "解脱、解开、化解"], "04-07": ["雷山小过", "小的过错或过度、稍有越过限度"], "04-08": ["雷地豫", "喜悦、安乐、不豫之色"],
    "05-01": ["风天小畜", "小的积累、小的成就"], "05-02": ["风泽中孚", "诚信、朴实、踏实"], "05-03": ["风火家人", "家庭伦理、家庭关系"], "05-04": ["风雷益", "受益、增多"], "05-05": ["巽为风", "进入、风吹、谦逊"], "05-06": ["风水涣", "涣散、离散、分散"], "05-07": ["风山渐", "渐进、逐步"], "05-08": ["风地观", "观看、展示、展览"],
    "06-01": ["水天需", "需求、等待、期许、饮食、供养"], "06-02": ["水泽节", "节制、控制、把控、节约"], "06-03": ["水火既济", "已经完成"], "06-04": ["水雷屯", "屯积、积累、萌芽、初创艰难"], "06-05": ["水风井", "水牛、贤德"], "06-06": ["坎为水", "陷落、坑坎、危险"], "06-07": ["水山蹇", "跛脚、困难、艰难险阻"], "06-08": ["水地比", "相近、亲附"],
    "07-01": ["山天大畜", "大的积累、大的积蓄"], "07-02": ["山泽损", "损失、减少、受损"], "07-03": ["山火贲", "装饰、修饰、文饰"], "07-04": ["山雷颐", "颐养、休养、食物、安乐"], "07-05": ["山风蛊", "蛊惑、腐败、混乱"], "07-06": ["山水蒙", "启蒙、启发、教育"], "07-07": ["艮为山", "停止、终止"], "07-08": ["山地剥", "下落、剥落、衰落"],
    "08-01": ["地天泰", "亨通、安泰、通达"], "08-02": ["地泽临", "靠近、临变"], "08-03": ["地火明夷", "受伤、韬光养晦"], "08-04": ["地雷复", "恢复、归复、回归"], "08-05": ["地风升", "上升、发达、升起"], "08-06": ["地水师", "军队、众人"], "08-07": ["地山谦", "谦虚、谦逊"], "08-08": ["坤为地", "柔顺、柔和、包容、为地、为臣民"]
  };

  /** 先天数 → 两位代码段（1 → "01"），与交付实现 hexCodeOf 同口径 */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  /** 上下卦先天数 → 规范卦代码（全文件唯一的代码生成点） */
  function hexCodeOf(upperNum, lowerNum) { return pad2(upperNum) + "-" + pad2(lowerNum); }

  /* ---------- 汉字笔画映射（内置常用字；缺失时由 UI 引导手动输入） ----------
   * s = 简体标准笔画；t = 繁体标准笔画（缺省视为同简体） */
  var STROKES = {
    "一": { s: 1 }, "二": { s: 2 }, "三": { s: 3 }, "四": { s: 5 }, "五": { s: 4 }, "六": { s: 4 }, "七": { s: 2 }, "八": { s: 2 }, "九": { s: 2 }, "十": { s: 2 },
    "人": { s: 2 }, "大": { s: 3 }, "小": { s: 3 }, "中": { s: 4 }, "上": { s: 3 }, "下": { s: 3 }, "心": { s: 4 }, "手": { s: 4 }, "口": { s: 3 }, "目": { s: 5 },
    "日": { s: 4 }, "月": { s: 4 }, "年": { s: 6 }, "时": { s: 7, t: 10 }, "分": { s: 4 }, "天": { s: 4 }, "地": { s: 6 }, "水": { s: 4 }, "火": { s: 4 }, "山": { s: 3 },
    "石": { s: 5 }, "田": { s: 5 }, "土": { s: 3 }, "金": { s: 8 }, "木": { s: 4 }, "风": { s: 4, t: 9 }, "云": { s: 4, t: 12 }, "雨": { s: 8 }, "雪": { s: 11 }, "雷": { s: 13 },
    "电": { s: 5, t: 13 }, "龙": { s: 5, t: 16 }, "马": { s: 3, t: 10 }, "牛": { s: 4 }, "羊": { s: 6 }, "鸟": { s: 5, t: 11 }, "鱼": { s: 8, t: 11 }, "虫": { s: 6 },
    "梅": { s: 11, t: 11 }, "花": { s: 7, t: 8 }, "观": { s: 6, t: 25 }, "音": { s: 9 }, "乐": { s: 5, t: 15 }, "问": { s: 6, t: 11 }, "事": { s: 8 }, "吉": { s: 6 }, "凶": { s: 4 },
    "春": { s: 9 }, "夏": { s: 10 }, "秋": { s: 9 }, "冬": { s: 5 }, "东": { s: 5, t: 8 }, "南": { s: 9 }, "西": { s: 6 }, "北": { s: 5 }, "国": { s: 8, t: 11 }, "家": { s: 10 },
    "学": { s: 8, t: 16 }, "开": { s: 4, t: 12 }, "门": { s: 3, t: 8 }, "见": { s: 4, t: 7 }, "书": { s: 4, t: 10 }, "画": { s: 8, t: 12 }, "长": { s: 4, t: 8 }, "飞": { s: 3, t: 9 },
    "爱": { s: 10, t: 13 }, "无": { s: 4, t: 12 }, "明": { s: 8 }, "白": { s: 5 }, "玉": { s: 5 }, "王": { s: 4 }, "君": { s: 7 }, "臣": { s: 6 }, "民": { s: 5 },
    "生": { s: 5 }, "老": { s: 6 }, "子": { s: 3 }, "女": { s: 3 }, "男": { s: 7 }, "道": { s: 12 }, "德": { s: 15 }, "福": { s: 13 }, "禄": { s: 12 }, "寿": { s: 7, t: 14 },
    "财": { s: 7, t: 10 }, "官": { s: 8 }, "病": { s: 10 }, "药": { s: 9, t: 19 }, "医": { s: 7, t: 18 }, "婚": { s: 11 }, "姻": { s: 9 }, "情": { s: 11 },
    "考": { s: 6 }, "试": { s: 8, t: 13 }, "工": { s: 3 }, "作": { s: 7 }, "司": { s: 5 }, "公": { s: 4 }, "旅": { s: 10 }, "行": { s: 6 }, "住": { s: 7 },
    "宅": { s: 6 }, "屋": { s: 9 }, "车": { s: 4, t: 7 }, "路": { s: 13 }, "桥": { s: 10, t: 16 }, "船": { s: 11 }
  };

  /* ---------- 取余规则 ---------- */
  function modTrigram(n) { var r = n % 8; return r === 0 ? 8 : r; }
  function modMoving(n) { var r = n % 6; return r === 0 ? 6 : r; }

  /* ---------- 时辰序数（03 文档 §6.2：23:00 起算次日子时） ---------- */
  var ZHI = "子丑寅卯辰巳午未申酉戌亥";
  var GAN = "甲乙丙丁戊己庚辛壬癸";
  function hourNumber(hour) { return hour >= 23 ? 1 : Math.floor((hour + 1) / 2) + 1; }

  /* 年支口径（03 §6.1 / §2.1）：取**农历年**（正月初一为界）的地支序数，非立春干支年。
   * 干支年标签必须由同一个 lYear 派生，否则每年「正月初一 → 立春」约 13 天里
   * 界面年号与算法年支互相矛盾（用户按标签手算必然对不上）。 */
  function yearBranchNo(lYear) { return ((lYear - 4) % 12 + 12) % 12 + 1; }
  function ganzhiYear(lYear) {
    return GAN[((lYear - 4) % 10 + 10) % 10] + ZHI[((lYear - 4) % 12 + 12) % 12];
  }

  /* ---------- 时间起卦（依赖 solarlunar；闰月按本月份数） ---------- */
  function castByTime(date, solarlunar) {
    var h = date.getHours();
    var shifted = false;
    var y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    var hourNo;
    if (h >= 23) { // 晚子时：按次日子时
      var nd = new Date(y, m - 1, d + 1);
      y = nd.getFullYear(); m = nd.getMonth() + 1; d = nd.getDate();
      hourNo = 1; shifted = true;
    } else {
      hourNo = hourNumber(h);
    }
    var lu = solarlunar.solar2lunar(y, m, d);
    var yearNo = yearBranchNo(lu.lYear);    // 年支序数 子1..亥12（农历年口径）
    var monthNo = Math.abs(lu.lMonth);      // 闰月按本月份数（03 §6.1）；负数表示闰月的库在此归一
    var dayNo = lu.lDay;
    var S1 = yearNo + monthNo + dayNo;
    var S2 = S1 + hourNo;
    var upper = modTrigram(S1), lower = modTrigram(S2), moving = modMoving(S2);
    return {
      method: "TIME",
      upper: upper, lower: lower, moving: moving,
      params: { yearNo: yearNo, monthNo: monthNo, dayNo: dayNo, hourNo: hourNo, S1: S1, S2: S2, shifted: shifted },
      // monthCn 已含「闰」前缀（如「闰六月」），**不得**再拼一次（否则出现「闰闰六月」）；
      // 干支年由 lYear 派生，与 yearNo 同源
      label: ganzhiYear(lu.lYear) + "年 " + lu.monthCn + lu.dayCn + " " + ZHI[hourNo - 1] + "时"
    };
  }

  /* ---------- 数字起卦 ---------- */
  function castByNumber(n1, n2, hourNo) {
    if (n2 == null) { // 一数模式
      var S = n1 + hourNo;
      return { method: "NUMBER", mode: "ONE", upper: modTrigram(n1), lower: modTrigram(S), moving: modMoving(S), params: { n1: n1, hourNo: hourNo, S: S } };
    }
    return { method: "NUMBER", mode: "TWO", upper: modTrigram(n1), lower: modTrigram(n2), moving: modMoving(n1 + n2), params: { n1: n1, n2: n2, sum: n1 + n2 } };
  }

  /* ---------- 汉字笔画起卦（v1.2：两字动爻含秒钟数） ---------- */
  function castByCharacter(strokeA, strokeB, second, hourNo) {
    if (strokeB == null) { // 一字模式（不加秒，03 §6.5）
      var T = strokeA, S = T + hourNo;
      return { method: "CHARACTER", mode: "ONE", upper: modTrigram(T), lower: modTrigram(S), moving: modMoving(S), params: { strokes: [T], hourNo: hourNo, S: S } };
    }
    var sum = strokeA + strokeB + second;
    return { method: "CHARACTER", mode: "TWO", upper: modTrigram(strokeA), lower: modTrigram(strokeB), moving: modMoving(sum), params: { strokes: [strokeA, strokeB], second: second, sum: sum } };
  }

  /* ---------- 声音（点数）起卦 ---------- */
  function castBySound(c1, c2) {
    return { method: "SOUND", upper: modTrigram(c1), lower: modTrigram(c2), moving: modMoving(c1 + c2), params: { count1: c1, count2: c2, sum: c1 + c2 } };
  }

  /* ---------- 卦象推导：本卦 / 互卦 / 变卦 / 体用 ---------- */
  function trigramLines(num) {
    var b = TRIGRAMS[num].binary;
    return [b & 1, (b >> 1) & 1, (b >> 2) & 1]; // [初,二,三] 自下而上
  }
  function bitsToNum(bits) { return bits[0] | (bits[1] << 1) | (bits[2] << 2); }
  function trigramByBinary(binary) {
    for (var k in TRIGRAMS) if (TRIGRAMS[k].binary === binary) return parseInt(k, 10);
    throw new Error("bad binary " + binary);
  }

  function resolve(upperNum, lowerNum, moving, tiYongRule) {
    var lines = trigramLines(lowerNum).concat(trigramLines(upperNum)); // index0 = 初爻
    var changed = lines.slice();
    changed[moving - 1] = 1 - changed[moving - 1];
    var bianLower = trigramByBinary(bitsToNum(changed.slice(0, 3)));
    var bianUpper = trigramByBinary(bitsToNum(changed.slice(3, 6)));
    var huLower = trigramByBinary(bitsToNum(lines.slice(1, 4))); // 第2,3,4爻
    var huUpper = trigramByBinary(bitsToNum(lines.slice(2, 5))); // 第3,4,5爻
    var ti, yong;
    if (tiYongRule === "UPPER_YONG_LOWER_TI") { ti = lowerNum; yong = upperNum; }
    else { ti = moving >= 4 ? lowerNum : upperNum; yong = moving >= 4 ? upperNum : lowerNum; }
    var code = hexCodeOf(upperNum, lowerNum), bianCode = hexCodeOf(bianUpper, bianLower), huCode = hexCodeOf(huUpper, huLower);
    return {
      lines: lines, changedLines: changed,
      upper: upperNum, lower: lowerNum, moving: moving,
      ben: { code: code, name: HEX64[code][0], keywords: HEX64[code][1].split("、"), upper: upperNum, lower: lowerNum },
      hu: { code: huCode, name: HEX64[huCode][0], keywords: HEX64[huCode][1].split("、"), upper: huUpper, lower: huLower },
      bian: { code: bianCode, name: HEX64[bianCode][0], keywords: HEX64[bianCode][1].split("、"), upper: bianUpper, lower: bianLower },
      ti: ti, yong: yong,
      judge: judge(TRIGRAMS[ti], TRIGRAMS[yong])
    };
  }

  /* ---------- 五行生克 + 程度分级（03 §1.3，手写笔记口径） ---------- */
  var ELEM_ORDER = ["木", "火", "土", "金", "水"];
  function generates(a, b) { return ELEM_ORDER[(ELEM_ORDER.indexOf(a) + 1) % 5] === b; }
  function overcomes(a, b) {
    var KE = { "木": "土", "土": "水", "水": "火", "火": "金", "金": "木" };
    return KE[a] === b;
  }
  function judge(ti, yong) {
    var te = ti.element, ye = yong.element;
    if (te === ye) return { relation: "体用比和", degree: "吉", degreeKey: "JI", summary: "体用比和：吉，顺利和谐" };
    if (generates(ye, te)) return { relation: "用生体", degree: "大吉", degreeKey: "DA_JI", summary: "用生体：吉，有外力帮助" };
    if (generates(te, ye)) return { relation: "体生用", degree: "小凶", degreeKey: "XIAO_XIONG", summary: "体生用：小凶，耗损精力" };
    if (overcomes(te, ye)) return { relation: "体克用", degree: "小吉", degreeKey: "XIAO_JI", summary: "体克用：吉，能掌控局面" };
    return { relation: "用克体", degree: "大凶", degreeKey: "DA_XIONG", summary: "用克体：凶，受制于人" };
  }

  /* ---------- 爻名 ---------- */
  function lineName(index, yang) { // index 1-6
    var nine = yang ? "九" : "六";
    if (index === 1) return "初" + nine;
    if (index === 6) return "上" + nine;
    return (yang ? "九" : "六") + ["", "", "二", "三", "四", "五"][index];
  }

  return {
    TRIGRAMS: TRIGRAMS, HEX64: HEX64, STROKES: STROKES,
    modTrigram: modTrigram, modMoving: modMoving, hourNumber: hourNumber,
    yearBranchNo: yearBranchNo, ganzhiYear: ganzhiYear, hexCodeOf: hexCodeOf,
    castByTime: castByTime, castByNumber: castByNumber, castByCharacter: castByCharacter, castBySound: castBySound,
    trigramLines: trigramLines, resolve: resolve, judge: judge, lineName: lineName,
    ELEMENT_ORDER: ELEM_ORDER
  };
});
