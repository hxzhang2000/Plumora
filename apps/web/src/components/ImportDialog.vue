<script setup lang="ts">
/**
 * 卦例导入对话框 —— 数据区「导入 JSON」的二次选择。
 *
 * 与 ConfirmDialog 的区别：确认动作有两种（合并 / 覆盖），覆盖是破坏性的，
 * 因此不能退化成简单的「确认 / 取消」。三键并排，覆盖额外标红。
 *
 * 键盘口径同 ConfirmDialog：Escape = 取消；Enter = **合并**（非破坏性默认），
 * 覆盖必须显式点击，避免误触清空既有卦例。
 * 通用弹层行为（Esc / 焦点陷阱 / 焦点回收 / 滚动锁）统一走 useDialog。
 */
import { onActivated, onDeactivated, ref } from 'vue';
import { useDialog } from '@/platform/useDialog';

export interface RejectedItem {
  readonly index: number;
  readonly reason: string;
}

const props = defineProps<{
  open: boolean;
  fileName: string;
  /** 文件内记录总条数 */
  total: number;
  /** 通过校验、可导入的条数 */
  accepted: number;
  /** 被跳过的记录（含原因） */
  rejected: readonly RejectedItem[];
  /** 本机当前已有卦例数（覆盖模式用于提示影响面） */
  existing: number;
}>();

const emit = defineEmits<{ merge: []; overwrite: []; cancel: [] }>();

const dialogEl = ref<HTMLElement | null>(null);

const dialog = useDialog({
  open: () => props.open,
  close: () => emit('cancel'),
  root: dialogEl,
  onKey: (e) => {
    if (e.key !== 'Enter') return false;
    // 焦点已在按钮上时浏览器会把 Enter 合成为 click，交给 click 处理，避免双触发
    if (e.target instanceof HTMLElement && e.target.closest('button')) return true;
    emit('merge');
    return true;
  },
});

onDeactivated(() => dialog.releaseLock());
onActivated(() => dialog.reacquireLock());
</script>

<template>
  <!-- 宿主 #app：预览态下即机身屏幕（说明见 SettingsPanel.vue 同处） -->
  <Teleport to="#app">
    <Transition name="dlg">
      <div v-if="open" class="mask" @click.self="emit('cancel')">
        <div
          ref="dialogEl"
          class="dialog"
          role="alertdialog"
          aria-modal="true"
          aria-label="导入卦例"
          tabindex="-1"
        >
          <h3>导入卦例</h3>
          <p class="msg">
            文件「{{ fileName }}」共 {{ total }} 条，其中 {{ accepted }} 条可导入{{
              rejected.length ? `，${rejected.length} 条因字段非法被跳过` : ''
            }}。
          </p>
          <p class="hint">
            <b>合并</b>：追加到现有 {{ existing }} 条之后。<br />
            <b class="danger-text">覆盖</b>：先清空现有全部卦例，再写入本文件的 {{
              accepted
            }} 条（不可恢复）。
          </p>
          <div v-if="rejected.length" class="rejected">
            <span class="rejected-title">跳过明细（前 5 条）</span>
            <ul>
              <li v-for="r in rejected.slice(0, 5)" :key="r.index">
                第 {{ r.index }} 条：{{ r.reason }}
              </li>
            </ul>
          </div>
          <div class="ops">
            <button type="button" class="btn-ghost" @click="emit('cancel')">取消</button>
            <button type="button" class="btn-ghost" @click="emit('merge')">合并</button>
            <button type="button" class="btn-ghost btn-danger" @click="emit('overwrite')">
              覆盖
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
  width: min(400px, 100%);
  padding: 20px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-float);
}

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
  word-break: break-word;
}

.dialog .hint {
  margin-top: 10px;
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-muted);
}

.danger-text {
  color: var(--c-second);
}

.rejected {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.rejected-title {
  display: block;
  margin-bottom: 4px;
}

.rejected ul {
  list-style: none;
  line-height: 1.7;
}

.dialog .ops {
  display: flex;
  gap: 8px;
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
