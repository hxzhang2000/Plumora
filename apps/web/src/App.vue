<script setup lang="ts">
/**
 * 应用外壳 —— 自适应布局（用户要求「电脑端 + 移动端自适应」）
 *
 *   < 900px ：顶部标题栏 + 底部 3 Tab + 单列内容
 *   ≥ 900px ：左侧固定导航 + 居中内容区（06 §六 折叠屏/平板/桌面展开态）
 *
 * 底部 3 Tab 只属于手机形态：桌面形态左侧已有主菜单，两处同时出现是重复入口
 * （产品口径：电脑模式不显示底部菜单）。隐藏走 CSS（见下方 .tabbar 规则），
 * 判据仍是 data-layout，不用 JS 判断断点。
 *
 * 两种形态都渲染在 DOM 中，由 CSS 切换（判据是 `<html data-layout>`，
 * 见下方断点说明），避免 JS 断点判断带来的首屏闪烁与布局抖动。
 *
 * 用户可以在顶栏 / 侧栏一键切换「电脑模式 / 手机模式」（LayoutToggle），
 * 也可以在设置面板里选「自动 / 电脑 / 手机」。
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
import LayoutToggle from '@/components/LayoutToggle.vue';
import NavList from '@/components/NavList.vue';
import QrCodeDialog from '@/components/QrCodeDialog.vue';
import QrEntry from '@/components/QrEntry.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import ToastHost from '@/components/ToastHost.vue';
import { route } from '@/router';
import { useQrDialog } from '@/stores/qrDialog';

const settingsOpen = ref(false);

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
    <aside class="sidebar">
      <div class="brand serif">
        <img class="brand-mark" :src="brandMark" alt="" aria-hidden="true" />
        <div class="brand-text">
          <b>观梅</b>
          <span class="brand-dot" aria-hidden="true">·</span>
          <span>PLUMORA</span>
        </div>
      </div>
      <NavList variant="side" />
      <div class="sidebar-foot">
        <LayoutToggle variant="side" />
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
        <p class="disclaimer">本应用仅供传统文化学习与研究使用。</p>
      </div>
    </aside>

    <div class="body">
      <header class="appbar">
        <div class="brand serif">
          <img class="brand-mark" :src="brandMark" alt="" aria-hidden="true" />
          <div class="brand-text">
            <b>观梅</b>
            <span class="brand-dot" aria-hidden="true">·</span>
            <span>PLUMORA</span>
          </div>
        </div>
        <div class="appbar-ops">
          <LayoutToggle variant="bar" />
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

.sidebar .brand {
  padding: 0 8px 22px;
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

.disclaimer {
  padding: 0 8px;
  font-size: var(--fs-xs);
  line-height: 1.7;
  color: var(--c-muted);
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
 * 第 2 行：全部操作钮（布局切换 / 手机框 / 扫码 / 设置）整体右对齐，
 *          沿用单行时代「按钮靠右」的节奏，与标题错开成两行。
 *          用列向 flex 堆叠而不是 flex-wrap 换行：行的归属由结构写死，
 *          不依赖各子项 basis 刚好放不下（那样窄屏一变宽就会回流成一行）。
 *
 * 行高：第 1 行由 30px 印章 / 22px 标题撑到约 33px；第 2 行是 48px 触控行
 *      （LayoutToggle 的 min-height: --tap-min，48dp 触控下限），行距 8px ——
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

.brand-text {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.brand b {
  font-size: var(--fs-xl);
  letter-spacing: 2px;
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
