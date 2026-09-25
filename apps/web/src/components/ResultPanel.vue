<script setup lang="ts">
/**
 * 排盘结果面板 —— 06 文档 §3.2（核心页面）
 *
 * 硬性布局约定（06 §3.2）：
 *   1. 卦符六爻自上而下绘制（组件内部反转，入参一律自下而上）
 *   2. 本卦（大）/ 互卦（小）/ 变卦（小）左中右并排
 *   3. 动爻右侧实心朱砂圆点；**变卦中对应爻不再标点**
 *   4. 体用在本卦上下两半分别以小字标注
 *   5. 五行生克结论永远独立成卡，是第二视觉焦点
 */
import { computed } from 'vue';
import { RELATION_CN, huLines, type ResolvedHexagram } from '@plumora/core';
import { TRIGRAMS } from '@plumora/knowledge';
import DegreeBadge from '@/components/DegreeBadge.vue';
import HexagramGlyph from '@/components/HexagramGlyph.vue';

const props = withDefaults(
  defineProps<{
    resolved: ResolvedHexagram;
    /** 起卦上下文（时间/方式/中间量） */
    context?: string;
  }>(),
  { context: '' },
);

const r = computed(() => props.resolved);

/** 互卦六爻（自下而上） */
const huLinesValue = computed(() => huLines(r.value.lines));

const tiIsUpper = computed(() => r.value.ti === r.value.upper);

const tiYongLabel = computed(() => {
  const t = TRIGRAMS[r.value.ti];
  const y = TRIGRAMS[r.value.yong];
  return `体${t.name}（${elementCn(t.element)}） · 用${y.name}（${elementCn(y.element)}）`;
});

const ruleLabel = computed(() =>
  r.value.tiYongRule === 'UPPER_YONG_LOWER_TI'
    ? '体用口径：上卦恒为用、下卦恒为体（笔记流派）'
    : '体用口径：动爻所在为用（通行）',
);

const ELEMENT_CN: Record<string, string> = {
  WOOD: '木',
  FIRE: '火',
  EARTH: '土',
  METAL: '金',
  WATER: '水',
};

function elementCn(e: string): string {
  return ELEMENT_CN[e] ?? e;
}

/** 结果页类象取常用五类，类目名与 05 文档 §2.2 表头一致 */
const XX_CATEGORIES = [
  { key: 'figures', label: '人伦' },
  { key: 'weather', label: '天时' },
  { key: 'objects', label: '静物' },
  { key: 'affairs', label: '性情人事' },
  { key: 'direction', label: '方位' },
] as const;

const xxRows = computed(() => [
  { role: 'ti' as const, label: '体', trigram: TRIGRAMS[r.value.ti] },
  { role: 'yong' as const, label: '用', trigram: TRIGRAMS[r.value.yong] },
]);

const benUpperName = computed(() => TRIGRAMS[r.value.ben.upper].name);
const benLowerName = computed(() => TRIGRAMS[r.value.ben.lower].name);

const relationCn = computed(() => RELATION_CN[r.value.judge.relation]);
</script>

<template>
  <div class="result">
    <p v-if="context" class="ctx">{{ context }}</p>

    <!-- 三卦并排 -->
    <div class="trio">
      <div class="trio-col main">
        <div class="cap">本 卦</div>
        <div class="glyph-wrap">
          <span class="side-label" :class="tiIsUpper ? 'ti' : 'yong'" style="top: 20%">
            {{ tiIsUpper ? '体' : '用' }}{{ TRIGRAMS[tiIsUpper ? r.upper : r.lower].name }}
          </span>
          <span class="side-label" :class="tiIsUpper ? 'yong' : 'ti'" style="top: 72%">
            {{ tiIsUpper ? '用' : '体' }}{{ TRIGRAMS[tiIsUpper ? r.lower : r.upper].name }}
          </span>
          <!-- role 参与生成 06 §6.1 规定的 aria-label：「本卦水风井，上卦坎下卦巽，第一爻动」 -->
          <HexagramGlyph :lines="r.lines" :moving="r.moving" size="lg" animate role="本卦" />
        </div>
        <div class="hex-name">
          <b>{{ r.ben.name }}</b>
          <span>{{ benUpperName }}上{{ benLowerName }}下 · 动爻 {{ r.movingLineName }}</span>
        </div>
      </div>

      <div class="trio-col">
        <div class="cap">互 卦</div>
        <div class="glyph-wrap">
          <HexagramGlyph :lines="huLinesValue" size="sm" animate role="互卦" />
        </div>
        <div class="hex-name">
          <b>{{ r.hu.name }}</b>
          <span>{{ TRIGRAMS[r.hu.upper].name }}上{{ TRIGRAMS[r.hu.lower].name }}下</span>
        </div>
      </div>

      <div class="trio-col">
        <div class="cap">变 卦</div>
        <div class="glyph-wrap">
          <!-- 变卦不标动爻圆点（06 §3.2 硬性约定） -->
          <HexagramGlyph :lines="r.changedLines" size="sm" animate role="变卦" />
        </div>
        <div class="hex-name">
          <b>{{ r.bian.name }}</b>
          <span>{{ TRIGRAMS[r.bian.upper].name }}上{{ TRIGRAMS[r.bian.lower].name }}下</span>
        </div>
      </div>
    </div>

    <!-- 生克结论卡（第二视觉焦点） -->
    <section class="card judge">
      <div class="judge-top">
        <DegreeBadge :degree="r.judge.degree" />
        <b class="serif">{{ relationCn }}</b>
      </div>
      <p class="judge-sum">{{ r.judge.summary }}</p>
      <p class="judge-elem">
        体卦 <b>{{ tiYongLabel }}</b>
      </p>
      <p class="judge-rule mono">{{ ruleLabel }}</p>
    </section>

    <!-- 卦意关键词 -->
    <section class="card">
      <h3 class="card-title">卦意关键词（手写笔记口径）</h3>
      <div class="kw-row">
        <span class="kw-title">本卦 · {{ r.ben.name }}</span>
        <span v-for="k in r.ben.keywords" :key="k" class="chip">{{ k }}</span>
      </div>
      <div class="kw-row">
        <span class="kw-title">变卦 · {{ r.bian.name }}</span>
        <span v-for="k in r.bian.keywords" :key="k" class="chip">{{ k }}</span>
      </div>
      <div class="kw-row">
        <span class="kw-title">互卦 · {{ r.hu.name }}</span>
        <span v-for="k in r.hu.keywords" :key="k" class="chip">{{ k }}</span>
      </div>
    </section>

    <!-- 体用类象 -->
    <section class="card">
      <h3 class="card-title">体用类象</h3>
      <div v-for="row in xxRows" :key="row.role" class="xx-row">
        <b class="tag" :class="row.role">
          {{ row.label }} {{ row.trigram.name }} · {{ elementCn(row.trigram.element) }}
        </b>
        <ul>
          <li v-for="c in XX_CATEGORIES" :key="c.key">
            <i>{{ c.label }}</i>{{ row.trigram[c.key] }}
          </li>
        </ul>
      </div>
    </section>

    <!-- 卦辞 / 爻辞 -->
    <section class="card">
      <h3 class="card-title">卦辞 · 爻辞</h3>
      <p class="pending">
        本卦卦辞与动爻爻辞（{{ r.movingLineName }}）属知识库 M1 录入项
        （见 05 文档 §3.3），需按《周易》通行本录入并两轮人工校对后开放。
        当前以「卦意关键词 + 类象」作为参考。
      </p>
    </section>
  </div>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ctx {
  font-size: var(--fs-xs);
  line-height: 1.7;
  color: var(--c-muted);
  word-break: break-word;
}

.trio {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.trio-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 6px 12px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
}

.trio-col.main {
  flex: 1.35;
}

.cap {
  margin-bottom: 10px;
  font-size: var(--fs-xs);
  letter-spacing: 3px;
  color: var(--c-muted);
}

.glyph-wrap {
  position: relative;
  display: flex;
  justify-content: center;
  min-height: 78px;
}

.side-label {
  position: absolute;
  left: 0;
  font-size: var(--fs-xs);
  letter-spacing: 1px;
  white-space: nowrap;
}

.side-label.ti {
  color: var(--c-accent);
}

.side-label.yong {
  color: var(--c-second);
}

.hex-name {
  margin-top: 12px;
  text-align: center;
}

.hex-name b {
  display: block;
  font-family: var(--font-serif);
  font-size: var(--fs-md);
  letter-spacing: 1px;
}

.hex-name span {
  display: block;
  margin-top: 3px;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.judge-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.judge-top b {
  font-size: var(--fs-md);
  letter-spacing: 1px;
}

.judge-sum {
  font-size: var(--fs-base);
  line-height: 1.7;
}

.judge-elem {
  margin-top: 8px;
  font-size: var(--fs-sm);
  color: var(--c-muted);
}

.judge-elem b {
  color: var(--c-text);
}

.judge-rule {
  margin-top: 6px;
  display: block;
}

.kw-row {
  margin: 8px 0;
}

.kw-title {
  margin-right: 8px;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.xx-row {
  margin-bottom: 14px;
}

.xx-row:last-child {
  margin-bottom: 0;
}

.xx-row ul {
  list-style: none;
  margin-top: 8px;
}

.xx-row li {
  padding: 4px 0;
  border-bottom: 1px dashed var(--c-line);
  font-size: var(--fs-sm);
  line-height: 1.7;
}

.xx-row li:last-child {
  border: 0;
}

.xx-row li i {
  display: inline-block;
  width: 62px;
  font-style: normal;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.pending {
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-muted);
}

/* 桌面端：三卦并排更舒展 */
@media (min-width: 900px) {
  .trio {
    gap: 16px;
  }

  .trio-col {
    padding: 20px 12px 16px;
  }
}
</style>
