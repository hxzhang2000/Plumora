<script setup lang="ts">
/**
 * 导航列表 —— 同一份数据渲染两种形态（06 §二）：
 *   移动端：底部 3 Tab（起卦 / 卦例 / 学习）
 *   桌面端：左侧竖向导航
 */
import { activeTab, navigate } from '@/router';

defineProps<{ variant: 'tabs' | 'side' }>();

const ITEMS = [
  { tab: 'cast', label: '起卦', path: '/cast' },
  { tab: 'records', label: '卦例', path: '/records' },
  { tab: 'learn', label: '学习', path: '/learn' },
] as const;
</script>

<template>
  <nav :class="variant === 'tabs' ? 'tab-bar' : 'side-list'" :aria-label="'主导航'">
    <button
      v-for="item in ITEMS"
      :key="item.tab"
      type="button"
      class="nav-item"
      :class="{ active: activeTab === item.tab }"
      :aria-current="activeTab === item.tab ? 'page' : undefined"
      @click="navigate(item.path)"
    >
      <!-- 线性图标，2dp 描边，与墨线同色（06 §4.3） -->
      <svg v-if="item.tab === 'cast'" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4h12M9 8h6M6 12h12M9 16h6M6 20h12" />
      </svg>
      <svg v-else-if="item.tab === 'records'" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2zM19 3v18M8 7h7M8 11h7" />
      </svg>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
/* ---------- 移动端底部 Tab ---------- */
.tab-bar {
  display: flex;
  border-top: 1px solid var(--c-line);
  background: var(--c-surface);
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-bar .nav-item {
  flex: 1;
  min-height: var(--nav-h);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 0;
  background: none;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  transition: color var(--dur);
}

.tab-bar .nav-item svg {
  width: 22px;
  height: 22px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tab-bar .nav-item.active {
  color: var(--c-accent);
}

/* ---------- 桌面端侧边导航 ---------- */
.side-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.side-list .nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--tap-min);
  padding: 10px 14px;
  border: 0;
  border-radius: var(--r-md);
  background: none;
  color: var(--c-muted);
  font-size: var(--fs-base);
  text-align: left;
  transition: background var(--dur), color var(--dur);
}

.side-list .nav-item svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex: none;
}

.side-list .nav-item:hover {
  background: var(--c-surface);
  color: var(--c-ink);
}

.side-list .nav-item.active {
  background: var(--c-accent-soft);
  color: var(--c-accent);
  font-weight: 600;
}
</style>
