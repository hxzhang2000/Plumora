<script setup lang="ts">
/**
 * 卦象舞台 —— 上卦 / 下卦分体渲染 + 体用标注独立成列
 * （产品负责人 2026-09-26 意见 1「文字与图形重叠」、意见 2「上下卦之间留空带」）
 *
 * 三条硬约束：
 *   1. 体用文字与爻画**彻底分列**：标注是自己的一列（右对齐、贴着卦符但绝不压上去），
 *      不再用 absolute 定位叠在卦符上方——原实现两个标注压在卦符上，窄屏下读不清；
 *   2. 上卦与下卦之间留出**空带**（band）：两组三爻不再紧贴，一眼分得开；
 *   3. 对外仍是一个 role="img"，aria-label 沿用 06 §6.1 格式
 *      （「本卦水风井，上卦坎下卦巽，第一爻动」），内部上下两半对屏幕阅读器隐藏，
 *      避免被读成两个残缺卦符。
 *
 * 入参 lines 一律**自下而上**（与 HexagramGlyph 相同的约定，index 0 = 初爻）。
 */
import { computed } from 'vue';
import { TRIGRAMS, getHexagram, linesToBinary, trigramByBinary } from '@plumora/knowledge';
import HexagramGlyph from '@/components/HexagramGlyph.vue';

/** 半卦侧的体用标注：kind 决定朱砂（体）/ 青灰（用）配色 */
type HalfMark = { kind: 'ti' | 'yong'; text: string };

const props = withDefaults(
  defineProps<{
    /** 六爻，自下而上（index 0 = 初爻） */
    lines: readonly number[];
    /** 动爻 1–6；0 表示不标动爻 */
    moving?: number;
    size?: 'sm' | 'md' | 'lg';
    /** 是否播放逐爻浮现动画（结果页开启） */
    animate?: boolean;
    /** 卦位前缀，用于自动生成描述：「本卦」/「互卦」/「变卦」 */
    role?: string;
    /** 自定义无障碍描述；留空则按 06 §6.1 的格式自动生成 */
    label?: string;
    /** 上半（上卦）的体用标注；null = 不标注（互卦/变卦视图） */
    upperMark?: HalfMark | null;
    /** 下半（下卦）的体用标注 */
    lowerMark?: HalfMark | null;
  }>(),
  {
    moving: 0,
    size: 'lg',
    animate: false,
    role: '',
    label: '',
    upperMark: null,
    lowerMark: null,
  },
);

const upperLines = computed(() => props.lines.slice(3, 6));
const lowerLines = computed(() => props.lines.slice(0, 3));

/** 动爻归属半卦：初～三爻在下卦（原值），四～上爻在上卦（减 3），否则 0 = 不标 */
const lowerMoving = computed(() => (props.moving >= 1 && props.moving <= 3 ? props.moving : 0));
const upperMoving = computed(() => (props.moving >= 4 && props.moving <= 6 ? props.moving - 3 : 0));

/** 爻位序数（中文数字）——与 HexagramGlyph 保持同一套 06 §6.1 描述格式 */
const ORDINAL = ['', '一', '二', '三', '四', '五', '六'] as const;

const ariaLabel = computed(() => {
  if (props.label) return props.label;
  if (props.lines.length !== 6) return '卦符';
  const lowerNo = trigramByBinary(linesToBinary(props.lines.slice(0, 3)));
  const upperNo = trigramByBinary(linesToBinary(props.lines.slice(3, 6)));
  const name = getHexagram(upperNo, lowerNo)?.name ?? '';
  const moving = props.moving ? `，第${ORDINAL[props.moving] ?? props.moving}爻动` : '';
  return `${props.role}${name}，上卦${TRIGRAMS[upperNo].name}下卦${TRIGRAMS[lowerNo].name}${moving}`;
});
</script>

<template>
  <div class="stage" :class="size" role="img" :aria-label="ariaLabel">
    <div class="half upper">
      <span v-if="upperMark" class="mark" :class="upperMark.kind">{{ upperMark.text }}</span>
      <span class="glyph-slot" aria-hidden="true">
        <HexagramGlyph :lines="upperLines" :moving="upperMoving" :size="size" :animate="animate" />
      </span>
      <!-- 右侧配平列：无论有无标注，卦符都稳稳居中 -->
      <span class="rail" aria-hidden="true" />
    </div>

    <!-- 上下卦之间的空带：整块留白，只用来分组 -->
    <div class="band" aria-hidden="true" />

    <div class="half lower">
      <span v-if="lowerMark" class="mark" :class="lowerMark.kind">{{ lowerMark.text }}</span>
      <span class="glyph-slot" aria-hidden="true">
        <HexagramGlyph :lines="lowerLines" :moving="lowerMoving" :size="size" :animate="animate" />
      </span>
      <span class="rail" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.stage {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.half {
  display: grid;
  /* 1fr | 卦符 | 1fr —— 卦符永远居中，标注列有专属空间，不会与爻画重叠 */
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: 100%;
}

.mark {
  grid-column: 1;
  justify-self: end;
  margin-right: 16px;
  padding: 3px 9px;
  border-radius: var(--r-pill);
  font-size: var(--fs-xs);
  letter-spacing: 1px;
  white-space: nowrap;
  line-height: 1.6;
}

.mark.ti {
  background: var(--c-accent-soft);
  color: var(--c-accent);
}

.mark.yong {
  background: var(--c-second-soft);
  color: var(--c-second);
}

.glyph-slot {
  grid-column: 2;
  display: flex;
  justify-content: center;
}

.rail {
  grid-column: 3;
}

/* 空带：约等于三个爻行的高度，是分组信号，不是空白失误 */
.band {
  width: 100%;
  height: 26px;
}

.stage.md .band {
  height: 22px;
}

.stage.sm .band {
  height: 16px;
}

/* 下卦接续上卦的逐爻浮现节奏（全局 glyph.css 只按 6 行给了 0.05–0.45 的序列） */
.half.lower :deep(.yao:nth-child(1)) {
  animation-delay: 0.29s;
}

.half.lower :deep(.yao:nth-child(2)) {
  animation-delay: 0.37s;
}

.half.lower :deep(.yao:nth-child(3)) {
  animation-delay: 0.45s;
}
</style>
