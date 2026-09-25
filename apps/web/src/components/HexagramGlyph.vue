<script setup lang="ts">
/**
 * 六爻卦符（自绘）—— 06 文档 §4.2 HexagramGlyph
 *
 * - 入参 lines 一律**自下而上**（index 0 = 初爻），渲染时反转为自上而下
 * - 变卦不传 moving（06 §3.2：变卦中对应爻不再标点）
 * - 提供 aria-label，供屏幕阅读器朗读（06 §6.1）
 */
import { computed } from 'vue';
import { TRIGRAMS, getHexagram, linesToBinary, trigramByBinary } from '@plumora/knowledge';

const props = withDefaults(
  defineProps<{
    /** 六爻，自下而上 */
    lines: readonly number[];
    /** 动爻 1–6；0 表示不标动爻 */
    moving?: number;
    size?: 'sm' | 'md' | 'lg';
    /** 是否播放逐爻浮现动画（结果页开启，列表/回放关闭） */
    animate?: boolean;
    /** 自定义无障碍描述；留空则按 06 §6.1 的格式自动生成 */
    label?: string;
    /** 卦位前缀，用于自动生成描述：「本卦」/「互卦」/「变卦」 */
    role?: string;
  }>(),
  { moving: 0, size: 'md', animate: false, label: '', role: '' },
);

const rows = computed(() =>
  props.lines
    .map((v, i) => ({ key: i, yang: v === 1, moving: i + 1 === props.moving }))
    .reverse(),
);

/** 爻位序数（中文数字）—— 06 §6.1 的示例用「第一爻动」，与 core 的爻名（初六/九二）是两套口径 */
const ORDINAL = ['', '一', '二', '三', '四', '五', '六'] as const;

/**
 * 06 §6.1 规定的格式：「本卦水风井，上卦坎下卦巽，第一爻动」。
 *
 * 原实现生成的是「六爻卦符，上卦坎，下卦巽，第 1 爻动」——缺卦名、多逗号、
 * 用阿拉伯数字加空格，与规范不一致（审查 D-6）。
 */
const ariaLabel = computed(() => {
  if (props.label) return props.label;
  if (props.lines.length !== 6) return '卦符';
  const lowerNo = trigramByBinary(linesToBinary(props.lines.slice(0, 3)));
  const upperNo = trigramByBinary(linesToBinary(props.lines.slice(3, 6)));
  const upper = TRIGRAMS[upperNo].name;
  const lower = TRIGRAMS[lowerNo].name;
  const name = getHexagram(upperNo, lowerNo)?.name ?? '';
  const moving = props.moving ? `，第${ORDINAL[props.moving] ?? props.moving}爻动` : '';
  return `${props.role}${name}，上卦${upper}下卦${lower}${moving}`;
});
</script>

<template>
  <div class="glyph" :class="[size, { animate }]" role="img" :aria-label="ariaLabel">
    <div
      v-for="row in rows"
      :key="row.key"
      class="yao"
      :class="{ yin: !row.yang, moving: row.moving }"
    >
      <span class="bar" />
      <span v-if="!row.yang" class="bar" />
      <span v-if="row.moving" class="dot" />
    </div>
  </div>
</template>
