<script setup lang="ts" generic="T extends string">
/** 分段控件（方式选择器 / 模式切换）—— 06 §3.1 */

const props = defineProps<{
  modelValue: T;
  options: readonly { readonly value: T; readonly label: string }[];
  /** 紧凑模式：用于卡片内的二级切换 */
  compact?: boolean;
  ariaLabel?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: T] }>();

/**
 * 语义为 radiogroup 而非 tablist（审查 W-8）：
 * 这里没有 tabpanel，也没有「面板随选中项切换」的关系，用 role="tab" 属于错误标注。
 * 单选组是准确模型——因此按 WAI-ARIA radio group 约定：
 *   · 只有选中项留在 Tab 序（tabindex=0），其余为 -1；
 *   · 方向键在组内移动并同时改变选中值，Home/End 跳到首尾。
 */
function onKeydown(e: KeyboardEvent) {
  const nav = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (!nav.includes(e.key)) return;
  const last = props.options.length - 1;
  if (last < 0) return;
  const idx = props.options.findIndex((o) => o.value === props.modelValue);
  const from = idx < 0 ? 0 : idx;
  let next = from;
  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      next = from <= 0 ? last : from - 1;
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      next = from >= last ? 0 : from + 1;
      break;
    case 'Home':
      next = 0;
      break;
    default:
      next = last;
  }
  e.preventDefault();
  const target = props.options[next];
  if (!target) return;
  emit('update:modelValue', target.value);
  const group = e.currentTarget as HTMLElement | null;
  group?.querySelectorAll<HTMLButtonElement>('.seg-btn')[next]?.focus();
}
</script>

<template>
  <div
    class="seg"
    :class="{ compact }"
    role="radiogroup"
    :aria-label="ariaLabel"
    @keydown="onKeydown"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      class="seg-btn"
      :class="{ active: opt.value === modelValue }"
      :aria-checked="opt.value === modelValue"
      :tabindex="opt.value === modelValue ? 0 : -1"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.seg {
  display: flex;
  gap: 3px;
  padding: 3px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
}

.seg-btn {
  flex: 1;
  min-height: 38px;
  padding: 8px 4px;
  border: 0;
  border-radius: 9px;
  background: none;
  color: var(--c-muted);
  font-size: var(--fs-sm);
  white-space: nowrap;
  transition: background var(--dur), color var(--dur);
}

.seg.compact .seg-btn {
  min-height: 34px;
  font-size: var(--fs-xs);
}

.seg-btn:hover {
  color: var(--c-ink);
}

.seg-btn.active {
  background: var(--c-ink);
  color: var(--c-bg);
}
</style>
