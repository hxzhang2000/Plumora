<script setup lang="ts">
/** 卦例列表 —— 06 §3.3：搜索 + 应验状态筛选 + 时间倒序 */
import { computed, onActivated, ref } from 'vue';
import {
  METHOD_CN,
  VERIFY_STATUS_CN,
  VERIFY_STATUS_LIST,
  recordTitle,
  type HexagramRecord,
  type VerifyStatus,
} from '@plumora/core';
import { getHexagramByCode } from '@plumora/knowledge';
import VerifyBadge from '@/components/VerifyBadge.vue';
import { navigate } from '@/router';
import { refreshRecords, useRecords } from '@/stores/records';

const { records, loading, lastError } = useRecords();

const keyword = ref('');
const filter = ref<VerifyStatus | 'ALL'>('ALL');

onActivated(() => {
  void refreshRecords();
});

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return records.value.filter((r) => {
    if (filter.value !== 'ALL' && r.verifyStatus !== filter.value) return false;
    if (!kw) return true;
    return (
      (r.question ?? '').toLowerCase().includes(kw) ||
      (r.note ?? '').toLowerCase().includes(kw) ||
      r.benGuaName.toLowerCase().includes(kw)
    );
  });
});

const filterChips = computed(() => [
  { value: 'ALL' as const, label: '全部' },
  ...VERIFY_STATUS_LIST.map((s) => ({ value: s, label: VERIFY_STATUS_CN[s] })),
]);

/**
 * 列表项主标题 = 卦例名称（core 的 recordTitle）：
 * 优先用「所问之事」（占卜目标），未填时回退到本卦卦名。
 * 卦名不再固定占据标题位——填了目标的卦例，标题就该是用户关心的那件事。
 */
function titleOf(r: HexagramRecord) {
  return recordTitle(r);
}

/** 标题已经是卦名时，副行不再重复一次卦名 */
function showGuaName(r: HexagramRecord) {
  return Boolean((r.question ?? '').trim());
}

function hexName(code: string) {
  return getHexagramByCode(code)?.name ?? code;
}

function fmtTime(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
</script>

<template>
  <div class="records">
    <div class="search-row">
      <input
        v-model="keyword"
        type="search"
        placeholder="搜索：所问之事 / 备注 / 卦名"
        aria-label="搜索卦例"
      />
    </div>

    <div class="filter-row">
      <button
        v-for="c in filterChips"
        :key="c.value"
        type="button"
        class="filter-chip"
        :class="{ active: filter === c.value }"
        @click="filter = c.value"
      >
        {{ c.label }}
      </button>
    </div>

    <p v-if="lastError" class="error">读取卦例失败：{{ lastError }}</p>

    <!--
      错误态与空态互斥（审查 W-9）：读库失败时 stores/records 会把 records 置空，
      原来的写法会同时渲染「读取卦例失败」和「还没有卦例，去『起卦』试试」，
      用户会以为数据丢了。
    -->
    <template v-else>
      <div v-if="!filtered.length" class="empty">
        {{ records.length ? '无匹配卦例' : '还没有卦例，去「起卦」试试' }}
      </div>

      <ul v-else class="list">
        <li
          v-for="r in filtered"
          :key="r.id"
          class="rec-item"
          tabindex="0"
          role="button"
          @click="navigate(`/records/${r.id}`)"
          @keydown.enter="navigate(`/records/${r.id}`)"
          @keydown.space.prevent="navigate(`/records/${r.id}`)"
        >
          <div class="line1">
            <b class="serif" :title="titleOf(r)">{{ titleOf(r) }}</b>
            <VerifyBadge :status="r.verifyStatus" />
          </div>
          <div class="line2">
            <template v-if="showGuaName(r)">{{ r.benGuaName }} · </template>{{ r.lunarLabel }} ·
            {{ METHOD_CN[r.method] }}
          </div>
          <div class="line3">
            {{ r.relation }} · {{ fmtTime(r.createdAt) }} → {{ hexName(r.bianGuaCode) }}
          </div>
          <div v-if="r.note" class="line4">{{ r.note }}</div>
        </li>
      </ul>
    </template>

    <p v-if="loading" class="loading">载入中…</p>
  </div>
</template>

<style scoped>
.records {
  display: flex;
  flex-direction: column;
}

.search-row {
  margin-bottom: 10px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.filter-chip {
  padding: 6px 14px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-pill);
  background: var(--c-surface);
  color: var(--c-muted);
  font-size: var(--fs-sm);
}

.filter-chip.active {
  border-color: var(--c-accent);
  background: var(--c-accent-soft);
  color: var(--c-accent);
}

.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rec-item {
  padding: 12px 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  cursor: pointer;
  transition: border-color var(--dur);
}

.rec-item:hover {
  border-color: var(--c-accent);
}

.line1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.line1 b {
  font-size: var(--fs-md);
  /* 名称可能是一整句「所问之事」（≤200 字），单行截断，
     完整文本靠原生 title 提示；min-width: 0 才能让 flex 子项真正收缩 */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line2 {
  margin-top: 5px;
  font-size: var(--fs-sm);
  color: var(--c-muted);
  word-break: break-word;
}

.line3 {
  margin-top: 3px;
  font-size: var(--fs-sm);
  color: var(--c-accent);
}

.line4 {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--c-line);
  font-size: var(--fs-sm);
  color: var(--c-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.error {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--c-second);
  border-radius: var(--r-md);
  font-size: var(--fs-sm);
  color: var(--c-second);
}

.loading {
  padding: 16px 0;
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--c-muted);
}
</style>
