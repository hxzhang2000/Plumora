<script setup lang="ts">
/**
 * 解卦卡 —— 结合卦象与所问之事，给出传统断法参考（interpret 引擎的 UI 呈现）
 *
 * 位置：ResultPanel 本卦视图内，生克结论卡之后、体用类象之前
 * （2026-10-13 用户要求；仅本卦 tab 展示——解卦基于本卦体用整体断事）。
 * question 变化时实时重算（输入框即改即看）；为空时按综合泛断。
 */
import { computed } from 'vue';
import { interpret, type Interpretation, type ResolvedHexagram } from '@plumora/core';

const props = defineProps<{
  resolved: ResolvedHexagram;
  question: string;
}>();

const result = computed<Interpretation>(() => interpret(props.resolved, props.question));
</script>

<template>
  <section class="card interp">
    <h3 class="card-title">
      解卦参考<span v-if="result.domain !== 'GENERAL'" class="interp-domain">（按「{{ result.domainCn }}」断）</span>
    </h3>

    <p class="interp-headline serif">{{ result.headline }}</p>

    <div v-for="s in result.sections" :key="s.label" class="interp-sec">
      <b class="interp-label">{{ s.label }}</b>
      <p class="interp-body">{{ s.body }}</p>
    </div>

    <p class="interp-advice">
      <b class="interp-label">建议</b>
      <span>{{ result.advice }}</span>
    </p>

    <div class="interp-answer">
      <b class="interp-label">答案</b>
      <p class="interp-answer-body serif">{{ result.answer }}</p>
    </div>

    <p class="interp-caveat">以上为梅花易数传统断法参考，事在人为，仅供传统文化学习研究。</p>
  </section>
</template>

<style scoped>
.interp-headline {
  margin: 0 0 12px;
  font-size: var(--fs-lg);
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--c-accent);
}

.interp-domain {
  margin-left: 6px;
  font-weight: 400;
  color: var(--c-muted);
}

.interp-sec {
  margin-bottom: 10px;
}

.interp-label {
  display: block;
  margin-bottom: 3px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-muted);
  letter-spacing: 1px;
}

.interp-body {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.85;
  color: var(--c-ink);
}

.interp-advice {
  margin: 10px 0 0;
  padding: 10px 12px;
  border-radius: var(--r-md);
  background: var(--c-accent-soft);
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-ink);
}

.interp-advice .interp-label {
  margin-bottom: 2px;
  color: var(--c-accent);
}

/* 最终答案：整卡最醒目的收尾块 */
.interp-answer {
  margin: 10px 0 0;
  padding: 12px 14px;
  border-radius: var(--r-md);
  background: var(--c-accent-soft);
}

.interp-answer .interp-label {
  margin-bottom: 4px;
  color: var(--c-accent);
}

.interp-answer-body {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: 600;
  line-height: 1.9;
  color: var(--c-ink);
}

.interp-caveat {
  margin: 10px 0 0;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}
</style>
