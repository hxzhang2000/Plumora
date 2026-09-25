/* 观梅 UI 原型 — jsdom 冒烟测试 */
const { JSDOM } = require("jsdom");
const fs = require("fs");

const html = fs.readFileSync("D:/hxzhang/MyGithubSoftware/Plumora/docs/ui/观梅-Plumora-UI设计稿.html", "utf8");

const errors = [];
const dom = new JSDOM(html, {
  url: "http://localhost/guanmei",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.confirm = () => true;
    window.HTMLElement.prototype.scrollIntoView = function () {};
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  }
});
const { window } = dom;
const { document } = window;
window.addEventListener("error", e => errors.push("window.onerror: " + e.message));

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("PASS", name); }
  else { fail++; console.log("FAIL", name, extra || ""); }
}
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

setTimeout(() => {
  try {
    // 1. 核心对象就绪
    T("GMCore/solarlunar 已加载", !!(window.GMCore && window.solarlunar));

    // 2. 时间预览渲染（农历）
    const tp = $("#time-preview").textContent;
    T("时间起卦预览含农历干支", /年/.test(tp) && /时/.test(tp) && /月/.test(tp), tp);

    // 3. 时间起卦 → 排盘
    click($("#btn-cast"));
    T("结果页激活", $("#screen-result").classList.contains("active"));
    const ben = $("#n-ben").textContent;
    T("本卦名称渲染（非空）", /为|之$/.test(ben) || ben.length > 1, ben);
    T("动爻圆点存在", !!$("#g-ben .dot"));
    T("体用标注存在", !!$("#g-ben .side-labels .ti") && !!$("#g-ben .side-labels .yong"));
    T("结论卡含生克关系", /生|克|比和/.test($("#judge-card").textContent));
    T("程度徽标存在", /大吉|小吉|吉|小凶|大凶/.test($("#judge-card .badge").textContent));
    T("关键词 chips 渲染", document.querySelectorAll("#kw-card .chip").length >= 2);

    // 4. 保存卦例
    $("#question-in").value = "冒烟测试所问";
    click($("#btn-save"));
    const saved = JSON.parse(window.localStorage.getItem("gm.records") || "[]");
    T("卦例已入库", saved.length === 1 && saved[0].question === "冒烟测试所问");
    T("入库含 keywords", !!(saved[0].keywords && saved[0].keywords.ben));

    // 5. 返回 → 数字起卦 3,8 → 离/坤 动5 → 火地晋
    click($("#btn-back"));
    T("回到主屏", $("#screen-main").classList.contains("active"));
    $$(".seg-btn[data-m]").find(b => b.dataset.m === "NUMBER").click();
    $("#num-in1").value = "3"; $("#num-in2").value = "8";
    click($("#btn-cast"));
    T("数字起卦 本卦=火地晋", $("#n-ben").textContent.includes("火地晋"), $("#n-ben").textContent);
    T("数字起卦 动爻六五", $("#n-ben").textContent.includes("六五"), $("#n-ben").textContent);

    // 6. 汉字起卦（简体默认：梅11/花7 → 离/艮 = 火山旅）
    click($("#btn-back"));
    $$(".seg-btn[data-m]").find(b => b.dataset.m === "CHARACTER").click();
    $("#char-in1").value = "梅"; $("#char-in2").value = "花";
    $("#char-in1").dispatchEvent(new window.Event("input", { bubbles: true }));
    $("#char-in2").dispatchEvent(new window.Event("input", { bubbles: true }));
    T("笔画提示 11 画 / 7 画", $("#char-in1-hint").textContent === "11 画" && $("#char-in2-hint").textContent === "7 画",
      $("#char-in1-hint").textContent + "/" + $("#char-in2-hint").textContent);
    click($("#btn-cast"));
    T("汉字起卦（简体）本卦=火山旅", $("#n-ben").textContent.includes("火山旅"), $("#n-ben").textContent);
    T("上下文含秒钟数", /秒 \d+/.test($("#result-ctx").textContent), $("#result-ctx").textContent);

    // 7. 卦例列表（含名称优先级：所问之事 → 卦名）
    //    再存一条**不填所问之事**的，用于验证回退分支
    click($("#btn-save"));
    const saved2 = JSON.parse(window.localStorage.getItem("gm.records") || "[]");
    T("第二条卦例未填所问之事", saved2.length === 2 && saved2.some(r => !r.question));

    click($("#btn-back"));
    $$(".nav-item").find(n => n.dataset.tab === "records").click();
    T("卦例列表渲染 2 条", document.querySelectorAll(".rec-item").length === 2);

    const recItems = $$(".rec-item").map(el => ({
      title: el.querySelector(".rec-line1 b").textContent.trim(),
      sub: el.querySelector(".rec-line2").textContent
    }));
    const withQ = recItems.find(i => i.title === "冒烟测试所问");
    // 未填目标那条的卦名（不是第一条的卦名——两条是不同算例）
    const noQName = (saved2.find(r => !r.question) || {}).benName;
    const noQ = recItems.find(i => i.title === noQName);
    T("填了目标的卦例以所问之事作标题", !!withQ, recItems.map(i => i.title).join(" | "));
    T("未填目标的卦例回退到卦名作标题", !!noQ, recItems.map(i => i.title).join(" | ") + " / 期望 " + noQName);
    T("标题是所问之事时副行保留卦名", !!withQ && withQ.sub.includes(saved[0].benName), withQ && withQ.sub);
    T("标题已是卦名时副行不重复卦名", !!noQ && !noQ.sub.includes(noQName), noQ && noQ.sub);

    // 8. 学习页：八卦类象 + 64 卦格
    $$(".nav-item").find(n => n.dataset.tab === "learn").click();
    T("八卦类象默认渲染", $("#xx-detail").textContent.includes("乾卦"));
    $$(".xx-chip").find(c => c.dataset.n === "6").click();
    T("切换坎卦", $("#xx-detail").textContent.includes("坎卦") && $("#xx-detail").textContent.includes("水"));
    T("64 卦格 64 格", document.querySelectorAll(".grid-cell").length === 64);
    document.querySelector(".grid-cell[data-key='06-05']").click();
    T("点击井格显示水风井+关键词", $("#hex64-detail").textContent.includes("水风井") && $("#hex64-detail").textContent.includes("水牛"));

    // 9. 设置：深色主题 + 体用规则
    click($("#btn-settings"));
    T("设置面板打开", $("#panel-settings").classList.contains("open"));
    $$("#panel-settings [data-set]").find(b => b.dataset.val === "DARK").click();
    T("深色主题生效", document.documentElement.getAttribute("data-theme") === "dark");
    $$("#panel-settings [data-set]").find(b => b.dataset.val === "UPPER_YONG_LOWER_TI").click();
    T("体用规则可切换", window.localStorage.getItem("gm.settings").includes("UPPER_YONG_LOWER_TI"));

    /* ---------- 10. 算法口径回归（审查报告 2026-09-25：C-1 / C-2 / D-1） ---------- */
    const GM = window.GMCore;
    const sl = window.solarlunar;

    // C-2 卦代码：两段各两位，与 04 §2.2 / 05 §3.1 的「06-05」写法一致
    T("卦代码补零 hexCodeOf(6,5)='06-05'", GM.hexCodeOf(6, 5) === "06-05", GM.hexCodeOf(6, 5));
    T("HEX64 全部 64 键为两位段", Object.keys(GM.HEX64).every(k => /^\d{2}-\d{2}$/.test(k)),
      Object.keys(GM.HEX64).filter(k => !/^\d{2}-\d{2}$/.test(k)).join(","));
    T("resolve 产出的 code 已补零", GM.resolve(6, 5, 1).ben.code === "06-05", GM.resolve(6, 5, 1).ben.code);

    // C-1 年支口径：农历年（正月初一为界），标签干支年与算法年支同源
    T("年支序数 2026→7 / 2025→6", GM.yearBranchNo(2026) === 7 && GM.yearBranchNo(2025) === 6);
    T("干支年 2026→丙午 / 2025→乙巳", GM.ganzhiYear(2026) === "丙午" && GM.ganzhiYear(2025) === "乙巳");
    const t0210 = GM.castByTime(new Date(2026, 1, 10, 12, 0, 0), sl);
    T("2026-02-10 标签取农历年（乙巳），不用立春干支年（丙午）",
      t0210.label === "乙巳年 腊月廿三 午时", t0210.label);
    T("标签年支与算法年支一致（巳=6）",
      t0210.params.yearNo === 6 && t0210.label.indexOf("乙巳") === 0, t0210.params.yearNo + " / " + t0210.label);
    const t0129 = GM.castByTime(new Date(2025, 0, 29, 12, 0, 0), sl);
    T("2025-01-29 = 乙巳年正月初一（不再是「甲辰年 正月初一」）",
      t0129.label === "乙巳年 正月初一 午时", t0129.label);

    // D-1 闰月标签：monthCn 已含「闰」，不得再拼一次
    const tLeap = GM.castByTime(new Date(2025, 7, 1, 12, 30, 0), sl);
    T("闰月标签不含「闰闰」", tLeap.label.indexOf("闰闰") === -1, tLeap.label);
    T("闰月标签 = 乙巳年 闰六月初八 午时", tLeap.label === "乙巳年 闰六月初八 午时", tLeap.label);
    T("闰月按本月份数（六月 = 6）", tLeap.params.monthNo === 6, String(tLeap.params.monthNo));
    T("闰月月名只含一个「闰」", (tLeap.label.match(/闰/g) || []).length === 1, tLeap.label);
  } catch (e) {
    fail++;
    console.log("FAIL 异常:", e.stack);
  }

  console.log("====", pass + " pass, " + fail + " fail");
  if (errors.length) { console.log("console errors:", errors); }
  process.exit(fail || errors.length ? 1 : 0);
}, 300);
