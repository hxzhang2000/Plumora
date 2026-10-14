<script setup lang="ts">
/** 卦例列表 —— 06 §3.3：搜索 + 应验状态筛选 + 时间倒序 + 轻统计 */
import { computed, onActivated, ref, watch } from 'vue';
import {
  classifyQuestion,
  DEGREE_CN,
  DOMAIN_CN,
  judge,
  methodCn,
  VERIFY_STATUS_CN,
  VERIFY_STATUS_LIST,
  recordTitle,
  type FortuneDegree,
  type HexagramRecord,
  type QuestionDomain,
  type VerifyStatus,
} from '@plumora/core';
import { getHexagramByCode, trigram, type TrigramNumber } from '@plumora/knowledge';
import VerifyBadge from '@/components/VerifyBadge.vue';
import { navigate } from '@/router';
import { refreshRecords, useRecords } from '@/stores/records';

const { records, loading, lastError } = useRecords();

const keyword = ref('');
const filter = ref<VerifyStatus | 'ALL'>('ALL');
const domainFilter = ref<QuestionDomain | 'ALL'>('ALL');
/** 排序：默认新→旧（06 §3.3 时间倒序）；可切旧→新 */
const sortOrder = ref<'NEW' | 'OLD'>('NEW');

onActivated(() => {
  void refreshRecords();
});

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  const list = records.value.filter((r) => {
    if (filter.value !== 'ALL' && r.verifyStatus !== filter.value) return false;
    if (domainFilter.value !== 'ALL' && classifyQuestion(r.question ?? '') !== domainFilter.value) {
      return false;
    }
    if (!kw) return true;
    return (
      (r.question ?? '').toLowerCase().includes(kw) ||
      (r.note ?? '').toLowerCase().includes(kw) ||
      r.benGuaName.toLowerCase().includes(kw)
    );
  });
  return list.sort((a, b) =>
    sortOrder.value === 'NEW' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
  );
});

/* ---------- 增量渲染 ----------
 *
 * 卦例是用户能长期攒下去的：几百上千条时，一次性把整个列表塞进 DOM 会让
 * 首屏明显发卡（每条 4 行文本 + 徽标）。这里只渲染前 PAGE 条，
 * 其余用「加载更多」按批展开；筛选 / 搜索 / 排序变化时回到第一批。
 */
const PAGE = 50;
const visibleCount = ref(PAGE);

watch([keyword, filter, domainFilter, sortOrder], () => {
  visibleCount.value = PAGE;
});

const visible = computed(() => filtered.value.slice(0, visibleCount.value));
const remaining = computed(() => Math.max(0, filtered.value.length - visible.value.length));

function loadMore(): void {
  visibleCount.value += PAGE;
}

/* ---------- 轻统计 ----------
 *
 * 数据全在本地记录里，回看时给一眼「总量 / 应验率 / 吉凶分布」。
 * 吉凶按 04 §2.2 落库的体用（tiTrigram / yongTrigram）现推，与列表、
 * 详情页、导出用的是同一套 judge()，不会出现两处口径。
 */
const DEGREE_ORDER: readonly FortuneDegree[] = ['DA_JI', 'XIAO_JI', 'JI', 'XIAO_XIONG', 'DA_XIONG'];

/**
 * 落库的本卦体用 → 吉凶等级。
 * tiTrigram / yongTrigram 在 04 §2.2 里是数字列，历史数据可能缺失或被改坏，
 * 越界时返回 null（计为「未分级」，不硬算出一个假吉凶）。
 */
function degreeOf(r: HexagramRecord): FortuneDegree | null {
  const { tiTrigram: ti, yongTrigram: yong } = r;
  if (!Number.isInteger(ti) || ti < 1 || ti > 8) return null;
  if (!Number.isInteger(yong) || yong < 1 || yong > 8) return null;
  return judge(trigram(ti as TrigramNumber), trigram(yong as TrigramNumber)).degree;
}

const stats = computed(() => {
  const total = records.value.length;
  let verified = 0;
  const tally = new Map<FortuneDegree, number>(DEGREE_ORDER.map((d) => [d, 0]));
  for (const r of records.value) {
    if (r.verifyStatus === 'VERIFIED') verified += 1;
    const d = degreeOf(r);
    if (d) tally.set(d, (tally.get(d) ?? 0) + 1);
  }
  const max = Math.max(1, ...DEGREE_ORDER.map((d) => tally.get(d) ?? 0));
  return {
    total,
    verified,
    bars: DEGREE_ORDER.map((d) => ({
      degree: d,
      label: DEGREE_CN[d],
      count: tally.get(d) ?? 0,
      // 条宽按最大值归一，最少留 4% 让「0 条」也能看到基线
      pct: Math.max(4, Math.round(((tally.get(d) ?? 0) / max) * 100)),
    })),
  };
});

const sortChips = [
  { value: 'NEW' as const, label: '新 → 旧' },
  { value: 'OLD' as const, label: '旧 → 新' },
];

const domainChips = computed(() => [
  { value: 'ALL' as const, label: '全部' },
  ...(Object.keys(DOMAIN_CN) as QuestionDomain[]).map((d) => ({ value: d, label: DOMAIN_CN[d] })),
]);

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
    <!-- 轻统计：总览 + 吉凶分布（数据全在本地，见 script 里的 stats） -->
    <section v-if="stats.total" class="stats" aria-label="卦例统计">
      <div class="stats-top">
        <span>共 <b>{{ stats.total }}</b> 卦</span>
        <span class="dot" aria-hidden="true">·</span>
        <span>已应验 <b>{{ stats.verified }}</b> 卦</span>
      </div>
      <ul class="bars">
        <li v-for="b in stats.bars" :key="b.degree">
          <span class="bar-label">{{ b.label }}</span>
          <span class="bar-track"
            ><i class="bar-fill" :class="`d-${b.degree}`" :style="{ width: b.pct + '%' }"></i
          ></span>
          <span class="bar-count">{{ b.count }}</span>
        </li>
      </ul>
    </section>

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

    <div class="filter-row">
      <button
        v-for="c in domainChips"
        :key="`d-${c.value}`"
        type="button"
        class="filter-chip"
        :class="{ active: domainFilter === c.value }"
        @click="domainFilter = c.value"
      >
        {{ c.label }}
      </button>
    </div>

    <div class="filter-row">
      <span class="sort-label">排序</span>
      <button
        v-for="c in sortChips"
        :key="`s-${c.value}`"
        type="button"
        class="filter-chip"
        :class="{ active: sortOrder === c.value }"
        @click="sortOrder = c.value"
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
          v-for="r in visible"
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
            {{ methodCn(r.method) }}
          </div>
          <div class="line3">
            {{ r.relation }} · {{ fmtTime(r.createdAt) }} → {{ hexName(r.bianGuaCode) }}
          </div>
          <div v-if="r.note" class="line4">{{ r.note }}</div>
        </li>
      </ul>

      <!-- 增量渲染：只渲染前若干条，其余按批展开（记录攒到上千条也不卡首屏） -->
      <button v-if="remaining" type="button" class="more" @click="loadMore">
        加载更多（还有 {{ remaining }} 条）
      </button>
    </template>

    <p v-if="loading" class="loading">载入中…</p>
  </div>
</template>

<style scoped>
.records {
  display: flex;
  flex-direction: column;
}

/* ---------- 轻统计 ---------- */
.stats {
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: var(--c-surface);
}

.stats-top {
  display: flex;
  align-items: baseline;
  gap: 7px;
  font-size: var(--fs-sm);
  color: var(--c-muted);
}

.stats-top b {
  font-size: var(--fs-md);
  color: var(--c-accent);
}

.stats-top .dot {
  color: var(--c-line);
}

.bars {
  list-style: none;
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.bars li {
  display: grid;
  grid-template-columns: 2.6em 1fr 2.2em;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-xs);
}

.bar-label {
  color: var(--c-muted);
}

.bar-track {
  height: 8px;
  border-radius: var(--r-pill);
  background: var(--c-accent-soft);
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--r-pill);
  transition: width var(--dur);
}

/* 吉（暖色朱砂，越吉越实）／凶（青灰，与「吉」形成冷暖对照） */
.bar-fill.d-DA_JI {
  background: var(--c-accent);
}
.bar-fill.d-XIAO_JI {
  background: var(--c-accent);
  opacity: 0.72;
}
.bar-fill.d-JI {
  background: var(--c-accent);
  opacity: 0.5;
}
.bar-fill.d-XIAO_XIONG {
  background: var(--c-second);
  opacity: 0.7;
}
.bar-fill.d-DA_XIONG {
  background: var(--c-second);
}

.bar-count {
  text-align: right;
  color: var(--c-muted);
  font-variant-numeric: tabular-nums;
}

.more {
  margin-top: 12px;
  width: 100%;
  min-height: var(--tap-min);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: var(--c-surface);
  color: var(--c-muted);
  font-size: var(--fs-sm);
}

.more:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.search-row {
  margin-bottom: 10px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.sort-label {
  margin-right: 2px;
  font-size: var(--fs-xs);
  color: var(--c-muted);
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
