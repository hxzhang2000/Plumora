<script setup lang="ts">
/**
 * 布局形态切换按钮 —— 「电脑模式 / 手机模式」一键互换
 *
 * 为什么在顶栏和侧栏各放一个（而不是只放一个）：
 * 两种形态会互相隐藏——桌面形态没有顶栏、手机形态没有侧栏。
 * 只放一个的话，切过去之后就切不回来了，用户只能去设置面板改。
 * 这与「设置」按钮在两处各放一个的做法一致。
 *
 * 按钮上显示的是**将要切成的形态**（而不是当前形态）：
 * 用户点的是「我想要什么」，不是「我现在是什么」。
 */
import { computed } from 'vue';
import { nextToggleLayout, resolveLayout } from '@/platform/settings';
import { updateSetting, useSettings } from '@/stores/settings';

defineProps<{ variant: 'bar' | 'side' }>();

const settings = useSettings();

/** 当前生效形态 */
const current = computed(() => resolveLayout(settings.layoutMode));
/** 点一下会切成的形态 */
const target = computed(() => nextToggleLayout(settings.layoutMode));

const label = computed(() => (target.value === 'DESKTOP' ? '电脑' : '手机'));
const currentLabel = computed(() => (current.value === 'desk' ? '电脑模式' : '手机模式'));

const ariaLabel = computed(
  () => `切换布局：当前${currentLabel.value}，点击切到${label.value}模式`,
);

function toggle() {
  updateSetting('layoutMode', target.value);
}
</script>

<template>
  <button
    type="button"
    class="layout-toggle"
    :class="variant"
    :aria-label="ariaLabel"
    @click="toggle"
  >
    <!-- 显示器：切到电脑模式 -->
    <svg v-if="target === 'DESKTOP'" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8.5 21h7M12 17v4" />
    </svg>
    <!-- 手机：切到手机模式 -->
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M10.8 18.6h2.4" />
    </svg>
    <span>{{ label }}</span>
  </button>
</template>

<style scoped>
.layout-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: var(--tap-min);
  padding: 0 12px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: var(--c-surface);
  color: var(--c-muted);
  font-size: var(--fs-sm);
  flex: none;
}

.layout-toggle svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.layout-toggle:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

/* 侧栏版：与「设置」按钮同款，占满一行、左对齐 */
.layout-toggle.side {
  width: 100%;
  gap: 12px;
  padding: 10px 14px;
  font-size: var(--fs-base);
  text-align: left;
}

.layout-toggle.side svg {
  width: 20px;
  height: 20px;
}
</style>
