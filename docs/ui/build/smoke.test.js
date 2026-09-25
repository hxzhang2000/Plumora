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

    // 7. 卦例列表
    click($("#btn-back"));
    $$(".nav-item").find(n => n.dataset.tab === "records").click();
    T("卦例列表渲染 1 条", document.querySelectorAll(".rec-item").length === 1);

    // 8. 学习页：八卦类象 + 64 卦格
    $$(".nav-item").find(n => n.dataset.tab === "learn").click();
    T("八卦类象默认渲染", $("#xx-detail").textContent.includes("乾卦"));
    $$(".xx-chip").find(c => c.dataset.n === "6").click();
    T("切换坎卦", $("#xx-detail").textContent.includes("坎卦") && $("#xx-detail").textContent.includes("水"));
    T("64 卦格 64 格", document.querySelectorAll(".grid-cell").length === 64);
    document.querySelector(".grid-cell[data-key='6-5']").click();
    T("点击井格显示水风井+关键词", $("#hex64-detail").textContent.includes("水风井") && $("#hex64-detail").textContent.includes("水牛"));

    // 9. 设置：深色主题 + 体用规则
    click($("#btn-settings"));
    T("设置面板打开", $("#panel-settings").classList.contains("open"));
    $$("#panel-settings [data-set]").find(b => b.dataset.val === "DARK").click();
    T("深色主题生效", document.documentElement.getAttribute("data-theme") === "dark");
    $$("#panel-settings [data-set]").find(b => b.dataset.val === "UPPER_YONG_LOWER_TI").click();
    T("体用规则可切换", window.localStorage.getItem("gm.settings").includes("UPPER_YONG_LOWER_TI"));
  } catch (e) {
    fail++;
    console.log("FAIL 异常:", e.stack);
  }

  console.log("====", pass + " pass, " + fail + " fail");
  if (errors.length) { console.log("console errors:", errors); }
  process.exit(fail || errors.length ? 1 : 0);
}, 300);
