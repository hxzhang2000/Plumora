<script setup lang="ts">
/**
 * 应用外壳 —— 自适应布局（用户要求「电脑端 + 移动端自适应」）
 *
 *   < 900px ：顶部标题栏 + 底部 3 Tab + 单列内容
 *   ≥ 900px ：左侧固定导航 + 居中内容区（06 §六 折叠屏/平板/桌面展开态）
 *
 * 两种形态都渲染在 DOM 中，由 CSS 媒体查询切换，
 * 避免 JS 断点判断带来的首屏闪烁与布局抖动。
 */
import { computed, ref } from 'vue';
import CastView from '@/views/CastView.vue';
import LearnView from '@/views/LearnView.vue';
import RecordDetailView from '@/views/RecordDetailView.vue';
import RecordsView from '@/views/RecordsView.vue';
import ResultView from '@/views/ResultView.vue';
import DisclaimerGate from '@/components/DisclaimerGate.vue';
import NavList from '@/components/NavList.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import ToastHost from '@/components/ToastHost.vue';
import { route } from '@/router';

const settingsOpen = ref(false);

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
    default:
      return CastView;
  }
});

// 详情视图按 path 重建；其余视图保活，切换 Tab 不丢输入
const viewKey = computed(() =>
  route.value.name === 'record-detail' ? route.value.path : route.value.name,
);

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
          <span>PLUMORA</span>
        </div>
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
        <p class="disclaimer">本应用仅供传统文化学习与研究使用。</p>
      </div>
    </aside>

    <div class="body">
      <header class="appbar">
        <div class="brand serif">
          <img class="brand-mark" :src="brandMark" alt="" aria-hidden="true" />
          <div class="brand-text">
            <b>观梅</b>
            <span>PLUMORA</span>
          </div>
        </div>
        <button type="button" class="icon-btn" aria-label="设置" @click="settingsOpen = true">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <path
              d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z"
            />
          </svg>
        </button>
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

      <NavList variant="tabs" />
    </div>

    <SettingsPanel :open="settingsOpen" @close="settingsOpen = false" />
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

.appbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 8px;
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

/* ---------- 断点：桌面端展开 ---------- */
@media (min-width: 900px) {
  .sidebar {
    display: flex;
  }

  .appbar {
    display: none;
  }

  .content-inner {
    padding: 28px 32px 48px;
  }
}
</style>
