<script setup lang="ts">
/**
 * 卦级原文聚合展示 —— 设计规格「卦级原文聚合展示-UI设计规格」v0.2
 *
 * 信息架构（方案 D：主区直开 + 次区手风琴）：
 *   - 主区（永远展开）：卦辞 + 爻辞（含 6 爻 + 小象 + 动爻三重信号）+ 用九/用六（乾坤）
 *   - 次区（默认折叠）：彖 + 大象 + 文言（乾坤，按段渲染）
 *
 * 数据降级路径（§5.4）：任一字段为 null/undefined 时整卡不渲染，不占空位、不显占位卡。
 * 分区总规则：主区无任何数据（guaci / lines / yongText 全空）时整个分区不渲染。
 *
 * 视觉令牌全部沿用 apps/web/src/styles/tokens.css（--c-* / --fs-* / --sp-* / --r-* / --font-serif）。
 * 动画统一走 var(--dur) 与 var(--ease)，`prefers-reduced-motion` 由 tokens.css 全局降级。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { Hexagram, HexagramLine } from '@plumora/knowledge';
import { toast } from '@/stores/toast';

const props = withDefaults(
  defineProps<{
    /** 当前卦完整对象（含 guaci / lines / yongText / tuan / daxiang / xiaoxiang / wenyan） */
    hexagram: Hexagram | null;
    /** 动爻 index 1–6；0 或缺省 = 无动爻（互卦/变卦视图） */
    movingLine?: number;
  }>(),
  { movingLine: 0 },
);

/** 位置角标 ①②③④⑤⑥（下标 = 爻位 1–6，Q3 裁定） */
const CIRCLED = ['', '①', '②', '③', '④', '⑤', '⑥'] as const;

/** 复制图标 SVG（Feather 风格描边） */
const COPY_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
/** 复制成功对勾 SVG */
const CHECK_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

// ============ 数据存在性判断 ============

/** 主区是否有数据（卦辞 / 爻辞 / 用九 至少一） */
const hasMainData = computed(() => {
  const h = props.hexagram;
  if (!h) return false;
  return !!(h.guaci || (h.lines && h.lines.length) || h.yongText);
});

/** 次区（学术层）是否有数据 */
const hasSecondaryData = computed(() => {
  const h = props.hexagram;
  if (!h) return false;
  return !!(h.tuan || h.daxiang || (h.wenyan && h.wenyan.length));
});

/** 分区是否渲染：主区至少有一项数据（§5.4 空态规则） */
const showSection = computed(() => hasMainData.value);

/** 用九/用六 标签（依 code 判定，仅乾坤） */
const yongKind = computed(() => {
  const h = props.hexagram;
  if (!h?.yongText) return '';
  return h.code === '01-01' ? '用九' : '用六';
});

/** 分区总标题（依主区字段动态生成，§7.1） */
const sectionTitle = computed(() => {
  const h = props.hexagram;
  if (!h) return '';
  const parts: string[] = [];
  if (h.guaci) parts.push('卦辞');
  if (h.lines && h.lines.length) parts.push('爻辞');
  if (h.yongText) parts.push(yongKind.value);
  return parts.join(' · ');
});

// ============ 次区手风琴（默认折叠） ============
const accOpen = ref(false);

/** 手风琴标题（§7.3：仅彖·象 或 含文言） */
const accTitle = computed(() => {
  const h = props.hexagram;
  if (!h) return '';
  const verb = accOpen.value ? '收起' : '展开';
  const parts: string[] = ['传注'];
  if (h.wenyan && h.wenyan.length) parts.push('文言');
  return `${verb} ${parts.join(' · ')}`;
});

// ============ 小象展开态 ============

/** 某爻小象文本（字段缺失返回 undefined） */
function xiaoxiangOf(name: string): string | undefined {
  return props.hexagram?.xiaoxiang?.[name];
}

/** 是否任何爻有小象数据（决定"展开所有小象"按钮是否显示） */
const anyXiaoxiang = computed(() => {
  const h = props.hexagram;
  if (!h?.xiaoxiang || !h.lines || !h.lines.length) return false;
  return h.lines.some((line) => !!h.xiaoxiang?.[line.name]);
});

/** 判断某爻小象是否展开：优先取显式状态；无显式状态时动爻默认展开（Q4） */
function isXxOpen(index: number): boolean {
  if (props.hexagram?.xiaoxiang == null) return false;
  if (index in xxOpen.value) return !!xxOpen.value[index];
  return props.movingLine === index;
}

const xxOpen = ref<Record<number, boolean>>({});

/** 是否所有可展开的小象都展开（决定按钮文案） */
const allXxOpen = computed(() => {
  const h = props.hexagram;
  if (!h?.xiaoxiang || !h.lines || !h.lines.length) return false;
  const expandable = h.lines.filter((line) => !!h.xiaoxiang?.[line.name]);
  if (expandable.length === 0) return false;
  return expandable.every((line) => isXxOpen(line.index));
});

function toggleXx(index: number): void {
  xxOpen.value[index] = !isXxOpen(index);
}

function toggleAllXx(): void {
  const h = props.hexagram;
  if (!h?.xiaoxiang || !h.lines || !h.lines.length) return;
  const newState = !allXxOpen.value;
  for (const line of h.lines) {
    if (h.xiaoxiang[line.name]) xxOpen.value[line.index] = newState;
  }
}

// ============ 复制 ============

/** 当前正在显示"已复制"图标的段落 key（同一时间只有一个按钮显示对勾） */
const copiedKey = ref<string | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 复制文本到剪贴板：优先 Clipboard API，降级到 document.execCommand('copy')。
 * 成功：显示对勾 2.5s + toast「已复制」；失败：toast「复制失败，请长按选择文本」。
 */
async function copyText(text: string, key: string): Promise<void> {
  if (!text) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // 兜底：非安全上下文或旧浏览器
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) throw new Error('execCommand copy failed');
    }
    copiedKey.value = key;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copiedKey.value = null;
    }, 2500);
    toast('已复制');
  } catch {
    toast('复制失败，请长按选择文本');
  }
}

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});

// ============ 各段复制内容构造（§5.5） ============

const guaciCopyText = computed(() => props.hexagram?.guaci ?? '');

/** 爻辞复制：`{name}　{text}`，不含小象 */
function lineCopyText(line: HexagramLine): string {
  return `${line.name}　${line.text}`;
}

/** 小象复制：`《小象》　{xiaoxiang}` */
function xxCopyText(name: string): string {
  const xx = xiaoxiangOf(name);
  return xx ? `《小象》　${xx}` : '';
}

/** 用九/用六复制：`{kind}　{text}` */
const yongCopyText = computed(() => {
  const h = props.hexagram;
  return h?.yongText ? `${yongKind.value}　${h.yongText}` : '';
});

/** 文言复制：多段以换行连接（Q6） */
const wenyanCopyText = computed(() => {
  const w = props.hexagram?.wenyan;
  return w && w.length ? w.join('\n') : '';
});

// ============ 生命周期：hexagram / movingLine 变化时重置手风琴与小象展开态 ============
watch(
  [() => props.hexagram, () => props.movingLine],
  () => {
    accOpen.value = false;
    xxOpen.value = {};
  },
);
</script>

<template>
  <!-- 分区不渲染（主区无数据）：整个组件静默，父层占位卡接管（Q2） -->
  <section
    v-if="showSection"
    class="gya"
    role="region"
    aria-labelledby="gya-title"
  >
    <!-- 分区总标题（章节眉风格，与 .p-cap 同族） -->
    <h3 id="gya-title" class="gya-title">{{ sectionTitle }}</h3>

    <!-- ============ 主区：卦辞 / 爻辞 / 用九（永远展开） ============ -->
    <div class="gya-main">
      <!-- 卦辞 -->
      <section v-if="hexagram?.guaci" class="gya-card">
        <header class="gya-card-head">
          <b class="gya-card-title">卦辞</b>
          <button
            type="button"
            class="gya-copy"
            :class="{ 'is-copied': copiedKey === 'guaci' }"
            aria-label="复制卦辞"
            title="复制此段"
            @click="copyText(guaciCopyText, 'guaci')"
          >
            <span v-html="copiedKey === 'guaci' ? CHECK_SVG : COPY_SVG"></span>
          </button>
        </header>
        <p class="gya-text">{{ hexagram.guaci }}</p>
      </section>

      <!-- 爻辞卡组（6 行合一卡，Q3：传统顺序 初→上 + 位置角标） -->
      <section v-if="hexagram?.lines && hexagram.lines.length" class="gya-card">
        <header class="gya-card-head">
          <b class="gya-card-title">爻辞</b>
          <button
            v-if="anyXiaoxiang"
            type="button"
            class="gya-xx-toggle"
            :aria-label="allXxOpen ? '收起所有小象' : '展开所有小象'"
            @click="toggleAllXx"
          >{{ allXxOpen ? '收起小象' : '展开小象' }}</button>
        </header>
        <div class="gya-lines">
          <article
            v-for="line in hexagram.lines"
            :key="line.index"
            class="gya-line"
            :class="{ 'gya-line--moving': line.index === movingLine }"
            :aria-label="line.index === movingLine
              ? `${line.name}动，爻辞：${line.text}`
              : `${line.name}：${line.text}`"
          >
            <div class="gya-line-head">
              <div class="gya-line-left">
                <!-- 位置角标 ①②③④⑤⑥ -->
                <span class="gya-pos" aria-hidden="true">{{ CIRCLED[line.index] }}</span>
                <!-- 动爻信号 1/3：朱砂圆点 -->
                <span v-if="line.index === movingLine" class="gya-dot" aria-hidden="true"></span>
                <!-- 爻名徽标（有小象数据时可点展开） -->
                <button
                  v-if="xiaoxiangOf(line.name)"
                  type="button"
                  class="gya-line-badge gya-line-badge--clickable"
                  :aria-expanded="isXxOpen(line.index)"
                  :aria-controls="`xx-${line.index}`"
                  @click="toggleXx(line.index)"
                >{{ line.name }}</button>
                <span v-else class="gya-line-badge">{{ line.name }}</span>
              </div>
              <button
                type="button"
                class="gya-copy"
                :class="{ 'is-copied': copiedKey === `line-${line.index}` }"
                :aria-label="`复制${line.name}爻辞`"
                title="复制此段"
                @click="copyText(lineCopyText(line), `line-${line.index}`)"
              >
                <span v-html="copiedKey === `line-${line.index}` ? CHECK_SVG : COPY_SVG"></span>
              </button>
            </div>
            <p class="gya-text">{{ line.text }}</p>

            <!-- 小象行（字段缺失不渲染；Q4：动爻小象默认展开） -->
            <div
              v-if="xiaoxiangOf(line.name)"
              :id="`xx-${line.index}`"
              class="gya-xx"
              :class="{ 'gya-xx--open': isXxOpen(line.index) }"
            >
              <div class="gya-xx-inner">
                <div class="gya-xx-head">
                  <span class="gya-xx-prefix">《小象》</span>
                  <button
                    type="button"
                    class="gya-copy gya-copy--sm"
                    :class="{ 'is-copied': copiedKey === `xx-${line.index}` }"
                    :aria-label="`复制${line.name}小象`"
                    title="复制此段"
                    @click="copyText(xxCopyText(line.name), `xx-${line.index}`)"
                  >
                    <span v-html="copiedKey === `xx-${line.index}` ? CHECK_SVG : COPY_SVG"></span>
                  </button>
                </div>
                <p class="gya-text gya-text--xx">{{ xiaoxiangOf(line.name) }}</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- 用九/用六卡（乾坤专属） -->
      <section v-if="hexagram?.yongText" class="gya-card">
        <header class="gya-card-head">
          <b class="gya-card-title">{{ yongKind }}</b>
          <button
            type="button"
            class="gya-copy"
            :class="{ 'is-copied': copiedKey === 'yong' }"
            :aria-label="`复制${yongKind}`"
            title="复制此段"
            @click="copyText(yongCopyText, 'yong')"
          >
            <span v-html="copiedKey === 'yong' ? CHECK_SVG : COPY_SVG"></span>
          </button>
        </header>
        <p class="gya-text">{{ hexagram.yongText }}</p>
      </section>
    </div>

    <!-- ============ 次区：手风琴（默认折叠，§5.3） ============ -->
    <div v-if="hasSecondaryData" class="gya-acc">
      <button
        type="button"
        class="gya-acc-trigger"
        :aria-expanded="accOpen"
        aria-controls="gya-acc-body"
        @click="accOpen = !accOpen"
      >
        <span
          class="gya-acc-arrow"
          :class="{ 'gya-acc-arrow--open': accOpen }"
          aria-hidden="true"
        >▸</span>
        <span class="gya-acc-title">{{ accTitle }}</span>
      </button>
      <div
        id="gya-acc-body"
        class="gya-acc-body"
        :class="{ 'gya-acc-body--open': accOpen }"
      >
        <div class="gya-acc-inner">
          <!-- 彖 -->
          <section v-if="hexagram?.tuan" class="gya-card">
            <header class="gya-card-head">
              <b class="gya-card-title">彖</b>
              <button
                type="button"
                class="gya-copy"
                :class="{ 'is-copied': copiedKey === 'tuan' }"
                aria-label="复制彖传"
                title="复制此段"
                @click="copyText(hexagram.tuan, 'tuan')"
              >
                <span v-html="copiedKey === 'tuan' ? CHECK_SVG : COPY_SVG"></span>
              </button>
            </header>
            <p class="gya-text">{{ hexagram.tuan }}</p>
          </section>

          <!-- 大象 -->
          <section v-if="hexagram?.daxiang" class="gya-card">
            <header class="gya-card-head">
              <b class="gya-card-title">大象</b>
              <button
                type="button"
                class="gya-copy"
                :class="{ 'is-copied': copiedKey === 'daxiang' }"
                aria-label="复制大象"
                title="复制此段"
                @click="copyText(hexagram.daxiang, 'daxiang')"
              >
                <span v-html="copiedKey === 'daxiang' ? CHECK_SVG : COPY_SVG"></span>
              </button>
            </header>
            <p class="gya-text">{{ hexagram.daxiang }}</p>
          </section>

          <!-- 文言（乾坤专属，按段渲染 Q6） -->
          <section v-if="hexagram?.wenyan && hexagram.wenyan.length" class="gya-card">
            <header class="gya-card-head">
              <b class="gya-card-title">文言</b>
              <button
                type="button"
                class="gya-copy"
                :class="{ 'is-copied': copiedKey === 'wenyan' }"
                aria-label="复制文言"
                title="复制此段"
                @click="copyText(wenyanCopyText, 'wenyan')"
              >
                <span v-html="copiedKey === 'wenyan' ? CHECK_SVG : COPY_SVG"></span>
              </button>
            </header>
            <p v-for="(p, i) in hexagram.wenyan" :key="i" class="gya-text">{{ p }}</p>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ============================================================
 * 卦级原文聚合展示 · 样式
 * 令牌全部来自 tokens.css，不新增变量、不改现有令牌值。
 * ============================================================ */

/* ---------- 分区容器 ---------- */
.gya {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

/* ---------- 分区总标题（章节眉风格，06 §3.2 .p-cap 同族） ---------- */
.gya-title {
  margin: 0;
  padding: 0 0 0 10px;
  border-left: 3px solid var(--c-accent);
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-muted);
  letter-spacing: 2px;
  line-height: 1.4;
  font-family: var(--font-sans);
}

/* ---------- 主区 / 次区展开后堆叠容器 ---------- */
.gya-main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

/* ---------- 通用卡片 ---------- */
.gya-card {
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  padding: var(--sp-4) var(--sp-5);
  box-shadow: var(--shadow-card);
}

.gya-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
}

.gya-card-title {
  font-size: var(--fs-sm);
  color: var(--c-muted);
  font-weight: 500;
  letter-spacing: 1px;
  font-family: var(--font-sans);
}

/* ---------- 正文：古典原文，宋体（06 §4.2 与附录 B） ---------- */
.gya-text {
  font-family: var(--font-serif);
  font-size: clamp(15px, 4.4vw, 17px);
  line-height: 1.85;
  letter-spacing: 0.5px;
  color: var(--c-text);
  margin: 0;
}

/* ---------- 复制按钮 ---------- */
.gya-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--c-muted);
  opacity: 0.6;
  cursor: pointer;
  border-radius: var(--r-sm);
  transition: color var(--dur), opacity var(--dur), background var(--dur);
}
.gya-copy:hover {
  opacity: 1;
  color: var(--c-accent);
  background: var(--c-accent-soft);
}
.gya-copy:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}
.gya-copy.is-copied {
  color: var(--c-accent);
  opacity: 1;
}
.gya-copy--sm {
  width: 24px;
  height: 24px;
}

/* ---------- 爻辞卡组 ---------- */
.gya-lines {
  display: flex;
  flex-direction: column;
}

.gya-line {
  padding: var(--sp-3) 0;
  border-bottom: 1px dashed var(--c-line);
  display: grid;
  gap: var(--sp-2);
}
.gya-line:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

/* 动爻三重信号：底色 + 左朱砂边框 + 圆点（§5.2） */
.gya-line--moving {
  background: var(--c-accent-soft);
  border-left: 3px solid var(--c-accent);
  padding-left: var(--sp-3);
  padding-right: var(--sp-2);
  margin-left: calc(-1 * var(--sp-3));
  margin-right: calc(-1 * var(--sp-2));
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
  animation: gya-move-in 0.4s var(--ease) 0.3s both;
}

.gya-line-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}

.gya-line-left {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

/* 位置角标 ①②③④⑤⑥ */
.gya-pos {
  font-size: var(--fs-sm);
  color: var(--c-muted);
  font-weight: 600;
  font-family: var(--font-sans);
}

/* 动爻圆点（第三重信号） */
.gya-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c-accent);
  animation: gya-dot-pop 0.4s var(--ease) 0.3s both;
}

/* 爻名徽标 */
.gya-line-badge {
  background: var(--c-surface-2);
  color: var(--c-ink);
  border: 1px solid transparent;
  padding: 2px 10px;
  border-radius: var(--r-pill);
  font-size: var(--fs-sm);
  font-weight: 500;
  letter-spacing: 0.5px;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  font-family: var(--font-sans);
  line-height: 1.2;
}
.gya-line-badge--clickable {
  cursor: pointer;
  transition: border-color var(--dur);
}
.gya-line-badge--clickable:hover {
  border-color: var(--c-accent);
}
.gya-line-badge--clickable:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

/* 动爻徽标特殊样式 */
.gya-line--moving .gya-line-badge {
  background: var(--c-accent-soft);
  color: var(--c-accent);
  font-weight: 600;
}

/* ---------- 小象行（默认收起，动爻默认展开 Q4） ---------- */
.gya-xx {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.2s var(--ease);
}
.gya-xx--open {
  grid-template-rows: 1fr;
}
.gya-xx-inner {
  min-height: 0;
  overflow: hidden;
  padding-left: 26px;
  padding-top: var(--sp-2);
  margin-top: var(--sp-2);
  border-top: 1px dotted var(--c-line);
}

.gya-xx-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-bottom: 2px;
}

.gya-xx-prefix {
  font-size: var(--fs-xs);
  color: var(--c-muted);
  font-family: var(--font-sans);
  margin-right: 6px;
}

.gya-text--xx {
  font-size: var(--fs-sm);
  color: var(--c-muted);
  font-weight: 400;
  line-height: 1.7;
  letter-spacing: 0.2px;
}

/* "展开/收起小象"次级按钮 */
.gya-xx-toggle {
  border: 0;
  background: transparent;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--r-sm);
  font-family: var(--font-sans);
  transition: color var(--dur);
}
.gya-xx-toggle:hover {
  color: var(--c-accent);
}
.gya-xx-toggle:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

/* ---------- 次区手风琴（§5.3） ---------- */
.gya-acc {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.gya-acc-trigger {
  width: 100%;
  min-height: var(--tap-min);
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  background: var(--c-surface-2);
  border: 0;
  border-bottom: 1px dashed var(--c-line);
  border-radius: var(--r-md);
  cursor: pointer;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-muted);
  font-family: var(--font-sans);
  transition: color var(--dur);
}
.gya-acc-trigger:hover {
  color: var(--c-text);
}
.gya-acc-trigger:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

.gya-acc-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 14px;
  transition: transform 0.22s var(--ease);
  transform-origin: center;
}
.gya-acc-arrow--open {
  transform: rotate(90deg);
}

/* 手风琴折叠动画：grid-template-rows 0fr → 1fr */
.gya-acc-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.24s var(--ease);
}
.gya-acc-body--open {
  grid-template-rows: 1fr;
}
.gya-acc-inner {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding-top: var(--sp-2);
}

/* ---------- 动效（06 §五 克制不喧宾夺主） ---------- */

/* 动爻行入场：底色淡入（§5.5） */
@keyframes gya-move-in {
  0% {
    opacity: 0;
    transform: translateY(-4px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 动爻圆点弹入（§5.5） */
@keyframes gya-dot-pop {
  0% {
    transform: scale(0);
  }
  60% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

/* ---------- 响应式（06 §6.2 断点：不引入新断点） ---------- */

/* 手机竖屏窄屏：< 360px */
@media (max-width: 360px) {
  .gya-card {
    padding: 14px 16px;
  }
  .gya-dot {
    width: 8px;
    height: 8px;
  }
  .gya-acc-trigger {
    min-height: 44px;
  }
}

/* 平板竖屏 / 桌面：< 720px → 收窄内容区 */
@media (min-width: 480px) and (max-width: 899px) {
  .gya {
    max-width: 720px;
  }
  .gya-card {
    padding: 20px 24px;
  }
}

/* 桌面端：占满内容区（判据 data-layout，不写 @media 900px） */
:global([data-layout='desk']) .gya {
  max-width: 100%;
}
</style>
