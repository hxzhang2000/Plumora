<script setup lang="ts">
/**
 * 六十四卦全图对照 —— 64 张小卦画网格，点击查看卦名与卦辞。
 * 结果页与学习页共用；可高亮"当前查看之卦"（结果页随本 / 互 / 变切换器同步）。
 *
 * 小卦画为自绘 SVG（六爻自上而下），不依赖 HexagramStage（那是为排盘主视图准备的
 * 带体用标注的重组件），这里只要一个轻量、可成批渲染的纯爻画。
 */
import { computed, ref } from 'vue';
import { HEXAGRAM_LIST, type Hexagram } from '@plumora/knowledge';

const props = withDefaults(
  defineProps<{
    /** 当前查看之卦的上/下卦（本 / 互 / 变，用于高亮） */
    currentUpper?: number;
    currentLower?: number;
  }>(),
  { currentUpper: 0, currentLower: 0 },
);

const expanded = ref(false);
const selected = ref<Hexagram | null>(null);

/** 按传统六十四卦序排列：以上卦为主（乾..坤）、同上下卦再按下卦（乾..坤） */
const ordered = computed(() =>
  HEXAGRAM_LIST.slice().sort(
    (a, b) => b.upper - a.upper || b.lower - a.lower,
  ),
);

/** 取六爻（自下而上）；由 binary 推导（下爻 bit0，与知识库编码一致） */
function safeLines(h: Hexagram): readonly number[] {
  const out: number[] = [];
  for (let i = 0; i < 6; i += 1) out.push((h.binary >> i) & 1);
  return out;
}

/** 六爻自下而上 → 自上而下（绘制序） */
function topDown(lines: readonly number[]): readonly number[] {
  return lines.slice().reverse();
}

function select(h: Hexagram): void {
  selected.value = h;
}

function isCurrent(h: Hexagram): boolean {
  return h.upper === props.currentUpper && h.lower === props.currentLower;
}
</script>

<template>
  <section class="hex-chart card panel">
    <button type="button" class="chart-head" :aria-expanded="expanded" @click="expanded = !expanded">
      <span>六十四卦全图对照</span>
      <span class="chart-toggle">{{ expanded ? '收起' : '展开' }}</span>
    </button>

    <div v-if="expanded" class="chart-body">
      <div class="chart-grid">
        <button
          v-for="h in ordered"
          :key="h.code"
          type="button"
          class="hex-tile"
          :class="{ current: isCurrent(h), active: selected === h }"
          :title="h.name"
          @click="select(h)"
        >
          <svg class="hex-mini" viewBox="0 0 30 66" role="img" :aria-label="`${h.name}卦`">
            <g v-for="(v, i) in topDown(safeLines(h))" :key="i" :transform="`translate(0, ${i * 11})`">
              <rect v-if="v === 1" x="1" y="2" width="28" height="6" rx="1" class="yang" />
              <template v-else>
                <rect x="1" y="2" width="12" height="6" rx="1" class="yin" />
                <rect x="17" y="2" width="12" height="6" rx="1" class="yin" />
              </template>
            </g>
          </svg>
          <span class="hex-name">{{ h.name }}</span>
        </button>
      </div>

      <div v-if="selected" class="chart-detail">
        <b class="detail-name">{{ selected.name }}卦</b>
        <p class="detail-guaci">{{ selected.guaciMeaning || '（暂无卦辞释义）' }}</p>
      </div>
      <p v-else class="chart-hint">点任意一卦，查看卦名与卦辞。</p>
    </div>
  </section>
</template>

<style scoped>
.hex-chart {
  margin-top: 14px;
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 0;
  border: 0;
  background: none;
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--c-ink);
  cursor: pointer;
}

.chart-head .chart-toggle {
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.chart-body {
  margin-top: 12px;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(54px, 1fr));
  gap: 8px;
}

.hex-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: var(--c-bg);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.hex-tile:hover {
  border-color: var(--c-accent);
}

.hex-tile.active {
  border-color: var(--c-accent);
  background: var(--c-accent-soft);
}

.hex-tile.current {
  box-shadow: 0 0 0 2px var(--c-accent) inset;
}

.hex-mini {
  width: 30px;
  height: 66px;
}

.hex-mini .yang,
.hex-mini .yin {
  fill: var(--c-ink);
}

.hex-name {
  font-size: var(--fs-xs);
  color: var(--c-ink);
  letter-spacing: 1px;
}

.chart-detail {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: var(--r-md);
  background: var(--c-accent-soft);
}

.detail-name {
  font-size: var(--fs-md);
  color: var(--c-accent);
  letter-spacing: 2px;
}

.detail-guaci {
  margin-top: 6px;
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-ink);
}

.chart-hint {
  margin-top: 12px;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}
</style>
