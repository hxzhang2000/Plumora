<script setup lang="ts">
/** 二次确认对话框 —— 06 §五：删除必须二次确认，并明确显示对象 */
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }>(),
  { message: '', confirmText: '确认', cancelText: '取消', danger: false },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

/** 弹窗根节点：既是键盘事件的「作用域判据」，也是打开时的焦点落点 */
const dialogEl = ref<HTMLElement | null>(null);

/**
 * 只在事件目标位于弹窗内部时响应。
 *
 * 原实现直接挂在 window 上、只看 props.open：只要弹窗「处于打开状态」，
 * 无论焦点在哪、无论当前是不是本页面，Enter 都会触发 confirm。
 * 于是「详情页点了删除 → 侧滑/后退回到列表页」时，用户在列表页按 Enter
 * 会打到一个 id 已失效的删除流程上（审查 W-2）。
 */
function onKey(e: KeyboardEvent) {
  if (!props.open) return;
  const root = dialogEl.value;
  const target = e.target as Node | null;
  if (!root || !target || !root.contains(target)) return;

  if (e.key === 'Escape') {
    emit('cancel');
    return;
  }
  if (e.key !== 'Enter') return;
  // 焦点已在按钮上时，浏览器会把 Enter 合成为一次 click —— 交给 click 处理，
  // 否则会「按一次、确认两次」（对删除这类不可逆操作不可接受）。
  if (target instanceof HTMLElement && target.closest('button')) return;
  emit('confirm');
}

/** 关闭态必须真正复位 body 滚动锁，否则遮罩没了、页面也滚不动 */
function syncBodyScroll(open: boolean) {
  document.body.style.overflow = open ? 'hidden' : '';
}

watch(
  () => props.open,
  async (v) => {
    syncBodyScroll(v);
    if (!v) return;
    // 打开时把焦点移入弹窗：① 键盘用户能立刻 Esc/Enter；
    // ② 让上面的 contains() 判据成立，避免弹窗开了却「按键无反应」。
    await nextTick();
    dialogEl.value?.focus();
  },
);

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  syncBodyScroll(false);
});
// 兜底：若本组件将来被放进 <KeepAlive> 缓存，离开时也要解锁滚动
// （KeepAlive 只 deactivate 不 unmount，onBeforeUnmount 不会执行）
onDeactivated(() => syncBodyScroll(false));
onActivated(() => syncBodyScroll(props.open));
</script>

<template>
  <Teleport to="body">
    <Transition name="dlg">
      <div v-if="open" class="mask" @click.self="emit('cancel')">
        <div
          ref="dialogEl"
          class="dialog"
          role="alertdialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
        >
          <h3>{{ title }}</h3>
          <p v-if="message" class="msg">{{ message }}</p>
          <div class="ops">
            <button type="button" class="btn-ghost" @click="emit('cancel')">{{ cancelText }}</button>
            <button
              type="button"
              class="btn-ghost"
              :class="{ 'btn-danger': danger }"
              @click="emit('confirm')"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--c-scrim);
}

.dialog {
  width: min(360px, 100%);
  padding: 20px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-float);
}

/* tabindex="-1" 只为承载打开时的程序化焦点，不参与 Tab 序 */
.dialog:focus {
  outline: none;
}

.dialog h3 {
  font-family: var(--font-serif);
  font-size: var(--fs-lg);
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.dialog .msg {
  font-size: var(--fs-base);
  line-height: 1.7;
  color: var(--c-text);
  white-space: pre-line;
}

.dialog .ops {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.dialog .ops > * {
  flex: 1;
}

.dlg-enter-active,
.dlg-leave-active {
  transition: opacity var(--dur);
}

.dlg-enter-from,
.dlg-leave-to {
  opacity: 0;
}
</style>
