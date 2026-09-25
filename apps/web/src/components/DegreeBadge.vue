<script setup lang="ts">
/** 吉凶程度徽标 —— 大吉 / 小吉 / 吉 / 小凶 / 大凶（03 文档 §1.3） */
import { computed } from 'vue';
import { DEGREE_CN, type FortuneDegree } from '@plumora/core';

const props = defineProps<{ degree: FortuneDegree }>();

const CLASS_OF: Record<FortuneDegree, string> = {
  DA_JI: 'daji',
  XIAO_JI: 'xiaoji',
  JI: 'ji',
  XIAO_XIONG: 'xiaoxiong',
  DA_XIONG: 'daxiong',
};

const cls = computed(() => CLASS_OF[props.degree]);
const text = computed(() => DEGREE_CN[props.degree]);
</script>

<template>
  <span class="badge" :class="cls">{{ text }}</span>
</template>
