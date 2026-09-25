<script setup lang="ts">
/**
 * 卦例详情 —— 06 §3.3：排盘结果页复用 + 顶部「所问之事」编辑区 + 底部操作
 *
 * 体用取自记录落库的 tiTrigram / yongTrigram（04 §2.2），
 * 不会因为用户后来切换「体用判定流派」而改变历史卦例的结论。
 */
import { computed, onDeactivated, ref, watch } from 'vue';
import {
  METHOD_CN,
  VERIFY_STATUS_CN,
  VERIFY_STATUS_LIST,
  recordTitle,
  replayRecord,
  type HexagramRecord,
  type InputParams,
  type VerifyStatus,
} from '@plumora/core';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ResultPanel from '@/components/ResultPanel.vue';
import { deleteRecord, getRecord, updateRecord } from '@/platform/records';
import { goBack, navigate, replaceRoute, route } from '@/router';
import { refreshRecords } from '@/stores/records';
import { toast } from '@/stores/toast';

const record = ref<HexagramRecord | null>(null);
const notFound = ref(false);
/** 读库失败的独立通道：与 notFound 区分开——「没有这条」和「读不到」要给不同提示 */
const loadError = ref<string | null>(null);
const confirmDelete = ref(false);
const dirty = ref(false);

const question = ref('');
const note = ref('');
const verifyStatus = ref<VerifyStatus>('UNVERIFIED');

const id = computed(() => Number(route.value.params.id));

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function load() {
  loadError.value = null;
  try {
    const rec = await getRecord(id.value);
    if (!rec) {
      notFound.value = true;
      record.value = null;
      return;
    }
    notFound.value = false;
    record.value = rec;
    question.value = rec.question ?? '';
    note.value = rec.note ?? '';
    verifyStatus.value = rec.verifyStatus;
    dirty.value = false;
  } catch (e) {
    // 隐私模式 / 站点数据被禁 → IndexedDB 不可用。原来这里会把拒绝吞成
    // unhandledrejection，页面只剩页头一个返回箭头，用户既没提示也走不掉（审查 W-4）。
    notFound.value = false;
    record.value = null;
    loadError.value = messageOf(e);
  }
}

void load();

watch(id, () => void load());

/**
 * 离开详情页时复位弹窗状态。
 * confirmDelete 是本组件的局部状态，而本组件被 App 的 <KeepAlive> 缓存——
 * 「点了删除 → 侧滑/后退到列表页」时组件只是 deactivate，弹窗会留在 DOM 里
 * 盖住列表页，并把 body 滚动锁死（审查 W-1）。
 */
onDeactivated(() => {
  confirmDelete.value = false;
});

const resolved = computed(() => (record.value ? replayRecord(record.value) : null));

/**
 * 页头标题 = 卦例名称（core 的 recordTitle）：优先「所问之事」，未填时回退到卦名。
 * 取的是**已落库**的 question——所以用户在下方编辑框里改完要「保存修改」，
 * 标题才会跟着变，避免「输入框里改了但没保存，标题却已经变了」的错觉。
 */
const heading = computed(() => (record.value ? recordTitle(record.value) : '卦例详情'));

/** 从落库的 inputParams 还原起卦上下文（04 §2.4） */
const context = computed(() => {
  const rec = record.value;
  if (!rec) return '';
  let p: InputParams | null = null;
  try {
    p = JSON.parse(rec.inputParams) as InputParams;
  } catch {
    p = null;
  }
  const parts: string[] = [METHOD_CN[rec.method], rec.lunarLabel];
  if (p) {
    switch (p.type) {
      case 'TIME':
        parts.push(`年支${p.yearBranchNo}＋月${p.lunarMonth}＋日${p.lunarDay}，时${p.hourNo}`);
        break;
      case 'NUMBER':
        parts.push(p.mode === 'TWO' ? `两数 ${p.n1}、${p.n2}` : `一数 ${p.n1}，时辰 ${p.hourNo}`);
        break;
      case 'CHARACTER':
        parts.push(
          p.mode === 'TWO'
            ? `${p.chars.map((c, i) => `「${c}」${p.strokes[i]} 画`).join(' · ')} · 秒 ${p.second}`
            : `「${p.chars[0]}」${p.strokes[0]} 画 · 时辰 ${p.hourNo}`,
        );
        break;
      case 'SOUND':
        parts.push(`点数 ${p.count1}、${p.count2}`);
        break;
      case 'RANDOM':
        parts.push('随机取数（模拟外应）');
        break;
    }
  }
  parts.push(`动爻 ${rec.movingLine}`);
  return parts.join(' · ');
});

function markDirty() {
  dirty.value = true;
}

async function save() {
  const rec = record.value;
  if (!rec) return;
  const next: HexagramRecord = {
    ...rec,
    question: question.value.trim() || null,
    note: note.value.trim() || null,
    verifyStatus: verifyStatus.value,
    updatedAt: Date.now(),
  };
  try {
    await updateRecord(next);
  } catch (e) {
    toast(`保存失败：${messageOf(e)}`);
    return;
  }
  record.value = next;
  dirty.value = false;
  await refreshRecords();
  toast('已保存');
}

async function doDelete() {
  confirmDelete.value = false;
  const target = id.value;
  // 列表路由下 params.id 是 undefined → Number(undefined) = NaN。
  // 原来会把 NaN 一路传给 deleteRecord：弹窗关掉、记录没删、且**没有任何反馈**，
  // 用户以为删掉了（审查 W-2）。
  if (!Number.isInteger(target)) {
    toast('未能识别卦例编号，删除已取消');
    return;
  }
  try {
    await deleteRecord(target);
  } catch (e) {
    toast(`删除失败：${messageOf(e)}`);
    return;
  }
  await refreshRecords();
  toast('已删除');
  navigate('/records');
}
</script>

<template>
  <div class="detail">
    <header class="d-header">
      <button type="button" class="icon-btn" aria-label="返回" @click="goBack('/records')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <h1 class="title serif" :title="heading">{{ heading }}</h1>
    </header>

    <div v-if="loadError" class="empty">
      <p class="err-text">读取卦例失败：{{ loadError }}</p>
      <button type="button" class="btn-ghost" @click="replaceRoute('/records')">返回列表</button>
    </div>

    <div v-else-if="notFound" class="empty">
      <p>未找到该卦例（可能已被删除）</p>
      <button type="button" class="btn-ghost" @click="replaceRoute('/records')">返回列表</button>
    </div>

    <template v-else-if="resolved && record">
      <ResultPanel :resolved="resolved" :context="context" />

      <section class="card">
        <h3 class="card-title">卦例复盘</h3>
        <div class="field">
          <label for="q">所问之事</label>
          <input id="q" v-model="question" type="text" maxlength="200" @input="markDirty" />
        </div>
        <div class="field">
          <label for="n">备注</label>
          <textarea
            id="n"
            v-model="note"
            rows="4"
            placeholder="记录背景、进展与结果…"
            @input="markDirty"
          />
        </div>
        <div class="field">
          <label for="v">应验状态</label>
          <select id="v" v-model="verifyStatus" @change="markDirty">
            <option v-for="s in VERIFY_STATUS_LIST" :key="s" :value="s">
              {{ VERIFY_STATUS_CN[s] }}
            </option>
          </select>
        </div>
        <div class="ops">
          <button type="button" class="btn-ghost" :disabled="!dirty" @click="save">
            保存修改
          </button>
          <button type="button" class="btn-ghost btn-danger" @click="confirmDelete = true">
            删除
          </button>
        </div>
      </section>

      <button type="button" class="btn-ghost block" @click="navigate('/records')">
        返回卦例列表
      </button>
    </template>
  </div>

  <ConfirmDialog
    :open="confirmDelete"
    title="删除卦例"
    :message="`将删除「${heading}」· ${record?.lunarLabel ?? ''}，此操作不可恢复。`"
    confirm-text="确认删除"
    danger
    @cancel="confirmDelete = false"
    @confirm="doDelete"
  />
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.d-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.d-header .title {
  font-size: var(--fs-lg);
  letter-spacing: 2px;
  /* 名称可能是整句「所问之事」，最多两行，超出省略（完整文本见原生 title 提示） */
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: none;
  border: 1px solid var(--c-line);
  border-radius: 50%;
  background: var(--c-surface);
  color: var(--c-ink);
}

.icon-btn svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
}

textarea {
  resize: vertical;
  min-height: 88px;
}

.ops {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.ops > * {
  flex: 1;
}

.block {
  width: 100%;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

/* 与列表页的错误卡同款，保证同一故障在两个页面表现一致（审查 W-4） */
.err-text {
  padding: 10px 12px;
  border: 1px solid var(--c-second);
  border-radius: var(--r-md);
  font-size: var(--fs-sm);
  color: var(--c-second);
  word-break: break-word;
}
</style>
