/* ============================================================
 * 观梅 · Plumora — UI 控制层（高保真交互原型）
 * 依赖：window.solarlunar（内嵌）、window.GMCore（core.js）
 * ============================================================ */
(function () {
  "use strict";
  var GM = window.GMCore, SL = window.solarlunar;
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var ZHI = "子丑寅卯辰巳午未申酉戌亥";
  var TRIG_SYMBOLS = ["☰", "☱", "☲", "☳", "☴", "☵", "☶", "☷"];
  var METHOD_NAMES = { TIME: "时间起卦", NUMBER: "数字起卦", CHARACTER: "汉字起卦", SOUND: "声音起卦" };
  var VERIFY = { UNVERIFIED: "未验", PENDING: "待验", VERIFIED: "应验", INVALID: "作废" };

  /* ---------- 设置 ---------- */
  var DEF_SETTINGS = { strokeStd: "SIMPLIFIED", tiYongRule: "MOVING_LINE", theme: "SYSTEM", lastMethod: "TIME" };
  var settings = load("gm.settings", DEF_SETTINGS);
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v ? Object.assign({}, d, v) : d; } catch (e) { return d; } }
  function loadList(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } }
  function saveSettings() { localStorage.setItem("gm.settings", JSON.stringify(settings)); applyTheme(); }
  function applyTheme() {
    var t = settings.theme;
    var dark = t === "DARK" || (t === "SYSTEM" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }

  /* ---------- 卦例存储 ---------- */
  var records = loadList("gm.records");
  function persistRecords() { localStorage.setItem("gm.records", JSON.stringify(records)); }
  var recordFilter = "ALL", recordKeyword = "";

  /* ---------- 视图切换 ---------- */
  var currentResult = null, currentRecordId = null;
  function showTab(name) {
    $$(".tab-page").forEach(function (p) { p.classList.remove("active"); });
    $("#page-" + name).classList.add("active");
    $$(".nav-item").forEach(function (n) { n.classList.toggle("active", n.dataset.tab === name); });
    if (name === "records") renderRecords();
    if (name === "learn") renderLearnDefault();
    closePanel();
  }
  function showScreen(id) {
    $$(".screen").forEach(function (s) { s.classList.remove("active"); });
    $(id).classList.add("active");
  }
  function backToTab() {
    showScreen("#screen-main");
    var active = $$(".nav-item").filter(function (n) { return n.classList.contains("active"); })[0];
    if (active && active.dataset.tab === "records") renderRecords();
  }

  /* ---------- 起卦页 ---------- */
  function setMethod(m) {
    settings.lastMethod = m; saveSettings();
    $$(".seg-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.m === m); });
    $$(".cast-panel").forEach(function (p) { p.classList.toggle("active", p.id === "panel-" + m); });
    if (m === "TIME") tickTime();
  }
  function lunarNow() {
    var d = new Date();
    return GM.castByTime(d, SL);
  }
  function tickTime() {
    var el = $("#time-preview");
    if (!el || !$("#panel-TIME").classList.contains("active")) return;
    var c = lunarNow();
    var h = String(new Date().getHours()).padStart(2, "0");
    var mi = String(new Date().getMinutes()).padStart(2, "0");
    var extra = c.params.shifted ? "（晚子时 · 按次日计）" : "";
    el.innerHTML = "<b>" + c.label + "</b>" + extra +
      "<span class='mono'>年支" + c.params.yearNo + " + 月" + c.params.monthNo + " + 日" + c.params.dayNo + " = " + c.params.S1 +
      "　+时" + c.params.hourNo + " = " + c.params.S2 + "</span>";
  }
  setInterval(tickTime, 1000);

  function doCast() {
    var m = settings.lastMethod;
    try {
      var cast = null;
      if (m === "TIME") {
        cast = lunarNow();
      } else if (m === "NUMBER") {
        var one = document.querySelector("#panel-NUMBER .mode-btn.active").dataset.nummode === "ONE";
        var v1 = parseInt($("#num-in1").value, 10);
        if (!v1 || v1 < 1) return toast("请输入 1 以上的数字");
        if (v1 > 999999999) return toast("数字上限 999,999,999");
        if (!one) {
          var v2 = parseInt($("#num-in2").value, 10);
          if (!v2 || v2 < 1) return toast("请输入第二个数字（1 以上）");
          if (v2 > 999999999) return toast("数字上限 999,999,999");
          cast = GM.castByNumber(v1, v2, null);
        } else {
          cast = GM.castByNumber(v1, null, GM.hourNumber(new Date().getHours() || 24));
        }
      } else if (m === "CHARACTER") {
        cast = castCharacter();
        if (!cast) return; // 错误已提示
      } else if (m === "SOUND") {
        var c1 = soundCount[0], c2 = soundCount[1];
        if (c1 < 1 || c2 < 1) return toast("两组至少各点按 1 次");
        cast = GM.castBySound(c1, c2);
      }
      openResult(cast, null);
    } catch (e) {
      toast("起卦失败：" + e.message);
    }
  }

  /* ---------- 汉字起卦 ---------- */
  var manualStrokes = {};
  function strokesOf(ch) {
    var e = GM.STROKES[ch];
    if (!e) return manualStrokes[ch] != null ? { s: manualStrokes[ch], t: manualStrokes[ch], manual: true } : null;
    return settings.strokeStd === "TRADITIONAL" ? { s: e.t != null ? e.t : e.s, t: e.t, manual: false } : { s: e.s, t: e.t, manual: false };
  }
  function castCharacter() {
    var one = document.querySelector("#panel-CHARACTER .mode-btn.active").dataset.charmode === "ONE";
    var now = new Date();
    var sec = now.getSeconds();
    var hourNo = GM.hourNumber(now.getHours() || 24);
    if (one) {
      var ch1 = ($("#char-in1").value || "").trim();
      if (!ch1) { toast("请输入一个汉字"); return null; }
      if (ch1.length > 1) { toast("一字模式请只输入一个字"); return null; }
      var st = strokesOf(ch1);
      if (!st) { toast("「" + ch1 + "」未收录笔画，请在下方手动输入"); showManual(ch1, 1); return null; }
      var r = GM.castByCharacter(st.s, null, sec, hourNo);
      r.label = "「" + ch1 + "」" + st.s + " 画" + (st.manual ? "（手动）" : "");
      r.labelExtra = "秒 " + sec;
      return r;
    }
    var cs = [($("#char-in1").value || "").trim(), ($("#char-in2").value || "").trim()];
    if (!cs[0] || !cs[1]) { toast("请输入两个汉字"); return null; }
    var strokes = [], chars = [];
    for (var i = 0; i < 2; i++) {
      var c = strokesOf(cs[i]);
      if (!c) { toast("「" + cs[i] + "」未收录笔画，请在下方手动输入"); showManual(cs[i], i + 1); return null; }
      strokes.push(c.s); chars.push(cs[i]);
    }
    var r2 = GM.castByCharacter(strokes[0], strokes[1], sec, hourNo);
    r2.label = "「" + chars[0] + "」" + strokes[0] + " 画 · 「" + chars[1] + "」" + strokes[1] + " 画" + (strokesOf(cs[0]).manual || strokesOf(cs[1]).manual ? "（含手动）" : "");
    r2.labelExtra = "秒 " + sec;
    return r2;
  }
  function showManual(ch, slot) {
    var box = $("#char-manual");
    box.style.display = "block";
    box.innerHTML = "「" + ch + "」的笔画数：<input id='manual-strokes' type='number' min='1' max='40' /> <button class='btn-mini' id='manual-ok'>确定</button>";
    $("#manual-ok").onclick = function () {
      var v = parseInt($("#manual-strokes").value, 10);
      if (!v || v < 1 || v > 40) return toast("请输入 1–40 的笔画数");
      manualStrokes[ch] = v;
      box.style.display = "none";
      var r = castCharacter();
      if (r) openResult(r, null);
    };
  }
  function refreshCharHints() {
    ["#char-in1", "#char-in2"].forEach(function (id) {
      var inp = $(id), hint = $(id + "-hint");
      if (!inp) return;
      var v = (inp.value || "").trim();
      if (!v) { hint.textContent = ""; return; }
      var st = strokesOf(v);
      hint.textContent = st ? st.s + " 画" + (st.manual ? "（手动）" : "") : "未收录，需手动输入";
    });
  }

  /* ---------- 声音起卦 ---------- */
  var soundCount = [0, 0];
  function renderSound() {
    $("#sound-c1").textContent = soundCount[0];
    $("#sound-c2").textContent = soundCount[1];
  }

  /* ---------- 排盘渲染 ---------- */
  function glyphHTML(lines, moving, opts) {
    var opts = opts || {};
    var html = "";
    for (var i = 5; i >= 0; i--) { // 自上而下：i=5 为初爻？—— 注意 lines[0]=初爻
      var idx = i; // 自上而下显示：第 i 行对应 lines[i]（lines[5]=上爻在最上）
      var yang = lines[idx] === 1;
      var isMoving = (idx + 1) === moving;
      var cls = "yao " + (yang ? "yang" : "yin") + (isMoving ? " moving" : "");
      html += "<div class='" + cls + "'>" +
        (yang ? "<span class='bar'></span>" : "<span class='bar'></span><span class='bar'></span>") +
        (isMoving ? "<span class='dot'></span>" : "") + "</div>";
    }
    return "<div class='hex " + (opts.size || "") + "'>" + html + "</div>";
  }
  function trigramTag(num, role) {
    var t = GM.TRIGRAMS[num];
    return "<span class='tag " + (role ? role : "") + "'>" + (role === "ti" ? "体" : role === "yong" ? "用" : "") + t.name + "（" + t.element + "）</span>";
  }
  function degreeBadge(deg) {
    var key = { "大吉": "daji", "小吉": "xiaoji", "吉": "ji", "小凶": "xiaoxiong", "大凶": "daxiong" }[deg];
    return "<span class='badge " + key + "'>" + deg + "</span>";
  }

  function openResult(cast, record) {
    var tiYong = settings.tiYongRule;
    var r = GM.resolve(cast.upper, cast.lower, cast.moving, tiYong);
    var d = new Date();
    var nowStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") +
      " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
    currentResult = {
      cast: cast, r: r, nowStr: nowStr,
      lunarLabel: cast.label || (record && record.lunarLabel) || "",
      method: cast.method, record: record
    };
    renderResult();
    showScreen("#screen-result");
  }

  function renderResult() {
    var cur = currentResult, cast = cur.cast, r = cur.r, rec = cur.record;
    var ctx = METHOD_NAMES[cast.method] + " · " + (rec ? rec.lunarLabel : cur.lunarLabel || "—") +
      (cast.labelExtra ? " · " + cast.labelExtra : "") + " · " + cur.nowStr;
    if (cast.method === "TIME" && cast.params) {
      ctx += " · 年支" + cast.params.yearNo + "+月" + cast.params.monthNo + "+日" + cast.params.dayNo + "=" + cast.params.S1 + "，+时" + cast.params.hourNo + "=" + cast.params.S2;
    } else if (cast.params && cast.params.sum != null) {
      var extra = [];
      if (cast.params.n1 != null) extra.push(cast.params.n1 + (cast.params.n2 != null ? "、" + cast.params.n2 : ""));
      if (cast.params.strokes) extra.push("笔画 " + cast.params.strokes.join("、"));
      if (cast.params.count1 != null) extra.push("点数 " + cast.params.count1 + "、" + cast.params.count2);
      if (cast.params.second != null) extra.push("秒 " + cast.params.second);
      extra.push("和 " + cast.params.sum + " → 动爻取 " + r.moving);
      ctx += " · " + extra.join("，");
    }
    $("#result-ctx").textContent = ctx;

    // 三卦并排
    var ti = r.ti, yong = r.yong;
    var tiPos = ti >= 4 ? "上" : "下", yongPos = yong >= 4 ? "上" : "下";
    $("#g-ben").innerHTML = glyphHTML(r.lines, r.moving, { size: "lg" }) +
      "<div class='side-labels'><span class='tiyong ti'>体 " + GM.TRIGRAMS[ti].name + "（" + tiPos + "）</span><span class='tiyong yong'>用 " + GM.TRIGRAMS[yong].name + "（" + yongPos + "）</span></div>";
    $("#g-hu").innerHTML = glyphHTML(r.hu.code === r.ben.code ? r.lines : interLines(r), 0, { size: "sm" });
    $("#g-bian").innerHTML = glyphHTML(r.changedLines, 0, { size: "sm" });
    $("#n-ben").innerHTML = "<b>" + r.ben.name + "</b><span>" + GM.TRIGRAMS[r.ben.upper].name + "上" + GM.TRIGRAMS[r.ben.lower].name + "下 · 动爻" + GM.lineName(r.moving, r.lines[r.moving - 1] === 1) + "</span>";
    $("#n-hu").innerHTML = "<b>" + r.hu.name + "</b><span>" + GM.TRIGRAMS[r.hu.upper].name + "上" + GM.TRIGRAMS[r.hu.lower].name + "下</span>";
    $("#n-bian").innerHTML = "<b>" + r.bian.name + "</b><span>" + GM.TRIGRAMS[r.bian.upper].name + "上" + GM.TRIGRAMS[r.bian.lower].name + "下</span>";

    // 结论卡
    $("#judge-card").innerHTML =
      "<div class='judge-top'><span class='badge " + ({ "大吉": "daji", "小吉": "xiaoji", "吉": "ji", "小凶": "xiaoxiong", "大凶": "daxiong" }[r.judge.degree]) + "'>" + r.judge.degree + "</span>" +
      "<b>" + r.judge.relation + "</b></div>" +
      "<p class='judge-sum'>" + r.judge.summary + "</p>" +
      "<p class='judge-elem'>体卦 <b>" + GM.TRIGRAMS[ti].name + "（" + GM.TRIGRAMS[ti].element + "）</b> · 用卦 <b>" + GM.TRIGRAMS[yong].name + "（" + GM.TRIGRAMS[yong].element + "）</b>" +
      "　<span class='mono'>" + tiYongRuleLabel() + "</span></p>";

    // 关键词
    function kw(title, hex) {
      return "<div class='kw-row'><span class='kw-title'>" + title + "</span>" +
        hex.keywords.map(function (k) { return "<span class='chip'>" + k + "</span>"; }).join("") + "</div>";
    }
    $("#kw-card").innerHTML = kw("本卦 · " + r.ben.name, r.ben) + kw("变卦 · " + r.bian.name, r.bian);

    // 类象（体用）
    var tiT = GM.TRIGRAMS[ti], yongT = GM.TRIGRAMS[yong];
    function trigramRow(t, role) {
      return "<div class='xx-row'><b class='tag " + role + "'>" + (role === "ti" ? "体" : "用") + " " + t.name + " · " + t.element + "</b>" +
        "<ul><li><i>人物</i>" + t.figures + "</li><li><i>天时</i>" + t.weather + "</li><li><i>静物</i>" + t.objects + "</li><li><i>人事</i>" + t.affairs + "</li><li><i>方位</i>" + t.dir + "</li></ul></div>";
    }
    $("#xx-card").innerHTML = trigramRow(tiT, "ti") + trigramRow(yongT, "yong");

    // 保存区 / 记录操作区
    $("#save-area").style.display = rec ? "none" : "flex";
    $("#record-ops").style.display = rec ? "block" : "none";
    if (rec) {
      $("#rec-question").value = rec.question || "";
      $("#rec-note").value = rec.note || "";
      $("#rec-verify").value = rec.verify || "UNVERIFIED";
    } else {
      $("#question-in").value = "";
    }
  }
  function tiYongRuleLabel() { return settings.tiYongRule === "UPPER_YONG_LOWER_TI" ? "体用口径：上用下体（笔记流派）" : "体用口径：动爻所在为用（通行）"; }
  function interLines(r) { return r.lines.slice(1, 4).concat(r.lines.slice(2, 5)); }

  function saveRecord() {
    var cur = currentResult;
    if (!cur) return;
    var q = $("#question-in").value.trim();
    var rec = {
      id: Date.now(), createdAt: Date.now(), nowStr: cur.nowStr,
      method: cur.cast.method, lunarLabel: cur.lunarLabel || "—",
      inputLabel: cur.cast.label || "", labelExtra: cur.cast.labelExtra || "",
      params: cur.cast.params || {},
      upper: cur.r.upper, lower: cur.r.lower, moving: cur.r.moving,
      benName: cur.r.ben.name, huName: cur.r.hu.name, bianName: cur.r.bian.name,
      ti: cur.r.ti, yong: cur.r.yong, relation: cur.r.judge.relation, degree: cur.r.judge.degree,
      keywords: { ben: cur.r.ben.keywords, bian: cur.r.bian.keywords },
      changedLines: cur.r.changedLines,
      question: q, note: "", verify: "UNVERIFIED"
    };
    records.unshift(rec);
    persistRecords();
    toast("卦例已保存");
    $("#question-in").value = "";
  }

  /* ---------- 卦例列表 ---------- */
  /* 记录名称：优先「所问之事」（占卜目标），未填时回退到本卦卦名（06 §3.3 / 04 §2.8） */
  function recTitle(r) {
    var q = (r.question || "").trim();
    if (q) return q;
    var n = (r.benName || "").trim();
    return n || (METHOD_NAMES[r.method] + " · " + r.lunarLabel);
  }
  function renderRecords() {
    var kw = recordKeyword.trim().toLowerCase();
    var list = records.filter(function (r) {
      if (recordFilter !== "ALL" && r.verify !== recordFilter) return false;
      if (!kw) return true;
      return (r.question || "").toLowerCase().includes(kw) || (r.note || "").toLowerCase().includes(kw) || r.benName.toLowerCase().includes(kw);
    });
    var box = $("#record-list");
    if (!list.length) {
      box.innerHTML = "<div class='empty'>" + (records.length ? "无匹配卦例" : "还没有卦例，去「起卦」试试") + "</div>";
      return;
    }
    box.innerHTML = list.map(function (r) {
      return "<div class='rec-item' data-id='" + r.id + "'>" +
        "<div class='rec-line1'><b>" + esc(recTitle(r)) + "</b><span class='badge v-" + r.verify + "'>" + VERIFY[r.verify] + "</span></div>" +
        "<div class='rec-line2'>" + ((r.question || "").trim() ? esc(r.benName) + " · " : "") + r.lunarLabel + " · " + METHOD_NAMES[r.method] + "</div>" +
        "<div class='rec-line3'>" + r.relation + "（" + r.degree + "）→ " + r.bianName + "</div>" +
        "</div>";
    }).join("");
    $$(".rec-item").forEach(function (el) {
      el.onclick = function () { openRecordDetail(parseInt(el.dataset.id, 10)); };
    });
  }
  function esc(s) { return String(s).replace(/</g, "&lt;"); }
  function openRecordDetail(id) {
    var rec = records.filter(function (r) { return r.id === id; })[0];
    if (!rec) return;
    currentRecordId = id;
    openResult({ method: rec.method, upper: rec.upper, lower: rec.lower, moving: rec.moving, label: rec.lunarLabel, labelExtra: rec.labelExtra, params: rec.params }, rec);
  }
  function saveRecordEdits() {
    var rec = records.filter(function (r) { return r.id === currentRecordId; })[0];
    if (!rec) return;
    rec.question = $("#rec-question").value.trim();
    rec.note = $("#rec-note").value.trim();
    rec.verify = $("#rec-verify").value;
    persistRecords();
    toast("已保存");
  }
  function deleteRecord() {
    var rec = records.filter(function (r) { return r.id === currentRecordId; })[0];
    if (!rec) return;
    if (!confirm("确认删除卦例「" + rec.benName + "」？此操作不可恢复。")) return;
    records = records.filter(function (r) { return r.id !== currentRecordId; });
    persistRecords();
    toast("已删除");
    backToTab();
  }

  /* ---------- 学习页 ---------- */
  function renderLearnDefault() { renderXX(1); render64Grid(); }
  function renderXX(num) {
    $$(".xx-chip").forEach(function (c) { c.classList.toggle("active", parseInt(c.dataset.n, 10) === num); });
    var t = GM.TRIGRAMS[num];
    $("#xx-detail").innerHTML =
      "<div class='xx-head'><span class='xx-sym'>" + TRIG_SYMBOLS[num - 1] + "</span><div><b>" + t.name + "卦</b><span>五行 " + t.element + " · " + t.family + " · " + t.dir + " · " + t.season + "</span></div></div>" +
      "<ul class='xx-list'>" +
      "<li><i>人物</i>" + t.figures + "</li><li><i>天时</i>" + t.weather + "</li><li><i>地理</i>" + t.geo + "</li>" +
      "<li><i>身体</i>" + t.body + "</li><li><i>动物</i>" + t.animals + "</li><li><i>静物</i>" + t.objects + "</li>" +
      "<li><i>性情人事</i>" + t.affairs + "</li><li><i>方位</i>" + t.dir + "</li><li><i>时令</i>" + t.season + "</li></ul>";
  }
  function render64Grid() {
    var uppers = [1, 2, 3, 4, 5, 6, 7, 8], lowers = [1, 2, 3, 4, 5, 6, 7, 8];
    var html = "<div class='grid-head'><span></span>" + lowers.map(function (l) { return "<span>" + GM.TRIGRAMS[l].name + "</span>"; }).join("") + "</div>";
    html += uppers.map(function (u) {
      return "<div class='grid-row'><span class='grid-side'>" + GM.TRIGRAMS[u].name + "</span>" +
        lowers.map(function (l) {
          // 卦代码统一由 GM.hexCodeOf 生成（两位段补零），不在各处手拼
          var key = GM.hexCodeOf(u, l);
          return "<span class='grid-cell' data-key='" + key + "'>" + GM.HEX64[key][0].slice(-1) + "</span>";
        }).join("") + "</div>";
    }).join("");
    $("#grid64").innerHTML = html;
    $$(".grid-cell").forEach(function (c) {
      c.onclick = function () {
        var key = c.dataset.key, h = GM.HEX64[key];
        $("#hex64-detail").style.display = "block";
        $("#hex64-detail").innerHTML = "<div class='hexd-head'><b>" + h[0] + "</b><span>" +
          GM.TRIGRAMS[parseInt(key.split("-")[0])].name + "上" + GM.TRIGRAMS[parseInt(key.split("-")[1])].name + "下</span></div>" +
          "<div class='kw-row'><span class='kw-title'>卦意</span>" + h[1].split("、").map(function (k) { return "<span class='chip'>" + k + "</span>"; }).join("") + "</div>";
        $("#hex64-detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
      };
    });
  }

  /* ---------- 设置 ---------- */
  function openPanel() { $("#panel-settings").classList.add("open"); }
  function closePanel() { $("#panel-settings").classList.remove("open"); }
  function syncSettingsUI() {
    var stdEl = $("#char-std-label");
    if (stdEl) stdEl.textContent = settings.strokeStd === "TRADITIONAL" ? "繁体" : "简体";
    $$("#panel-settings [data-set]").forEach(function (el) {
      var group = el.dataset.set, val = el.dataset.val;
      el.classList.toggle("active", settings[group] === val);
    });
  }
  function copyText() {
    var cur = currentResult;
    if (!cur) return;
    var r = cur.r;
    var lines = [
      "【观梅 · Plumora 排盘】",
      cur.lunarLabel || "", METHOD_NAMES[cur.cast.method],
      "本卦：" + r.ben.name + "（" + GM.TRIGRAMS[r.upper].name + "上" + GM.TRIGRAMS[r.lower].name + "下）动爻" + GM.lineName(r.moving, r.lines[r.moving - 1] === 1),
      "互卦：" + r.hu.name + "　变卦：" + r.bian.name,
      "体：" + GM.TRIGRAMS[r.ti].name + "（" + GM.TRIGRAMS[r.ti].element + "） 用：" + GM.TRIGRAMS[r.yong].name + "（" + GM.TRIGRAMS[r.yong].element + "）",
      r.judge.relation + " · " + r.judge.degree + " · " + r.judge.summary,
      "本卦卦意：" + r.ben.keywords.join("、"),
      "仅供传统文化学习研究使用"
    ].filter(Boolean).join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lines).then(function () { toast("已复制到剪贴板"); }, function () { fallbackCopy(lines); });
    } else fallbackCopy(lines);
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("已复制到剪贴板"); } catch (e) { toast("复制失败"); }
    document.body.removeChild(ta);
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    $$(".nav-item").forEach(function (n) { n.onclick = function () { showTab(n.dataset.tab); }; });
    $("#btn-settings").onclick = openPanel;
    $("#panel-mask").onclick = closePanel;
    $$(".seg-btn").forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.m) setMethod(b.dataset.m);
        if (b.dataset.nummode) {
          $$("#panel-NUMBER .mode-btn").forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          $("#num-two-fields").style.display = b.dataset.nummode === "TWO" ? "flex" : "none";
          $("#num-one-hint").style.display = b.dataset.nummode === "ONE" ? "block" : "none";
        }
        if (b.dataset.charmode) {
          $$("#panel-CHARACTER .mode-btn").forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          $("#char-field2").style.display = b.dataset.charmode === "TWO" ? "block" : "none";
        }
      };
    });
    $("#btn-cast").onclick = doCast;
    ["#char-in1", "#char-in2"].forEach(function (id) {
      var el = $(id);
      el.addEventListener("input", refreshCharHints);
    });
    $("#sound-tap1").onclick = function () { if (soundCount[0] < 999) { soundCount[0]++; renderSound(); } };
    $("#sound-tap2").onclick = function () { if (soundCount[1] < 999) { soundCount[1]++; renderSound(); } };
    $("#sound-reset").onclick = function () { soundCount = [0, 0]; renderSound(); };

    $("#btn-back").onclick = backToTab;
    $("#btn-save").onclick = saveRecord;
    $("#btn-copy").onclick = copyText;
    $("#btn-recast").onclick = function () { showScreen("#screen-main"); };
    $("#btn-rec-save").onclick = saveRecordEdits;
    $("#btn-rec-del").onclick = deleteRecord;

    $("#rec-search").addEventListener("input", function () { recordKeyword = this.value; renderRecords(); });
    $$(".filter-chip").forEach(function (c) {
      c.onclick = function () {
        $$(".filter-chip").forEach(function (x) { x.classList.remove("active"); });
        c.classList.add("active");
        recordFilter = c.dataset.f;
        renderRecords();
      };
    });

    $$(".xx-chip").forEach(function (c) { c.onclick = function () { renderXX(parseInt(c.dataset.n, 10)); }; });
    $$(".learn-seg .seg-btn").forEach(function (b) {
      b.onclick = function () {
        $$(".learn-seg .seg-btn").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        $$(".learn-view").forEach(function (v) { v.classList.remove("active"); });
        $("#learn-" + b.dataset.v).classList.add("active");
      };
    });

    $$("#panel-settings [data-set]").forEach(function (el) {
      el.onclick = function () {
        settings[el.dataset.set] = el.dataset.val;
        saveSettings(); syncSettingsUI();
        if (el.dataset.set === "strokeStd") { manualStrokes = {}; refreshCharHints(); }
        toast("已更新");
      };
    });
    $("#btn-clear-records").onclick = function () {
      if (!records.length) return toast("暂无卦例");
      if (confirm("确认清空全部 " + records.length + " 条卦例？此操作不可恢复。")) {
        records = []; persistRecords(); toast("已清空");
      }
    };

    applyTheme(); syncSettingsUI(); setMethod(settings.lastMethod || "TIME"); renderSound();
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
