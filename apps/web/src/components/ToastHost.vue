<script setup lang="ts">
/** 轻提示宿主 —— 06 §五 Snackbar */
import { dismissToast, useToasts } from '@/stores/toast';

const toasts = useToasts();

function run(id: number, fn: () => void) {
  fn();
  dismissToast(id);
}
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast">
        <span class="text">{{ t.text }}</span>
        <button v-if="t.action" type="button" class="act" @click="run(t.id, t.action.run)">
          {{ t.action.label }}
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  bottom: calc(var(--nav-h) + 16px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
  max-width: min(92vw, 460px);
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-radius: var(--r-pill);
  background: var(--c-ink);
  color: var(--c-bg);
  font-size: var(--fs-sm);
  box-shadow: var(--shadow-float);
  pointer-events: auto;
}

.toast .text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast .act {
  border: 0;
  background: none;
  color: var(--c-accent);
  font-size: var(--fs-sm);
  font-weight: 600;
  padding: 2px 4px;
}

[data-theme='dark'] .toast .act {
  color: #f0a89e;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity var(--dur), transform var(--dur);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 桌面端：Toast 挪到右下角（判据为 data-layout，见 App.vue 的断点说明。
   scoped CSS 会把属性加到最后一个选择器上，[data-layout] 在 <html> 上，
   后代选择器照样命中） */
[data-layout='desk'] .toast-host {
  left: auto;
  right: 28px;
  bottom: 28px;
  transform: none;
  align-items: flex-end;
}
</style>
