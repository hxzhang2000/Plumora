<script setup lang="ts">
/**
 * 学习页 —— 06 §3.4
 *   起卦方法说明（五种 + 体用生克）
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

type View = 'methods' | 'xx' | 'grid';

const view = ref<View>('methods');
const viewOptions = [
  { value: 'methods' as const, label: '起卦方法' },
  { value: 'xx' as const, label: '八卦类象' },
  { value: 'grid' as const, label: '六十四卦' },
];

/* ---------- 起卦方法 ---------- */

const METHODS = [
  {
    title: '① 时间起卦（年月日时）',
    body: '年取农历地支序数（子 1 … 亥 12），月、日取农历数，时取时辰序数（子 1 … 亥 12）。\n上卦 =（年＋月＋日）mod 8；下卦 =（年＋月＋日＋时）mod 8；动爻 = 同和 mod 6。余 0 取 8 / 取 6。\n23:00 后为晚子时，按次日日数与子时起卦。闰月按本月份数计算。',
  },
  {
    title: '② 数字起卦',
    body: '两数：上 = 第一数 mod 8，下 = 第二数 mod 8，动 =（两数之和）mod 6。\n一数：上 = 该数 mod 8，下 =（该数＋时辰序数）mod 8，动 = 同和 mod 6。\n输入须为 1–999,999,999 的整数；0 视为无效输入。',
  },
  {
    title: '③ 汉字笔画起卦',
    body: '两字：上 = 第一字笔画 mod 8，下 = 第二字笔画 mod 8，动 =（两字笔画和＋起卦秒数）mod 6（余 0 取 6）。\n一字：上 = 笔画总数 mod 8，下 =（总数＋时辰序数）mod 8，动 = 同和 mod 6（一字模式不追加秒数）。\n笔画标准可选简体 / 繁体，同一卦内必须统一；未收录的字可手动输入笔画。',
  },
  {
    title: '④ 声音（点数）起卦',
    body: '闻声逐次点按计数：第一组次数为上卦，第二组为下卦，两组之和 mod 6 为动爻。\n单组计数上限 999，至少 1 次。',
  },
  {
    title: '⑤ 随机起卦（模拟外应 · P2）',
    body: '点击随机生成上卦 1–8、下卦 1–8、动爻 1–6。结果页标注「随机起卦」以与正统方法区分。',
  },
  {
    title: '⑥ 体用生克（断卦核心）',
    body: '动爻所在之卦为用，另一卦为体（通行口径；亦可在设置中切换为「上卦恒为用、下卦恒为体」的笔记流派）。\n用生体大吉；体克用小吉；体用比和吉；体生用小凶；用克体大凶。\n再参互卦看过程、变卦看结局，结合卦象类象综合判断。',
  },
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

    <!-- 起卦方法 -->
    <section v-if="view === 'methods'" class="card">
      <details v-for="(m, i) in METHODS" :key="m.title" class="method" :open="i === 0">
        <summary>{{ m.title }}</summary>
        <p>{{ m.body }}</p>
      </details>
    </section>

    <!-- 八卦类象 -->
    <template v-else-if="view === 'xx'">
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
    <template v-else>
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
          <p class="pending">卦辞与爻辞属知识库 M1 录入项，校对完成后开放。</p>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.learn {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ---------- 起卦方法 ---------- */

.method {
  border-bottom: 1px solid var(--c-line);
}

.method:last-child {
  border-bottom: 0;
}

.method summary {
  padding: 12px 2px;
  font-size: var(--fs-base);
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}

.method summary::-webkit-details-marker {
  display: none;
}

.method summary::after {
  content: '＋';
  float: right;
  color: var(--c-muted);
  font-weight: 400;
}

.method[open] summary::after {
  content: '－';
}

.method p {
  padding: 0 2px 14px;
  font-size: var(--fs-sm);
  line-height: 1.9;
  color: var(--c-muted);
  white-space: pre-line;
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
