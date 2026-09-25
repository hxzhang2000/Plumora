<script setup lang="ts">
/**
 * 三爻卦符（自绘）—— 06 文档 §4.2 TrigramGlyph
 * 入参 lines 自下而上；用于学习页与类象卡。
 */
import { computed } from 'vue';
import { TRIGRAMS, type TrigramNumber, trigramLines } from '@plumora/knowledge';

const props = withDefaults(
  defineProps<{
    /** 先天八卦数；与 lines 二选一 */
    number?: TrigramNumber;
    /** 三爻，自下而上；与 number 二选一 */
    lines?: readonly number[];
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { size: 'sm' },
);

const resolvedLines = computed<readonly number[]>(() => {
  if (props.lines) return props.lines;
  if (props.number) return trigramLines(props.number);
  return [0, 0, 0];
});

const rows = computed(() =>
  resolvedLines.value.map((v, i) => ({ key: i, yang: v === 1 })).reverse(),
);

const ariaLabel = computed(() =>
  props.number ? `${TRIGRAMS[props.number].name}卦卦符` : '三爻卦符',
);
</script>

<template>
  <div class="glyph" :class="size" role="img" :aria-label="ariaLabel">
    <div v-for="row in rows" :key="row.key" class="yao" :class="{ yin: !row.yang }">
      <span class="bar" />
      <span v-if="!row.yang" class="bar" />
    </div>
  </div>
</template>
