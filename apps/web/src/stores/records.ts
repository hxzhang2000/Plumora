/* 卦例列表状态 —— 包一层响应式，视图只读它，写操作走 platform/records */

import { ref } from 'vue';
import type { HexagramRecord } from '@plumora/core';
import { queryRecords, type RecordQuery } from '@/platform/records';

const records = ref<HexagramRecord[]>([]);
const loading = ref(false);
const lastError = ref<string | null>(null);

export function useRecords() {
  return { records, loading, lastError };
}

/** 重新拉取（可选带筛选条件） */
export async function refreshRecords(query: RecordQuery = {}): Promise<void> {
  loading.value = true;
  lastError.value = null;
  try {
    records.value = await queryRecords(query);
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : String(e);
    records.value = [];
  } finally {
    loading.value = false;
  }
}
