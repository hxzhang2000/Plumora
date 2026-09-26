<script setup lang="ts">
/**
 * 学习页 —— 06 §3.4
 *   八卦类象速查（类目与 05 §2.2 表头一致）
 *   六十四卦速查（8×8 宫格，行 = 上卦，列 = 下卦）
 */
import { computed, ref } from 'vue';
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

type View = 'xx' | 'grid' | 'shiYI';

const view = ref<View>('xx');
const viewOptions = [
  { value: 'xx' as const, label: '八卦类象' },
  { value: 'grid' as const, label: '六十四卦' },
  { value: 'shiYI' as const, label: '十翼' },
];

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
</script>

<template>
  <div class="learn">
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
          {{ t.symbol }} {{ t.name }}
        </button>
      </div>

      <section class="card">
        <header class="xx-head">
          <TrigramGlyph :number="trigram.number" size="lg" />
          <div>
            <b class="serif">{{ trigram.name }}卦</b>
            <span>
              五行 {{ { WOOD: '木', FIRE: '火', EARTH: '土', METAL: '金', WATER: '水' }[trigram.element] }}
              · {{ trigram.nature }} · {{ trigram.family }} · {{ trigram.direction }} · {{ trigram.season }}
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
        <h3 class="card-title">六十四卦速查（行＝上卦，列＝下卦，点格查看）</h3>
        <div class="grid64">
          <div class="grid-row head">
            <span class="grid-side" />
            <span v-for="l in LOWERS" :key="'h' + l" class="grid-head-cell">{{ ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'][l - 1] }}</span>
          </div>
          <div v-for="u in UPPERS" :key="u" class="grid-row">
            <span class="grid-side">{{ ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'][u - 1] }}</span>
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
            <b class="serif">{{ selectedHex.name }}</b>
            <span>{{ ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'][selectedHex.upper - 1] }}上{{ ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'][selectedHex.lower - 1] }}下 · 卦代码 {{ selectedHex.code }}</span>
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
  </div>
</template>

<style scoped>
.learn {
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  font-size: var(--fs-xs);
  color: var(--c-muted);
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
