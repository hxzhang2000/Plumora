<script setup lang="ts">
/**
 * 应用外壳 —— 布局形态由设备识别自动决定（用户 2026-10-13 要求）
 *
 *   < 900px ：顶部标题栏 + 底部 3 Tab + 单列内容
 *   ≥ 900px ：左侧固定导航 + 居中内容区（06 §六 折叠屏/平板/桌面展开态）
 *
 * 手机 / 电脑由 platform/settings.ts 的 detectDeviceKind() 自动识别
 * （UA + 指针类型 + 屏幕尺寸），不再提供手动「电脑 / 手机」切换：
 * 手机登录就是手机形态，电脑登录就是电脑形态。电脑设备把窗口拉窄到
 * 900px 以下时仍会回落手机形态（视口兜底，见 resolveLayout）。
 *
 * 底部 3 Tab 只属于手机形态：桌面形态左侧已有主菜单，两处同时出现是重复入口
 * （产品口径：电脑模式不显示底部菜单）。隐藏走 CSS（见下方 .tabbar 规则），
 * 判据仍是 data-layout，不用 JS 判断断点。
 *
 * 两种形态都渲染在 DOM 中，由 CSS 切换（判据是 `<html data-layout>`，
 * 见下方断点说明），避免 JS 断点判断带来的首屏闪烁与布局抖动。
 *
 * 桌面形态的侧栏可以「收回」：点侧栏顶部的收回钮后整条侧栏收起，
 * 内容区左上角浮出展开钮，再点即可恢复。收回状态写入 localStorage
 * （plumora.sidebar.v1），刷新后保持。
 *
 * 宽屏上处于「手机形态」时会自动套上真机框预览（390 × 844 手机壳），
 * 进出只走顶栏的 DeviceFrameToggle（机身下方不再放第二处退出口），样式见 styles/frame.css。
 * 弹层一律 Teleport 到 #app：预览态下 #app 就是机身屏幕，遮罩/抽屉才不会溢出机身。
 *
 * 顶栏两行（产品反馈）：手机形态的第一行只放品牌标题（居左、独占整行），
 * 第二行放全部操作钮（右对齐）——两行错开，标题不再被按钮压缩。见 .appbar 样式。
 */
import { computed, ref } from 'vue';
import CastView from '@/views/CastView.vue';
import LearnView from '@/views/LearnView.vue';
import RecordDetailView from '@/views/RecordDetailView.vue';
import RecordsView from '@/views/RecordsView.vue';
import ResultView from '@/views/ResultView.vue';
import ShiYiPanel from '@/components/ShiYiPanel.vue';
import DisclaimerGate from '@/components/DisclaimerGate.vue';
import NavList from '@/components/NavList.vue';
import QrCodeDialog from '@/components/QrCodeDialog.vue';
import QrEntry from '@/components/QrEntry.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import ToastHost from '@/components/ToastHost.vue';
import { route } from '@/router';
import { useQrDialog } from '@/stores/qrDialog';
import '@/stores/deviceFrame';

const settingsOpen = ref(false);

/**
 * 侧栏收起状态（仅桌面形态有意义）。
 *
 * 持久化到独立键（plumora.sidebar.v1）而不是并进设置面板的 Settings：
 * 它是「布局操作」而非「偏好设置」，且与布局形态同属外观层，
 * 读在模块加载时完成，首屏即生效，无闪烁。
 */
const SIDEBAR_KEY = 'plumora.sidebar.v1';

function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

const sidebarCollapsed = ref(loadSidebarCollapsed());

function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  try {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0');
  } catch {
    /* 隐私模式 / 配额满：静默降级为「本次会话内有效」 */
  }
}

/**
 * 二维码弹窗：弹窗本体只在这里渲染一份（Teleport 到 #app），
 * 顶栏 / 侧栏图标与设置面板里的原入口共用 stores/qrDialog 的同一份状态。
 */
const { qrOpen, closeQr } = useQrDialog();

/**
 * 手机框预览（真机框）：宽屏 + 手机形态时自动套框，顶栏框图标可进出。
 * 解构出顶层 ref 才能在模板里自动解包（store 返回的普通对象不会被解包）。
 */

const view = computed(() => {
  switch (route.value.name) {
    case 'result':
      return ResultView;
    case 'records':
      return RecordsView;
    case 'record-detail':
      return RecordDetailView;
    case 'learn':
      return LearnView;
    case 'shi-yi':
      return ShiYiPanel;
    default:
      return CastView;
  }
});

// 详情视图按 path 重建；其余视图保活，切换 Tab 不丢输入
const viewKey = computed(() => {
  if (route.value.name === 'record-detail') return route.value.path;
  if (route.value.name === 'shi-yi') return route.value.path;
  return route.value.name;
});

// 品牌标（public/icon.svg，印章形态）。
// 用运行时相对 URL 而不是静态 src：① Vite 会把模板里的静态 src 当模块去解析，
// 指向 public/ 的文件会报找不到；② base 为 './'，相对 URL 才能保证部署到
// 任意子目录都取得到资源。
const brandMark = './icon.svg';
</script>

<template>
  <div class="shell">
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="brand-row">
        <div class="brand serif">
          <img class="brand-mark" :src="brandMark" alt="" aria-hidden="true" />
          <div class="brand-text">
            <b>观梅</b>
            <span class="brand-latin"
              ><span class="brand-dot" aria-hidden="true">·</span>PLUMORA</span
            >
          </div>
        </div>
        <button
          type="button"
          class="icon-btn side-collapse"
          aria-label="收回侧边栏"
          title="收回侧边栏"
          @click="toggleSidebar"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="15" rx="2" />
            <path d="M9.5 4.5v15" />
            <path d="M15.5 9.5 13 12l2.5 2.5" />
          </svg>
        </button>
      </div>
      <NavList variant="side" />
      <div class="sidebar-foot">
        <button type="button" class="side-settings" @click="settingsOpen = true">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <path
              d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z"
            />
          </svg>
          <span>设置</span>
        </button>
        <QrEntry variant="side" />
      </div>
    </aside>

    <!-- 侧栏收回后的展开钮：内容区左上角浮动，仅桌面形态可见 -->
    <button
      v-if="sidebarCollapsed"
      type="button"
      class="side-reopen"
      aria-label="展开侧边栏"
      title="展开侧边栏"
      @click="toggleSidebar"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="15" rx="2" />
        <path d="M9.5 4.5v15" />
        <path d="M13 9.5l2.5 2.5L13 14.5" />
      </svg>
    </button>

    <div class="body">
      <header class="appbar">
        <div class="brand serif">
          <img class="brand-mark" :src="brandMark" alt="" aria-hidden="true" />
          <div class="brand-text">
            <b>观梅</b>
            <span class="brand-latin"
              ><span class="brand-dot" aria-hidden="true">·</span>PLUMORA</span
            >
          </div>
        </div>
        <div class="appbar-ops">
          <QrEntry variant="bar" />
          <button type="button" class="icon-btn" aria-label="设置" @click="settingsOpen = true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" />
            <path
              d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z"
              />
            </svg>
          </button>
        </div>
      </header>

      <main class="content scroll-area">
        <div class="content-inner">
          <!--
            详情视图按 path 缓存（viewKey），即每条卦例占一个实例。
            不设上限的话，长列表逐条浏览会让实例（以及各自持有的 window keydown 监听）
            只增不减；:max 让 KeepAlive 按 LRU 淘汰，同时容得下 4 个 Tab 视图
            + 最近 2 条详情（审查 W-13）。
          -->
          <KeepAlive :max="6">
            <component :is="view" :key="viewKey" />
          </KeepAlive>
        </div>
      </main>

      <!--
        底部 3 Tab —— 手机形态专属。桌面形态左侧已有主菜单（产品口径：电脑模式
        不显示底部菜单），由下方 [data-layout='desk'] .tabbar 规则隐藏；
        手机框预览不改 data-layout（框内仍是手机形态），所以框内照常显示。
        隐藏用 CSS 而非 v-if：display:none 同时移出 Tab 序与无障碍树，
        桌面形态下侧栏是唯一导航入口，且切换形态无需 JS 重算。
      -->
      <div class="tabbar">
        <NavList variant="tabs" />
      </div>
    </div>

    <SettingsPanel :open="settingsOpen" @close="settingsOpen = false" />
    <QrCodeDialog :open="qrOpen" @close="closeQr" />
    <ToastHost />
    <DisclaimerGate />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100%;
  background: var(--c-bg);
}

/* ---------- 桌面端侧栏 ---------- */
.sidebar {
  display: none;
  flex-direction: column;
  width: var(--sidebar-w);
  flex: none;
  padding: 24px 16px 18px;
  border-right: 1px solid var(--c-line);
  background: var(--c-bg);
}

/* 收回态：整条侧栏退出布局（display:none 一并移出 Tab 序与无障碍树），
   内容区随之占满；展开钮从 .side-reopen 浮出。
   选择器必须带上 [data-layout='desk']：与「桌面形态展开侧栏」规则
   （下方 [data-layout='desk'] .sidebar）特异性持平，仅靠书写顺序取胜
   太脆——将来任何人调整两条规则的先后，收回态就会被静默打破。 */
[data-layout='desk'] .sidebar.collapsed {
  display: none;
}

/* 品牌行：印章 + 字标居左，收回钮居右 */
.brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 8px 22px;
}

.brand-row .brand {
  padding: 0;
  min-width: 0;
}

/* 收回钮：沿用 .icon-btn 的标准 40px 圆形（与顶栏各钮同款，触控目标一致）。
   早先想缩到 36px 给品牌让位，但 .icon-btn 同特异性后置胜出、36px 从未生效；
   品牌改两行 lockup 后侧栏本就有位置，无需再缩，故删去该条失效覆盖。 */

/* 展开钮：侧栏收回后浮在内容区左上角。只桌面形态渲染意义
   （手机形态侧栏本就不存在），用 [data-layout] 兜底隐藏。 */
.side-reopen {
  position: fixed;
  left: 16px;
  top: 16px;
  z-index: 40;
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--c-line);
  border-radius: 50%;
  background: var(--c-surface);
  color: var(--c-ink);
  box-shadow: 0 2px 10px rgb(0 0 0 / 8%);
}

.side-reopen svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.side-reopen:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

[data-layout='desk'] .side-reopen {
  display: flex;
}

.sidebar-foot {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.side-settings {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--tap-min);
  padding: 10px 14px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: var(--c-surface);
  color: var(--c-muted);
  font-size: var(--fs-base);
  text-align: left;
}

.side-settings svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
  flex: none;
}

.side-settings:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

/* ---------- 主区 ---------- */
.body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

/* ---------- 移动形态顶栏：两行 ----------
 *
 * 顶栏只在手机形态存在（见文末 [data-layout='desk'] .appbar 整块隐藏，
 * 桌面走左侧栏），所以两行结构直接写在基规则里，不必再挂一层 data-layout；
 * 手机框预览（data-device='phone'）里跑的就是这套移动形态，效果一并生效。
 *
 * 第 1 行：品牌（印章 + 观梅 + PLUMORA 字标）独占整行、居左，
 *          不再被后面 4 个操作钮挤压 —— 产品反馈「标题行要单独成行」。
 * 第 2 行：全部操作钮（扫码 / 设置）整体右对齐，
 *          沿用单行时代「按钮靠右」的节奏，与标题错开成两行。
 *          用列向 flex 堆叠而不是 flex-wrap 换行：行的归属由结构写死，
 *          不依赖各子项 basis 刚好放不下（那样窄屏一变宽就会回流成一行）。
 *
 * 行高：第 1 行由 30px 印章 / 22px 标题撑到约 33px；第 2 行是 48px 触控行
 *      （按钮 min-height: --tap-min，48dp 触控下限），行距 8px ——
 *      与下方 padding 同为 8，两行读起来是一条顶栏、不是两块各自为政。
 * 分隔线：淡墨 var(--c-line) 收在整条顶栏底部，与内容区起始间距 = 自身
 *      padding 8px + 分隔线 1px + .content-inner 6px ≈ 15px。
 * sticky：顶栏本就在滚动容器（.content / .scroll-area）之外，天然常驻、
 *      内容在它下面滚；改两行后高度变高但行为不变，无需 position: sticky。 */
.appbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  row-gap: 8px;
  padding: 12px 16px 8px;
  border-bottom: 1px solid var(--c-line);
  flex: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
}

.brand-mark {
  display: block;
  width: 30px;
  height: 30px;
  flex: none;
}

.sidebar .brand-mark {
  width: 36px;
  height: 36px;
}

/* 侧栏品牌两行 lockup：一行排不下——Logo(36) +「观梅」+「· PLUMORA」
   还要给收回钮留位，自然宽约 190px > 可用约 179px（260px 侧栏实测）。
   与其被 flex 拆行，不如显式排成两行：「观梅」在上、「· PLUMORA」
   在下左对齐，Logo 与两行文字整体垂直居中——工整且不随字宽度量漂移。 */
.sidebar .brand-text {
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
}

.brand-text {
  display: flex;
  align-items: baseline;
  gap: 8px;
  /* 放不下时整组拉丁字标换到第二行；flex-wrap 只是兜底，侧栏的两行
     lockup 是显式排的（见下方 .sidebar .brand-text）。 */
  flex-wrap: wrap;
  align-content: flex-start;
}

.brand b {
  font-size: var(--fs-xl);
  letter-spacing: 2px;
  /* 「观梅」两个字永不拆行：拆开正是用户反馈的「怪怪的」 */
  white-space: nowrap;
}

/* 「· PLUMORA」捆成一组，换行时整体搬，不和间隔点拆开 */
.brand-latin {
  white-space: nowrap;
}

.brand span {
  font-size: var(--fs-xs);
  color: var(--c-muted);
  letter-spacing: 1px;
}

/* 顶栏两行后第一行再无对手，拉丁字标 PLUMORA 常驻，不再随窄屏退场。
 * （此处原先有 @media (max-width:380px) 隐藏 .appbar .brand span 的补丁：
 *   单行时代标题要跟 4 个操作钮抢地方。现在品牌独占一行，320px 视口下
 *   第一行可用宽 320-32=288px，品牌整串实测约 155px，恒不折行、不溢出；
 *   且 .brand / .brand-text 都是 min-width:auto 的 flex item，
 *   「PLUMORA」是单个词，min-content 即整词宽，也不存在折成两行的可能。） */

.appbar-ops {
  display: flex;
  align-items: center;
  justify-content: flex-end; /* 第二行整体靠右，与居左的品牌行错开 */
  gap: 8px;
  flex: none;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--c-line);
  border-radius: 50%;
  background: var(--c-surface);
  color: var(--c-ink);
  flex: none;
}

.icon-btn svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
}

.icon-btn:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.content {
  flex: 1;
  min-height: 0;
}

.content-inner {
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 6px 16px 24px;
}

/* ---------- 底部 3 Tab（手机形态专属） ----------
 *
 * 桌面形态隐藏：左侧侧栏已是主菜单，两处同时出现等于重复入口
 * （产品口径「电脑模式不要下方主菜单」）。三态关系：
 *   ① data-layout='desk'  → 隐藏（宽屏强制电脑模式也算，判据只看这个属性）
 *   ② data-layout='mobile' → 显示（真机窄屏 / 宽屏强制手机模式；
 *                             此时侧栏 display:none，Tab 是唯一导航入口）
 *   ③ 手机框预览 data-device='phone' 只在「宽屏 + 手机形态」出现，
 *      且不改 data-layout → 框内仍是手机形态，底部 Tab 照常显示。
 * 900px 断点只在 platform/settings.ts 被解析成 data-layout，CSS 不写媒体查询
 * （runtime-smoke 会断言样式表里没有残留的 @media (min-width: 900px)）。
 * 用 display:none 而非 v-if：元素一并移出 Tab 序与无障碍树，桌面形态下
 * 侧栏是唯一导航入口；且切形态不需要 JS 重算，首屏无闪烁。
 */
.tabbar {
  flex: none;
}

[data-layout='desk'] .tabbar {
  display: none;
}

/* ---------- 断点：桌面端展开 ----------
 *
 * 判据是 `<html data-layout>`，不是 `@media (min-width: 900px)`。
 * 媒体查询只能读视口宽度，用户没法在宽屏上主动切「手机模式」（看效果 / 窄屏对拍），
 * 也没法在窄屏上切回「电脑模式」。改由 JS 统一把「视口自适应 + 用户强制」
 * 解析成一个属性（platform/settings.ts 的 applyLayout），CSS 只认这个属性。
 * 首屏防闪：index.html 的内联脚本会在样式生效前先写好 data-layout。 */
[data-layout='desk'] .sidebar {
  display: flex;
}

[data-layout='desk'] .appbar {
  display: none;
}

[data-layout='desk'] .content-inner {
  padding: 28px 32px 48px;
}
</style>
