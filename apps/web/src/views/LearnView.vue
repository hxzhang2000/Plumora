<script setup lang="ts">
/**
 * 学习页 —— 06 §3.4
 *   八卦类象速查（类目与 05 §2.2 表头一致）
 *   六十四卦速查（8×8 宫格，行 = 上卦，列 = 下卦）
 *   十翼全文阅读
 *
 * 只陈列「可查阅的资料」，不讲解起卦 / 断卦的方法 —— 原「入门」板块
 * 已整体下线，见下方 View 的说明。
 */
import { computed, ref, watch } from 'vue';
import {
  TRIGRAM_CATEGORIES,
  TRIGRAM_LIST,
  getHexagram,
  type TrigramNumber,
} from '@plumora/knowledge';
import SegControl from '@/components/SegControl.vue';
import TrigramGlyph from '@/components/TrigramGlyph.vue';
import GuaciYaoCiPanel from '@/components/GuaciYaoCiPanel.vue';
import ShiYiPanel from '@/components/ShiYiPanel.vue';
import { hexagramEn, hexagramPinyin, trigramEn, trigramPinyin } from '@/platform/bilingual';
import { searchKnowledge, type KnowledgeHit } from '@/platform/knowledgeSearch';
import { navigate, route } from '@/router';
import { useSettings } from '@/stores/settings';

const settings = useSettings();
/** 双语显示开关（设置项，缺省关） */
const bil = computed(() => settings.showBilingual);

const TRIGRAM_NAMES = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'] as const;

/** 八卦中文名 + 拼音（双语开启时）：乾 qián */
function tgNamePy(n: TrigramNumber): string {
  return bil.value ? `${TRIGRAM_NAMES[n - 1]} ${trigramPinyin(n)}` : TRIGRAM_NAMES[n - 1];
}

/**
 * 学习页的三个板块。
 *
 * 原第四个板块「入门」（五行生克图 / 体用生克歌诀 / 体用怎么定 / 排盘与断卦
 * 步骤）已于 2026-10-14 整体下线：它把起卦与断卦的方法论逐条讲给使用者看，
 * 而不是只提供可查阅的文献资料。这也与 PRD v2.0 已定的口径一致 ——
 * 「学习页只保留速查块，不提供起卦方法说明」（docs/dev/01-产品需求文档PRD.md）。
 */
type View = 'xx' | 'grid' | 'shiYI';

const view = ref<View>('xx');
const viewOptions = [
  { value: 'xx' as const, label: '八卦类象' },
  { value: 'grid' as const, label: '六十四卦' },
  { value: 'shiYI' as const, label: '十翼' },
];

/**
 * `#/learn?tab=shiYI` —— 从十翼阅读器返回学习页时带的定位参数
 * （router 的 PARENT_PATH 与 ShiYiPanel.backToOverview 都会发它）。
 *
 * 常规路径上 KeepAlive 已经替我们保住了 tab，但「直接打开 #/shi-yi/xxx 再返回」
 * 这类首个 LearnView 实例是新建的场景，组件会落到默认 tab，故这里显式认一次。
 * 只认已知值；不带参数时**保持当前 tab 不动**，不把用户已选的 tab 顶回默认。
 */
watch(
  () => route.value.params.tab,
  (t) => {
    if (t === 'xx' || t === 'grid' || t === 'shiYI') view.value = t;
  },
  { immediate: true },
);

/* ---------- 八卦类象 ---------- */

const activeTrigram = ref<TrigramNumber>(1);
const trigram = computed(() => TRIGRAM_LIST[activeTrigram.value - 1]);

/* ---------- 六十四卦 ---------- */

const UPPERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const LOWERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const selected = ref<{ upper: TrigramNumber; lower: TrigramNumber } | null>(null);
const selectedHex = computed(() =>
  selected.value ? getHexagram(selected.value.upper, selected.value.lower) : null,
);

function pick(upper: TrigramNumber, lower: TrigramNumber) {
  selected.value = { upper, lower };
}

/* ---------- 搜索 ----------
 *
 * 64 卦速查原本只能按 8×8 格子翻、十翼只能逐篇读，而数据全在本地。
 * 这里加一个全文检索：命中「卦」直接跳到该卦详情，命中「十翼」跳到对应篇。
 * 索引惰性构建（首次搜索才建），不拖慢学习页首屏。
 */
const keyword = ref('');
const hits = computed<KnowledgeHit[]>(() => searchKnowledge(keyword.value));
const searching = computed(() => keyword.value.trim().length > 0);

function openHit(hit: KnowledgeHit): void {
  if (hit.kind === 'hex') {
    view.value = 'grid';
    pick(hit.upper, hit.lower);
    return;
  }
  navigate(`/shi-yi/${hit.slug}`);
}

function clearSearch(): void {
  keyword.value = '';
}

/** 结果标题：卦用卦名，十翼用「篇名 · 章题」 */
function hitTitle(h: KnowledgeHit): string {
  return h.kind === 'hex' ? h.name : h.title;
}
</script>

<template>
  <div class="learn">
    <!-- 全文检索：卦名 / 卦意关键词 / 卦辞爻辞 / 十翼全文 一起搜（本地索引，零成本） -->
    <div class="search-row">
      <input
        v-model="keyword"
        type="search"
        placeholder="搜索：卦名 / 卦意 / 卦辞爻辞 / 十翼全文"
        aria-label="搜索知识库"
      />
      <button v-if="searching" type="button" class="search-clear" @click="clearSearch">清除</button>
    </div>

    <!-- 搜索态：结果列表取代下面的分栏内容 -->
    <template v-if="searching">
      <p class="search-count">
        {{ hits.length ? `找到 ${hits.length} 条` : '没有匹配的内容，换个词试试' }}
      </p>
      <ul v-if="hits.length" class="hits">
        <li
          v-for="(h, i) in hits"
          :key="`${h.kind}-${i}`"
          class="hit"
          tabindex="0"
          role="button"
          @click="openHit(h)"
          @keydown.enter="openHit(h)"
          @keydown.space.prevent="openHit(h)"
        >
          <div class="hit-head">
            <span class="hit-kind" :class="h.kind">{{ h.kind === 'hex' ? '卦' : '十翼' }}</span>
            <b class="serif">{{ hitTitle(h) }}</b>
          </div>
          <p class="hit-snippet">{{ h.snippet }}</p>
        </li>
      </ul>
    </template>

    <template v-else>
      <SegControl v-model="view" :options="viewOptions" aria-label="学习内容" />

    <!-- 八卦类象 -->
    <template v-if="view === 'xx'">
      <div class="chips">
        <button
          v-for="t in TRIGRAM_LIST"
          :key="t.number"
          type="button"
          class="xx-chip"
          :class="{ active: activeTrigram === t.number }"
          @click="activeTrigram = t.number"
        >
          {{ t.symbol }} {{ t.name }}<span v-if="bil" class="bil-py"> {{ trigramPinyin(t.number) }}</span>
        </button>
      </div>

      <section class="card">
        <header class="xx-head">
          <TrigramGlyph :number="trigram.number" size="lg" />
          <div>
          <b class="serif">{{ trigram.name }}卦<span v-if="bil" class="bil-py"> {{ trigramPinyin(trigram.number) }}</span></b>
          <span>
            五行 {{ { WOOD: '木', FIRE: '火', EARTH: '土', METAL: '金', WATER: '水' }[trigram.element] }}
            · {{ trigram.nature }} · {{ trigram.family }} · {{ trigram.direction }} · {{ trigram.season }}
            <template v-if="bil"> · {{ trigramEn(trigram.number) }}</template>
          </span>
          </div>
        </header>
        <ul class="xx-list">
          <li v-for="c in TRIGRAM_CATEGORIES" :key="String(c.key)">
            <i>{{ c.label }}</i>{{ trigram[c.key] }}
          </li>
        </ul>
      </section>
    </template>

    <!-- 六十四卦 -->
    <template v-else-if="view === 'grid'">
      <section class="card">
        <h3 class="card-title">六十四卦速查（行＝上卦，列＝下卦）</h3>
        <div class="grid64">
          <div class="grid-row head">
            <span class="grid-side" />
            <span v-for="l in LOWERS" :key="'h' + l" class="grid-head-cell">{{ tgNamePy(l) }}</span>
          </div>
          <div v-for="u in UPPERS" :key="u" class="grid-row">
            <span class="grid-side">{{ tgNamePy(u) }}</span>
            <button
              v-for="l in LOWERS"
              :key="`${u}-${l}`"
              type="button"
              class="grid-cell serif"
              :class="{ active: selected?.upper === u && selected?.lower === l }"
              @click="pick(u, l)"
            >
              {{ getHexagram(u, l).shortName }}
            </button>
          </div>
        </div>

        <div v-if="selectedHex" class="hex-detail">
          <div class="hd-head">
            <b class="serif">{{ selectedHex.name }}<span v-if="bil" class="bil-py"> {{ hexagramPinyin(selectedHex.name) }}</span></b>
            <span>
              {{ tgNamePy(selectedHex.upper) }}上{{ tgNamePy(selectedHex.lower) }}下
              <template v-if="bil"> · {{ hexagramEn(selectedHex.name) }}</template>
            </span>
          </div>
          <div class="kw-row">
            <span class="kw-title">卦意</span>
            <span v-for="k in selectedHex.keywords" :key="k" class="chip">{{ k }}</span>
          </div>
          <GuaciYaoCiPanel v-if="selectedHex.guaci || selectedHex.lines" :hexagram="selectedHex" />
          <p v-else class="pending">卦辞与爻辞数据暂无。</p>
        </div>
      </section>
    </template>

    <!-- 十翼 -->
    <template v-else>
      <ShiYiPanel />
    </template>
    </template>
  </div>
</template>

<style scoped>
.learn {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ---------- 全文检索 ---------- */
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-row input {
  flex: 1;
  min-width: 0;
}

.search-clear {
  flex: none;
  min-height: var(--tap-min);
  padding: 0 14px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: var(--c-surface);
  color: var(--c-muted);
  font-size: var(--fs-sm);
}

.search-clear:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.search-count {
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.hits {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hit {
  padding: 11px 14px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: var(--c-surface);
  cursor: pointer;
  transition: border-color var(--dur);
}

.hit:hover,
.hit:focus-visible {
  border-color: var(--c-accent);
}

.hit-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hit-head b {
  font-size: var(--fs-md);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hit-kind {
  flex: none;
  padding: 1px 8px;
  border-radius: var(--r-pill);
  font-size: var(--fs-xs);
  background: var(--c-accent-soft);
  color: var(--c-accent);
}

.hit-kind.shiyi {
  background: var(--c-second-soft);
  color: var(--c-second);
}

.hit-snippet {
  margin-top: 6px;
  font-size: var(--fs-sm);
  line-height: 1.7;
  color: var(--c-muted);
  word-break: break-word;
}

/* ---------- 八卦类象 ---------- */

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.xx-chip {
  padding: 7px 14px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-pill);
  background: var(--c-surface);
  color: var(--c-ink);
  font-size: var(--fs-sm);
}

.xx-chip.active {
  border-color: var(--c-accent);
  background: var(--c-accent-soft);
  color: var(--c-accent);
}

.xx-head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.xx-head b {
  display: block;
  font-size: var(--fs-lg);
}

.xx-head span {
  display: block;
  margin-top: 4px;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.xx-list {
  list-style: none;
}

.xx-list li {
  padding: 5px 0;
  border-bottom: 1px dashed var(--c-line);
  font-size: var(--fs-sm);
  line-height: 1.7;
}

.xx-list li:last-child {
  border-bottom: 0;
}

.xx-list li i {
  display: inline-block;
  width: 70px;
  font-style: normal;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

/* ---------- 六十四卦 ---------- */

.grid64 {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.grid-head {
  display: none;
}

.grid-row {
  display: grid;
  grid-template-columns: 26px repeat(8, minmax(0, 1fr));
  gap: 4px;
}

.grid-side,
.grid-head-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif);
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--c-ink);
}

.grid-cell {
  min-height: 38px;
  padding: 4px 2px;
  border: 1px solid var(--c-line);
  border-radius: 7px;
  background: var(--c-surface);
  font-size: var(--fs-xs);
  line-height: 1.2;
  color: var(--c-ink);
  transition: border-color var(--dur), color var(--dur);
}

.grid-cell:hover {
  border-color: var(--c-accent);
  color: var(--c-accent);
}

.grid-cell.active {
  border-color: var(--c-accent);
  background: var(--c-accent-soft);
  color: var(--c-accent);
}

.hex-detail {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--c-line);
}

.hd-head b {
  display: block;
  font-size: var(--fs-lg);
}

.hd-head span {
  display: block;
  margin: 4px 0 10px;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.kw-row {
  margin-bottom: 8px;
}

.kw-title {
  margin-right: 8px;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

/* 双语：学习页里追加的拼音 / 英文小字（行内） */
.bil-py {
  font-size: 0.82em;
  letter-spacing: 0.3px;
  color: var(--c-accent);
  font-style: italic;
}

.pending {
  font-size: var(--fs-xs);
  line-height: 1.8;
  color: var(--c-muted);
}

/* 桌面端：64 宫格放大（判据为 data-layout，见 App.vue 的断点说明） */
[data-layout='desk'] .grid-cell {
  min-height: 44px;
  font-size: var(--fs-sm);
}

[data-layout='desk'] .grid-row {
  grid-template-columns: 32px repeat(8, minmax(0, 1fr));
}
</style>
