<script setup lang="ts">
/**
 * 手机框预览开关 —— 「真机框」的进出按钮
 *
 * 只在「宽屏 + 手机形态」下渲染（父级 v-if=available），真机窄屏永不出现，
 * 因此不会挤占真手机顶栏的位置。
 *
 * 语义与 LayoutToggle 相同：按钮状态 = 当前是否在框内，aria-pressed 供读屏判读。
 * 图形是「四角取景框 + 手机」，与 LayoutToggle 的单体手机图标区分开。
 */
import { computed } from 'vue';
import { toggleDeviceFrame, useDeviceFrame } from '@/stores/deviceFrame';

const { framed } = useDeviceFrame();

const ariaLabel = computed(() =>
  framed.value ? '手机框预览：进行中，点击退出真机框' : '手机框预览：未启用，点击套上真机框',
);
</script>

<template>
  <button
    type="button"
    class="frame-toggle"
    :class="{ on: framed }"
    :aria-label="ariaLabel"
    :aria-pressed="framed"
    title="手机框预览"
    @click="toggleDeviceFrame()"
  >
    <!-- 取景框四角 + 手机本体 -->
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 6.5V4.6A1.6 1.6 0 0 1 4.6 3h1.9M17.5 3h1.9A1.6 1.6 0 0 1 21 4.6v1.9M21 17.5v1.9a1.6 1.6 0 0 1-1.6 1.6h-1.9M6.5 21H4.6A1.6 1.6 0 0 1 3 19.4v-1.9"
      />
      <rect x="8" y="6.5" width="8" height="11" rx="2" />
      <path d="M10.9 14.8h2.2" />
    </svg>
  </button>
</template>

<style scoped>
.frame-toggle {
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
  transition: border-color var(--dur), color var(--dur), background var(--dur);
}

.frame-toggle svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.frame-toggle:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

/* 框内：朱砂点睛——一眼看出「现在是真机框预览」 */
.frame-toggle.on {
  border-color: var(--c-accent);
  background: var(--c-accent-soft);
  color: var(--c-accent);
}
</style>
