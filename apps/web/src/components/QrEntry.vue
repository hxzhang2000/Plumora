<script setup lang="ts">
/**
 * 扫码入口按钮 —— 「手机扫码打开本页」的常驻入口
 *
 * 与 LayoutToggle 同一个摆放理由：两种形态互相隐藏（桌面形态没有顶栏、
 * 手机形态没有侧栏），所以顶栏与侧栏各放一份，任何形态下扫码入口都在。
 * 设置面板「跨设备」区的原入口保留——三处点开的是同一个弹窗
 * （stores/qrDialog 的共享状态，弹窗本体在 App.vue 只渲染一份）。
 *
 * 图标沿用设置面板原入口的那枚二维码（三定位角 + 模块），纯填充绘制。
 */
import { openQr } from '@/stores/qrDialog';

defineProps<{ variant: 'bar' | 'side' }>();
</script>

<template>
  <button
    type="button"
    class="qr-entry"
    :class="variant"
    aria-label="手机扫码打开本页"
    :title="variant === 'bar' ? '手机扫码打开本页' : undefined"
    @click="openQr"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h6v6H4zM6 6h2v2H6zM14 4h6v6h-6zM16 6h2v2h-2zM4 14h6v6H4zM6 16h2v2H6z" />
      <path d="M14 14h2v2h-2zM16 16h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
    </svg>
    <span v-if="variant === 'side'">手机扫码打开本页</span>
  </button>
</template>

<style scoped>
/* 顶栏版：与 .icon-btn / DeviceFrameToggle 同款圆形图标钮 */
.qr-entry {
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

.qr-entry svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
  stroke: none;
  flex: none;
}

.qr-entry:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

/* 侧栏版：与侧栏「设置」按钮同款，占满一行、左对齐（App.vue .side-settings） */
.qr-entry.side {
  width: 100%;
  min-height: var(--tap-min);
  justify-content: flex-start;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--r-md);
  color: var(--c-muted);
  font-size: var(--fs-base);
  text-align: left;
}

.qr-entry.side svg {
  width: 20px;
  height: 20px;
}
</style>
