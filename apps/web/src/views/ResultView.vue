<script setup lang="ts">
/** 排盘结果页 —— 06 §3.2；保存卦例后提供「查看」动作（06 §五） */
import { computed, onActivated, ref, watch } from 'vue';
import { buildRecord, methodCn, type ResolvedHexagram } from '@plumora/core';
import { TRIGRAMS } from '@plumora/knowledge';
import ResultPanel from '@/components/ResultPanel.vue';
import { enforceRecordLimit, insertRecord } from '@/platform/records';
import { goBack, navigate, replaceRoute, route } from '@/router';
import { useCurrentCast } from '@/stores/cast';
import { refreshRecords } from '@/stores/records';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/toast';

const settings = useSettings();
const current = useCurrentCast();
/** 起卦前填写、随起卦结果带出；此处仍可修改，再决定是否保存为卦例 */
const question = ref(current.value?.question ?? '');
const saving = ref(false);

// 本组件被 App 的 <KeepAlive> 缓存，「再起一卦」后回到结果页不会重新挂载，
// question 只会在首次挂载时初始化——不监听就会一直显示上一次的空值
// （表现：起卦页填了所问之事，解卦却说「没有记下具体问的是什么事」）。
// 这里监听暂存的 question：每次起卦（setCurrentCast 更新 current）后，
// 把输入同步为本次起卦带入的所问之事。
watch(
  () => current.value?.question,
  (q) => {
    question.value = q ?? '';
  },
);

// 直接访问 /result（或刷新后会话丢失）时回到起卦页
onActivated(() => {
  if (!current.value) replaceRoute('/cast');
});

const resolved = computed<ResolvedHexagram | null>(() => current.value?.resolved ?? null);
const cast = computed(() => current.value?.cast ?? null);

const title = computed(() => {
  const c = cast.value;
  return c ? methodCn(c.method) : '排盘';
});

async function save() {
  const c = cast.value;
  const r = resolved.value;
  if (!c || !r || saving.value) return;
  saving.value = true;
  try {
    const draft = buildRecord({
      cast: c,
      resolved: r,
      lunarLabel: current.value?.lunarLabel ?? '',
    });
    const id = await insertRecord({ ...draft, question: question.value.trim() || null });
    await enforceRecordLimit(settings.recordLimit);
    await refreshRecords();
    question.value = '';
    toast('卦例已保存', { label: '查看', run: () => navigate(`/records/${id}`) });
  } catch (e) {
    toast(`保存失败：${(e as Error).message}`);
  } finally {
    saving.value = false;
  }
}

/** 复制排盘文本（FR-11 的轻量替代；图片分享属 M3） */
const copyText = computed(() => {
  const r = resolved.value;
  const c = cast.value;
  if (!r || !c) return '';
  return [
    '【观梅 · Plumora 排盘】',
    current.value?.lunarLabel ?? '',
    methodCn(c.method),
    `本卦：${r.ben.name}（${TRIGRAMS[r.upper].name}上${TRIGRAMS[r.lower].name}下）动爻 ${r.movingLineName}`,
    `互卦：${r.hu.name}　变卦：${r.bian.name}`,
    `体：${TRIGRAMS[r.ti].name}　用：${TRIGRAMS[r.yong].name}`,
    `${r.judge.summary}`,
    `本卦卦意：${r.ben.keywords.join('、')}`,
    '仅供传统文化学习研究使用',
  ]
    .filter(Boolean)
    .join('\n');
});

async function copy() {
  try {
    await navigator.clipboard.writeText(copyText.value);
    toast('已复制排盘文本');
  } catch {
    toast('当前环境不支持自动复制，请手动选择文本');
  }
}

const isRecordDetail = computed(() => route.value.name === 'record-detail');
</script>

<template>
  <div v-if="resolved && cast" class="result-view">
    <header class="r-header">
      <button
        v-if="!isRecordDetail"
        type="button"
        class="icon-btn"
        aria-label="返回"
        @click="goBack('/cast')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <h1 class="title serif">{{ title }}</h1>
    </header>

    <!-- 排盘结果（含三卦切换；解卦参考卡在其内部：生克结论卡之后、体用类象之前） -->
    <ResultPanel :resolved="resolved" :context="current?.context" :question="question" />

    <!-- 起卦完成：所问之事已从起卦页带入（可修改），由用户决定是否保存卦例 -->
    <section class="card save">
      <h3 class="card-title">保存卦例（选填）</h3>
      <div class="field">
        <label for="q">所问之事（起卦前填写，此处可修改）</label>
        <input id="q" v-model="question" type="text" maxlength="200" placeholder="默念所问，一事一占" />
      </div>
      <div class="ops">
        <button type="button" class="btn-main" :disabled="saving" @click="save">保存卦例</button>
        <button type="button" class="btn-ghost" @click="copy">复制排盘</button>
      </div>
    </section>

    <button type="button" class="btn-ghost block" @click="navigate('/cast')">再起一卦</button>

    <p class="foot">本应用仅供传统文化学习与研究使用。</p>
  </div>
</template>

<style scoped>
.result-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.r-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.r-header .title {
  font-size: var(--fs-lg);
  letter-spacing: 2px;
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

.save .ops {
  display: flex;
  gap: 10px;
}

.save .ops .btn-main {
  flex: 1;
  font-size: var(--fs-md);
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  padding: 12px 14px;
}

.save .ops .btn-ghost {
  flex: none;
  white-space: nowrap;
}

.block {
  width: 100%;
}

.foot {
  padding-bottom: 8px;
  text-align: center;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}
</style>
