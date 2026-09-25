<script setup lang="ts">
/** 应验状态徽标 —— 未验 / 应验 / 未验中 / 不验（01 FR-07、04 §2.2） */
import { computed } from 'vue';
import { VERIFY_STATUS_CN, type VerifyStatus } from '@plumora/core';

const props = defineProps<{ status: VerifyStatus }>();

const cls = computed(() => `v-${props.status.toLowerCase()}`);
const text = computed(() => VERIFY_STATUS_CN[props.status]);
</script>

<template>
  <span class="badge" :class="cls">{{ text }}</span>
</template>
