<script setup lang="ts">
/**
 * 十翼原文展示 —— 设计规格「十翼原文展示-UI设计规格」v0.2
 *
 * 信息架构：
 *   - 总览页（无 slug）：5 篇卡片网格，点击进入单篇阅读
 *   - 阅读页（有 slug）：章目录侧栏/抽屉 + 经原文正文 + 页脚导航
 *
 * 数据降级：SHIYI_TEXTS 为空时显示"数据待校"占位（M1 骨架阶段）。
 * 视觉令牌全部沿用 tokens.css，不新增变量。
 * CSS 断点判据为 data-layout='desk'，不使用 @media (min-width: 900px)。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  SHIYI_TEXTS,
  getShiyiText,
  type ShiyiChapter,
  type ShiyiSlug,
} from '@plumora/knowledge';
import { goBack, navigate, route } from '@/router';

const props = withDefaults(
  defineProps<{
    /** 篇 slug；不传时为总览页（也可从路由参数读取） */
    slug?: ShiyiSlug;
  }>(),
  { slug: undefined },
);

/** 篇 slug：优先从 props 取，否则从路由参数取 */
const effectiveSlug = computed<ShiyiSlug | undefined>(() => {
  if (props.slug) return props.slug;
  const slug = route.value.params.slug;
  if (slug) return slug as ShiyiSlug;
  return undefined;
});

// ============ 数据加载 ============

/** 全部十翼文本（来自 knowledge 包） */
const texts = computed(() => SHIYI_TEXTS);

/** 数据是否就绪 */
const hasData = computed(() => SHIYI_TEXTS.length > 0);

/** 当前篇（阅读页用） */
const currentText = computed(() => {
  if (!effectiveSlug.value) return undefined;
  return getShiyiText(effectiveSlug.value);
});

/** 当前篇的章节列表 */
const chapters = computed<readonly ShiyiChapter[]>(() => currentText.value?.chapters ?? []);

/** 篇是否存在（slug 有值但数据里没有该篇） */
const slugNotFound = computed(() => !!effectiveSlug.value && !currentText.value);

// ============ 字号控制 ============

const FONT_SIZES = [15, 16, 17, 18, 19, 20, 21] as const;
const DEFAULT_FONT_INDEX = 2; // 17px
const FONT_SIZE_KEY = 'plumora.shiYi.fontSize';

function loadFontSize(): number {
  try {
    const raw = localStorage.getItem(FONT_SIZE_KEY);
    if (raw) {
      const idx = parseInt(raw, 10);
      if (idx >= 0 && idx < FONT_SIZES.length) return idx;
    }
  } catch { /* ignore */ }
  return DEFAULT_FONT_INDEX;
}

const fontIdx = ref(loadFontSize());
const fontSize = computed(() => FONT_SIZES[fontIdx.value] ?? 17);

function saveFontSize(): void {
  try {
    localStorage.setItem(FONT_SIZE_KEY, String(fontIdx.value));
  } catch { /* ignore */ }
}

function increaseFont(): void {
  if (fontIdx.value < FONT_SIZES.length - 1) {
    fontIdx.value++;
    saveFontSize();
  }
}

function decreaseFont(): void {
  if (fontIdx.value > 0) {
    fontIdx.value--;
    saveFontSize();
  }
}

// ============ 章目录导航 ============

/** 当前章序号（1-based），默认第一章 */
const currentChapterIdx = ref(1);

/** 章目录抽屉（移动端）是否打开 */
const chapterDrawerOpen = ref(false);

/** 圈号 ①②③④⑤⑥⑦⑧⑨⑩⑪⑫ */
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'] as const;

function circled(n: number): string {
  return CIRCLED[n - 1] ?? `${n}`;
}

/** 跳转到指定章 */
function scrollToChapter(idx: number): void {
  if (idx < 1 || idx > chapters.value.length) return;
  currentChapterIdx.value = idx;
  // 滚动到章元素
  const el = document.getElementById(`sy-chapter-${idx}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  chapterDrawerOpen.value = false;
}

/** 上一节 */
function prevChapter(): void {
  scrollToChapter(currentChapterIdx.value - 1);
}

/** 下一节 */
function nextChapter(): void {
  scrollToChapter(currentChapterIdx.value + 1);
}

/** 关闭章目录抽屉 */
function closeChapterDrawer(): void {
  chapterDrawerOpen.value = false;
}

// ============ 字数格式化 ============

function formatChars(count: number): string {
  if (count >= 10000) {
    const v = count / 10000;
    return v >= 10 ? `${v.toFixed(0)}万` : `${v.toFixed(1)}万`;
  }
  return `${count}字`;
}

// ============ 键盘导航 ============

function onKeydown(e: KeyboardEvent): void {
  // 总览页不需要键盘导航
  if (!effectiveSlug.value || !chapters.value.length) return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      prevChapter();
      break;
    case 'ArrowRight':
      e.preventDefault();
      nextChapter();
      break;
    case 'Escape':
      if (chapterDrawerOpen.value) {
        chapterDrawerOpen.value = false;
      } else {
        goBack();
      }
      break;
  }
}

// ============ 生命周期 ============

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown);
  }
});

// slug 变化时重置章号
watch(() => effectiveSlug.value, () => {
  currentChapterIdx.value = 1;
  chapterDrawerOpen.value = false;
});

// ============ 章标题生成 ============

/** 章标题：优先用数据中的 title，否则取首段前 6 字 */
function chapterTitle(ch: ShiyiChapter): string {
  if (ch.title) return ch.title;
  const first = ch.paragraphs[0];
  if (first) {
    const t = first.text;
    return t.length > 6 ? `${t.slice(0, 6)}…` : t;
  }
  return `第${ch.index}章`;
}

// ============ 导航入口 ============

function openReader(slug: ShiyiSlug): void {
  navigate(`/shi-yi/${slug}`);
}

function backToOverview(): void {
  navigate('/learn?tab=shiYI');
}
</script>

<template>
  <!-- ============================================================
   * 空态：数据未就绪（SHIYI_TEXTS 为空）
   * ============================================================ -->
  <div v-if="!hasData" class="sy-empty" role="region" aria-label="十翼数据待校">
    <div class="sy-empty-inner">
      <h2 class="sy-empty-title serif">十 翼</h2>
      <p class="sy-empty-sub">《周易》五篇经典原文</p>
      <div class="sy-empty-status">
        <span class="sy-empty-dot" aria-hidden="true"></span>
        <span>数据校对中 · 敬请期待</span>
      </div>
      <p class="sy-empty-hint">
        系辭上傳 · 系辭下傳 · 说卦傳 · 序卦傳 · 杂卦傳<br>
        五篇共 34 页 · 约 17 万字
      </p>
    </div>
  </div>

  <!-- ============================================================
   * slug 找不到：篇不存在
   * ============================================================ -->
  <div v-else-if="slugNotFound" class="sy-empty" role="region" aria-label="篇不存在">
    <div class="sy-empty-inner">
      <h2 class="sy-empty-title serif">篇不存在</h2>
      <p class="sy-empty-sub">未找到 slug 为「{{ effectiveSlug }}」的篇</p>
      <button type="button" class="btn-ghost" @click="backToOverview">返回十翼总览</button>
    </div>
  </div>

  <!-- ============================================================
   * 总览页（无 slug）
   * ============================================================ -->
  <div v-else-if="!effectiveSlug" class="sy-overview" role="region" aria-label="十翼总览">
    <header class="sy-header">
      <h2 id="sy-overview-title" class="sy-header-title serif">十 翼</h2>
      <p class="sy-header-sub">《周易》五篇经典原文 · 共 {{ texts.reduce((s, t) => s + t.chapterCount, 0) }} 章</p>
    </header>

    <!-- 5 篇卡片网格 -->
    <div class="sy-cards" role="list">
      <button
        v-for="text in texts"
        :key="text.slug"
        type="button"
        role="listitem"
        class="sy-card"
        :aria-label="`阅读《${text.nameTraditional}》`"
        @click="openReader(text.slug)"
      >
        <b class="sy-card-name serif">{{ text.nameTraditional }}</b>
        <p class="sy-card-meta">
          {{ text.chapterCount }} 章 · {{ formatChars(text.totalChars) }}字
        </p>
        <p class="sy-card-quote serif">{{ text.summary }}</p>
        <span class="sy-card-cta" aria-hidden="true">阅读 →</span>
      </button>
    </div>

    <!-- 阅读指南（可折叠） -->
    <details class="sy-guide">
      <summary class="sy-guide-summary">阅读指南</summary>
      <div class="sy-guide-body">
        <p>十翼是《周易》的注释与哲学阐释，共五篇：</p>
        <ul>
          <li><b>系辭上傳</b>（12 章）—— 论易理、宇宙观、圣人作易之旨</li>
          <li><b>系辭下傳</b>（9 章）—— 论占筮、卦变、人事吉凶</li>
          <li><b>说卦傳</b>（11 章）—— 八卦取象、万物类属</li>
          <li><b>序卦傳</b>（1 篇）—— 六十四卦排列顺序及相互关系</li>
          <li><b>杂卦傳</b>（1 篇）—— 六十四卦一卦一辞、两两对比</li>
        </ul>
        <p>点击卡片进入单篇阅读，支持字号调节、章目录跳转。</p>
      </div>
    </details>
  </div>

  <!-- ============================================================
   * 阅读页（有 slug 且数据存在）
   * ============================================================ -->
  <div v-else class="sy-reader" role="region" :aria-label="`阅读《${currentText?.nameTraditional}`">

    <!-- 顶栏：返回 + 篇名 + 字号 + 章目录 -->
    <header class="sy-reader-bar">
      <button type="button" class="sy-back" aria-label="返回学习页" @click="backToOverview">
        ← 学习
      </button>
      <b class="sy-reader-title serif">{{ currentText?.nameTraditional }}</b>
      <div class="sy-reader-ops">
        <!-- 字号控制 -->
        <div class="sy-font-ctrl" role="group" aria-label="字号调节">
          <button
            type="button"
            class="sy-font-btn"
            :disabled="fontIdx <= 0"
            aria-label="减小字号"
            title="减小字号"
            @click="decreaseFont"
          >A-</button>
          <span class="sy-font-val mono">{{ fontSize }}px</span>
          <button
            type="button"
            class="sy-font-btn"
            :disabled="fontIdx >= FONT_SIZES.length - 1"
            aria-label="增大字号"
            title="增大字号"
            @click="increaseFont"
          >A+</button>
        </div>
        <!-- 章目录按钮（移动端） -->
        <button
          type="button"
          class="sy-chapter-toggle"
          :aria-expanded="chapterDrawerOpen"
          aria-controls="sy-chapter-drawer"
          aria-label="打开章目录"
          @click="chapterDrawerOpen = true"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>
    </header>

    <!-- 主体：章目录侧栏（桌面） + 正文 -->
    <div class="sy-reader-body">
      <!-- 章目录侧栏（桌面端显示） -->
      <nav
        v-if="chapters.length"
        id="sy-chapter-sidebar"
        class="sy-chapter-sidebar"
        role="navigation"
        aria-label="章节目录"
      >
        <p class="sy-chapter-sidebar-title">章 目录</p>
        <ol class="sy-chapter-list">
          <li
            v-for="ch in chapters"
            :key="ch.index"
            class="sy-chapter-item"
            :class="{ active: currentChapterIdx === ch.index }"
          >
            <button
              type="button"
              class="sy-chapter-link"
              :aria-current="currentChapterIdx === ch.index ? 'true' : undefined"
              @click="scrollToChapter(ch.index)"
            >
              <span class="sy-chapter-num" aria-hidden="true">{{ circled(ch.index) }}</span>
              <span class="sy-chapter-label">{{ chapterTitle(ch) }}</span>
            </button>
          </li>
        </ol>
      </nav>

      <!-- 章目录抽屉遮罩（移动端） -->
      <div
        v-if="chapterDrawerOpen"
        class="sy-drawer-scrim"
        aria-hidden="true"
        @click="closeChapterDrawer"
      />

      <!-- 章目录抽屉（移动端） -->
      <aside
        v-if="chapters.length"
        id="sy-chapter-drawer"
        class="sy-chapter-drawer"
        :class="{ open: chapterDrawerOpen }"
        role="navigation"
        aria-label="章节目录"
        :aria-hidden="!chapterDrawerOpen"
      >
        <div class="sy-chapter-drawer-head">
          <b class="serif">{{ currentText?.nameTraditional }}</b>
          <button
            type="button"
            class="sy-drawer-close"
            aria-label="关闭章目录"
            @click="closeChapterDrawer"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <ol class="sy-chapter-list">
          <li
            v-for="ch in chapters"
            :key="`drawer-${ch.index}`"
            class="sy-chapter-item"
            :class="{ active: currentChapterIdx === ch.index }"
          >
            <button
              type="button"
              class="sy-chapter-link"
              @click="scrollToChapter(ch.index)"
            >
              <span class="sy-chapter-num" aria-hidden="true">{{ circled(ch.index) }}</span>
              <span class="sy-chapter-label">{{ chapterTitle(ch) }}</span>
            </button>
          </li>
        </ol>
      </aside>

      <!-- 正文 -->
      <article class="sy-article" :style="{ '--sy-font-size': fontSize + 'px' }">
        <section
          v-for="ch in chapters"
          :key="ch.index"
          :id="`sy-chapter-${ch.index}`"
          class="sy-chapter"
          :aria-labelledby="`sy-chapter-title-${ch.index}`"
        >
          <!-- 章导引 -->
          <header class="sy-chapter-head">
            <span class="sy-chapter-num-lg" aria-hidden="true">{{ circled(ch.index) }}</span>
            <b v-if="ch.title" :id="`sy-chapter-title-${ch.index}`" class="sy-chapter-title serif">
              {{ ch.title }}
            </b>
            <b v-else :id="`sy-chapter-title-${ch.index}`" class="sy-chapter-title serif">
              第{{ ch.index }}章
            </b>
          </header>

          <!-- 章引（可选） -->
          <p v-if="ch.quote" class="sy-chapter-quote serif">{{ ch.quote }}</p>

          <!-- 正文段落 -->
          <div class="sy-chapter-body">
            <p
              v-for="para in ch.paragraphs"
              :key="para.id"
              class="sy-para serif"
              :class="{ 'sy-para--quote': para.kind === 'quote', 'sy-para--preamble': para.kind === 'preamble' }"
            >
              {{ para.text }}
            </p>
          </div>

          <!-- 章末小注（可选） -->
          <p v-if="ch.note" class="sy-chapter-note">
            <span class="sy-note-mark" aria-hidden="true">─</span>
            {{ ch.note }}
          </p>

          <!-- 章末分隔线 -->
          <div v-if="ch.index < chapters.length" class="sy-chapter-divider" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
        </section>

        <!-- 无章节数据 -->
        <p v-if="!chapters.length" class="sy-no-content">
          本篇数据尚未录入。
        </p>
      </article>
    </div>
  </div>
</template>

<style scoped>
/* ============================================================
 * 十翼原文展示 · 样式
 * 令牌全部来自 tokens.css，不新增变量、不改现有令牌值。
 * 断点判据：data-layout='desk'（见 App.vue 断点说明）。
 * ============================================================ */

/* ---------- 空态 ---------- */
.sy-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.sy-empty-inner {
  text-align: center;
  padding: var(--sp-8);
}

.sy-empty-title {
  font-size: var(--fs-xl);
  letter-spacing: 4px;
  color: var(--c-text);
  margin-bottom: var(--sp-2);
}

.sy-empty-sub {
  font-size: var(--fs-sm);
  color: var(--c-muted);
  margin-bottom: var(--sp-6);
}

.sy-empty-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-pill);
  background: var(--c-surface);
  font-size: var(--fs-sm);
  color: var(--c-muted);
  margin-bottom: var(--sp-4);
}

.sy-empty-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-accent);
  opacity: 0.6;
}

.sy-empty-hint {
  font-size: var(--fs-xs);
  line-height: 1.8;
  color: var(--c-muted);
}

/* ---------- 总览页 ---------- */
.sy-overview {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.sy-header {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-2) 0;
}

.sy-header-title {
  font-size: var(--fs-xl);
  letter-spacing: 6px;
  color: var(--c-text);
}

.sy-header-sub {
  font-size: var(--fs-sm);
  color: var(--c-muted);
  letter-spacing: 1px;
}

/* ---------- 5 篇卡片 ---------- */
.sy-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--sp-3);
}

.sy-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-5);
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  background: var(--c-surface);
  box-shadow: var(--shadow-card);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur), box-shadow var(--dur), transform var(--dur);
  min-height: var(--tap-min);
}

.sy-card:hover {
  border-color: var(--c-accent);
  transform: translateY(-2px);
}

.sy-card:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

.sy-card-name {
  font-size: var(--fs-lg);
  letter-spacing: 1px;
  color: var(--c-text);
}

.sy-card-meta {
  font-size: var(--fs-xs);
  color: var(--c-muted);
  letter-spacing: 0.5px;
}

.sy-card-quote {
  font-size: var(--fs-sm);
  font-style: italic;
  color: var(--c-muted);
  line-height: 1.6;
  text-indent: 2em;
}

.sy-card-cta {
  position: absolute;
  right: var(--sp-4);
  bottom: var(--sp-3);
  font-size: var(--fs-xs);
  color: var(--c-accent);
  font-weight: 500;
}

/* 阅读指南 */
.sy-guide {
  margin-top: var(--sp-2);
}

.sy-guide-summary {
  cursor: pointer;
  font-size: var(--fs-sm);
  color: var(--c-muted);
  padding: var(--sp-2) 0;
  font-weight: 500;
}

.sy-guide-body {
  padding: var(--sp-2) 0 var(--sp-4);
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-muted);
}

.sy-guide-body ul {
  list-style: none;
  margin: var(--sp-2) 0;
}

.sy-guide-body li {
  padding: 4px 0;
  border-bottom: 1px dashed var(--c-line);
}

.sy-guide-body li:last-child {
  border-bottom: 0;
}

/* ---------- 阅读页 ---------- */
.sy-reader {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 顶栏 */
.sy-reader-bar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--c-line);
  background: var(--c-surface);
  flex: none;
}

.sy-back {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap-min);
  padding: 4px 12px;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-muted);
  font-size: var(--fs-sm);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: color var(--dur);
}

.sy-back:hover {
  color: var(--c-accent);
}

.sy-back:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

.sy-reader-title {
  flex: 1;
  font-size: var(--fs-md);
  letter-spacing: 1px;
  color: var(--c-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sy-reader-ops {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

/* 字号控制 */
.sy-font-ctrl {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-sm);
  background: var(--c-surface-2);
}

.sy-font-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 28px;
  padding: 0 6px;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: color var(--dur), background var(--dur);
}

.sy-font-btn:hover:not(:disabled) {
  color: var(--c-accent);
  background: var(--c-accent-soft);
}

.sy-font-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.sy-font-val {
  font-size: var(--fs-xs);
  color: var(--c-muted);
  min-width: 36px;
  text-align: center;
}

/* 章目录按钮 */
.sy-chapter-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-sm);
  background: var(--c-surface);
  color: var(--c-muted);
  cursor: pointer;
  transition: color var(--dur), border-color var(--dur);
}

.sy-chapter-toggle:hover {
  color: var(--c-accent);
  border-color: var(--c-accent);
}

.sy-chapter-toggle:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

/* ---------- 阅读主体 ---------- */
.sy-reader-body {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}

/* 章目录侧栏（桌面端） */
.sy-chapter-sidebar {
  display: none;
}

/* 章目录抽屉（移动端） */
.sy-chapter-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(320px, 85vw);
  background: var(--c-surface);
  border-left: 1px solid var(--c-line);
  box-shadow: var(--shadow-float);
  transform: translateX(100%);
  transition: transform 0.24s var(--ease);
  z-index: 100;
  overflow-y: auto;
}

.sy-chapter-drawer.open {
  transform: translateX(0);
}

.sy-drawer-scrim {
  position: fixed;
  inset: 0;
  background: var(--c-scrim);
  z-index: 99;
}

.sy-chapter-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4);
  border-bottom: 1px solid var(--c-line);
}

.sy-chapter-drawer-head b {
  font-size: var(--fs-md);
  letter-spacing: 1px;
}

.sy-drawer-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-muted);
  cursor: pointer;
  transition: color var(--dur);
}

.sy-drawer-close:hover {
  color: var(--c-accent);
}

.sy-drawer-close:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

/* 章目录列表 */
.sy-chapter-sidebar-title {
  padding: var(--sp-3) var(--sp-4) var(--sp-2);
  font-size: var(--fs-xs);
  letter-spacing: 3px;
  color: var(--c-muted);
  font-weight: 500;
}

.sy-chapter-list {
  list-style: none;
  display: flex;
  flex-direction: column;
}

.sy-chapter-item {
  border-left: 2px solid transparent;
}

.sy-chapter-item.active {
  border-left-color: var(--c-accent);
}

.sy-chapter-link {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  padding: 8px var(--sp-4);
  border: 0;
  background: transparent;
  color: var(--c-muted);
  font-size: var(--fs-sm);
  font-family: var(--font-sans);
  text-align: left;
  cursor: pointer;
  transition: color var(--dur), background var(--dur);
}

.sy-chapter-link:hover {
  color: var(--c-text);
  background: var(--c-surface-2);
}

.sy-chapter-link:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: -2px;
}

.sy-chapter-item.active .sy-chapter-link {
  color: var(--c-accent);
  background: var(--c-accent-soft);
}

.sy-chapter-num {
  flex: none;
  font-size: var(--fs-sm);
  font-weight: 600;
}

.sy-chapter-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- 正文 ---------- */
.sy-article {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: var(--sp-4);
  max-width: 100%;
  --sy-font-size: 17px;
}

.sy-chapter {
  margin-bottom: var(--sp-8);
}

.sy-chapter:last-child {
  margin-bottom: var(--sp-4);
}

/* 章导引 */
.sy-chapter-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
  padding-bottom: var(--sp-2);
  border-bottom: 1px dashed var(--c-line);
}

.sy-chapter-num-lg {
  flex: none;
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--c-accent);
  font-family: var(--font-sans);
}

.sy-chapter-title {
  font-size: var(--fs-lg);
  letter-spacing: 1px;
  color: var(--c-text);
}

/* 章引 */
.sy-chapter-quote {
  font-size: var(--fs-sm);
  font-style: italic;
  color: var(--c-muted);
  line-height: 1.6;
  text-indent: 2em;
  margin-bottom: var(--sp-3);
}

/* 正文段落 */
.sy-chapter-body {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.sy-para {
  font-family: var(--font-serif);
  font-size: var(--sy-font-size);
  line-height: 2.0;
  letter-spacing: 0.5px;
  color: var(--c-text);
  margin: 0;
  text-align: left;
}

.sy-para--quote {
  font-style: italic;
  color: var(--c-muted);
  padding-left: var(--sp-3);
  border-left: 2px solid var(--c-accent-soft);
}

.sy-para--preamble {
  color: var(--c-muted);
  font-size: calc(var(--sy-font-size) - 1px);
}

/* 章末小注 */
.sy-chapter-note {
  margin-top: var(--sp-4);
  padding-top: var(--sp-3);
  border-top: 1px dashed var(--c-line);
  font-size: var(--fs-sm);
  line-height: 1.6;
  color: var(--c-muted);
  text-align: center;
  font-family: var(--font-sans);
}

.sy-note-mark {
  color: var(--c-accent);
  margin-right: 4px;
}

/* 章末分隔线 */
.sy-chapter-divider {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: var(--sp-6) 0;
}

.sy-chapter-divider span {
  width: 20px;
  height: 1px;
  background: var(--c-accent);
  opacity: 0.4;
}

/* 无内容 */
.sy-no-content {
  text-align: center;
  padding: var(--sp-8) 0;
  color: var(--c-muted);
  font-size: var(--fs-sm);
}

/* ---------- 响应式：桌面端 ---------- */

/* 总览页：桌面 2 列网格 */
[data-layout='desk'] .sy-cards {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* 阅读页：章目录侧栏显示 + 抽屉隐藏 */
[data-layout='desk'] .sy-chapter-sidebar {
  display: block;
  width: 220px;
  flex: none;
  border-right: 1px solid var(--c-line);
  padding: var(--sp-4) 0;
  overflow-y: auto;
}

[data-layout='desk'] .sy-chapter-drawer,
[data-layout='desk'] .sy-drawer-scrim {
  display: none;
}

/* 阅读页正文：居中 + 限宽 */
[data-layout='desk'] .sy-article {
  padding: var(--sp-6);
}

[data-layout='desk'] .sy-reader-body {
  display: flex;
}

/* 总览卡片在桌面端更舒展 */
[data-layout='desk'] .sy-card {
  padding: var(--sp-5) var(--sp-6);
}

/* 阅读顶栏在桌面端更宽 */
[data-layout='desk'] .sy-reader-bar {
  padding: var(--sp-3) var(--sp-5);
}

/* 隐藏移动端专属的章目录按钮（桌面用侧栏） */
[data-layout='desk'] .sy-chapter-toggle {
  display: none;
}
</style>
