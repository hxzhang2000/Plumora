<script setup lang="ts">
/**
 * 排盘结果面板 —— 06 文档 §3.2（核心页面）
 *
 * 信息架构（产品负责人 2026-09-26 意见 3）：顶部「本卦 / 互卦 / 变卦」三个大块是切换器，
 * 下方单一详情面板随选中卦切换（WAI-ARIA tabs：tablist + tabpanel、roving tabindex、
 * 方向键 / Home / End 移动），三卦数据一步可达，键盘与 aria 不丢。
 *
 * 信息架构（产品负责人 2026-09-26 意见 4）：**切换器下方的全部内容都装在同一个
 * tabpanel 里**，随 `:key="tab"` 整体重挂载——不存在「切了 tab 下面纹丝不动」的固定区块。
 * 三卦各配一套下方卡片（体用是本卦专属概念，互 / 变视图既不标注、也不给提示）：
 *   本卦 → 生克结论卡（体用五行生克）+ 解卦参考 + 一键分享卡 + 体用类象 + 卦辞·爻辞
 *   互卦 → 生克结论卡 + 解卦参考 + 互卦构成（二至四爻 / 三至五爻来路）+ 上下卦类象 + 错卦·综卦
 *   变卦 → 生克结论卡 + 解卦参考 + 动爻与变爻 + 上下卦类象 + 错卦·综卦
 * （解卦卡位置为 2026-10-13 用户要求：在卦象与生克结论卡之后、类象之前；
 *   2026-10-14 起由「仅本卦」放宽为三卦视图均展示——用户要求三卦切换都给断语参考。
 *   引擎本身已含本·互·变三审叙述，故三视图所见为同一段整体断语。）
 * 互 / 变视图自 2026-10-13 起也展示体用生克结论（体卦固定为本卦之体，用卦取互 / 变中
 * 与原用侧同位之卦）；其余内容仍只写**由爻画可直接推出的事实**（取爻来路、上下卦、
 * 爻画异同、错综结构），不写额外吉凶断语（01 文档 §五 合规口径）。
 *
 * 保留的硬性布局约定（06 §3.2）：
 *   1. 卦符六爻自上而下绘制（入参一律自下而上，由 HexagramStage / HexagramGlyph 反转）
 *   2. 动爻右侧实心朱砂圆点；**变卦中对应爻不再标点**
 *   3. 体用在本卦上下两半标注 —— 已改为独立栅格列（HexagramStage），不再压在爻画上
 *   4. 五行生克结论永远独立成卡，是第二视觉焦点（落在本卦视图内，仅本卦可见）
 */
import { computed, ref, watch } from 'vue';
import { RELATION_CN, huLines, type ResolvedHexagram } from '@plumora/core';
import { TRIGRAMS, getHexagramByLines, type Hexagram, type TrigramNumber } from '@plumora/knowledge';
import DegreeBadge from '@/components/DegreeBadge.vue';
import HexagramStage from '@/components/HexagramStage.vue';
import GuaciYaoCiPanel from '@/components/GuaciYaoCiPanel.vue';
import InterpretationCard from '@/components/InterpretationCard.vue';
import HexagramChart from '@/components/HexagramChart.vue';
import ShareCard from '@/components/ShareCard.vue';
import { hexagramEn, hexagramPinyin, trigramPinyin } from '@/platform/bilingual';
import { useSettings } from '@/stores/settings';

type TabKey = 'ben' | 'hu' | 'bian';
type HalfMark = { kind: 'ti' | 'yong'; text: string };
type TabItem = { key: TabKey; cap: string; name: string; py: string; sub: string };

const TAB_KEYS: readonly TabKey[] = ['ben', 'hu', 'bian'];

/** 爻位中文序数（下标 = 爻位 1–6） */
const CN_NUM = ['', '一', '二', '三', '四', '五', '六'] as const;

const props = withDefaults(
  defineProps<{
    resolved: ResolvedHexagram;
    /** 起卦上下文（时间/方式/事实标签） */
    context?: string;
    /** 所问之事（带入解卦卡；为空时解卦按综合泛断） */
    question?: string;
  }>(),
  { context: '', question: '' },
);

const r = computed(() => props.resolved);

const settings = useSettings();
/** 双语显示开关（设置项，缺省关） */
const bil = computed(() => settings.showBilingual);

/** 八卦名，双语开启时附带拼音：乾 qián */
function tgNamePy(n: TrigramNumber): string {
  const base = TRIGRAMS[n].name;
  return bil.value ? `${base} ${trigramPinyin(n)}` : base;
}

/** 当前选中的卦；换新卦（resolved 变化）时回到本卦 */
const tab = ref<TabKey>('ben');
watch(
  () => props.resolved,
  () => {
    tab.value = 'ben';
  },
);

/** 底部六十四卦全图高亮跟随当前查看的卦（本 / 互 / 变） */
const chartUpper = computed(() =>
  tab.value === 'hu' ? r.value.hu.upper : tab.value === 'bian' ? r.value.bian.upper : r.value.ben.upper,
);
const chartLower = computed(() =>
  tab.value === 'hu' ? r.value.hu.lower : tab.value === 'bian' ? r.value.bian.lower : r.value.ben.lower,
);

/** 互卦六爻（自下而上） */
const huLinesValue = computed(() => huLines(r.value.lines));

const tiIsUpper = computed(() => r.value.ti === r.value.upper);

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

const tiInfo = computed(() => {
  const t = TRIGRAMS[r.value.ti];
  return `${t.name}（${elementCn(t.element)}）`;
});

const yongInfo = computed(() => {
  const y = TRIGRAMS[r.value.yong];
  return `${y.name}（${elementCn(y.element)}）`;
});

/** 本卦上/下卦的体用标注（互卦、变卦不标） */
const upperMark = computed<HalfMark | null>(() => {
  if (tab.value !== 'ben') return null;
  return tiIsUpper.value
    ? { kind: 'ti', text: `体 ${TRIGRAMS[r.value.upper].name}` }
    : { kind: 'yong', text: `用 ${TRIGRAMS[r.value.upper].name}` };
});

const lowerMark = computed<HalfMark | null>(() => {
  if (tab.value !== 'ben') return null;
  return tiIsUpper.value
    ? { kind: 'yong', text: `用 ${TRIGRAMS[r.value.lower].name}` }
    : { kind: 'ti', text: `体 ${TRIGRAMS[r.value.lower].name}` };
});

/** 顶部三个切换块：卦名大字 + 上下卦小字 */
const tabs = computed<TabItem[]>(() => [
  {
    key: 'ben',
    cap: '本 卦',
    name: r.value.ben.name,
    py: hexagramPinyin(r.value.ben.name),
    sub: `${tgNamePy(r.value.ben.upper)}上${tgNamePy(r.value.ben.lower)}下`,
  },
  {
    key: 'hu',
    cap: '互 卦',
    name: r.value.hu.name,
    py: hexagramPinyin(r.value.hu.name),
    sub: `${tgNamePy(r.value.hu.upper)}上${tgNamePy(r.value.hu.lower)}下`,
  },
  {
    key: 'bian',
    cap: '变 卦',
    name: r.value.bian.name,
    py: hexagramPinyin(r.value.bian.name),
    sub: `${tgNamePy(r.value.bian.upper)}上${tgNamePy(r.value.bian.lower)}下`,
  },
]);

/** 下方详情面板展示的当前卦 */
const panel = computed(() => {
  if (tab.value === 'hu') {
    const name = r.value.hu.name;
    return {
      cap: '互 卦',
      name,
      py: hexagramPinyin(name),
      en: hexagramEn(name),
      meta: `${tgNamePy(r.value.hu.upper)}上${tgNamePy(r.value.hu.lower)}下 · 取自本卦二至五爻`,
      lines: huLinesValue.value,
      moving: 0,
      role: '互卦',
      upperMark: null as HalfMark | null,
      lowerMark: null as HalfMark | null,
      keywords: r.value.hu.keywords,
    };
  }
  if (tab.value === 'bian') {
    const name = r.value.bian.name;
    return {
      cap: '变 卦',
      name,
      py: hexagramPinyin(name),
      en: hexagramEn(name),
      meta: `${tgNamePy(r.value.bian.upper)}上${tgNamePy(r.value.bian.lower)}下 · 本卦动爻变动所得`,
      lines: r.value.changedLines,
      moving: 0,
      role: '变卦',
      upperMark: null as HalfMark | null,
      lowerMark: null as HalfMark | null,
      keywords: r.value.bian.keywords,
    };
  }
  const name = r.value.ben.name;
  return {
    cap: '本 卦',
    name,
    py: hexagramPinyin(name),
    en: hexagramEn(name),
    meta: `${tgNamePy(r.value.ben.upper)}上${tgNamePy(r.value.ben.lower)}下 · 动爻 ${r.value.movingLineName}`,
    lines: r.value.lines,
    moving: r.value.moving,
    role: '本卦',
    upperMark: upperMark.value,
    lowerMark: lowerMark.value,
    keywords: r.value.ben.keywords,
  };
});

/** tablist 方向键：roving tabindex（与 SegControl 的键盘约定一致） */
function onTabKey(e: KeyboardEvent) {
  const nav = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (!nav.includes(e.key)) return;
  const last = TAB_KEYS.length - 1;
  const from = TAB_KEYS.indexOf(tab.value);
  const cur = from < 0 ? 0 : from;
  let next = cur;
  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      next = cur <= 0 ? last : cur - 1;
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      next = cur >= last ? 0 : cur + 1;
      break;
    case 'Home':
      next = 0;
      break;
    default:
      next = last;
  }
  e.preventDefault();
  const target = TAB_KEYS[next];
  if (!target) return;
  tab.value = target;
  (e.currentTarget as HTMLElement | null)
    ?.querySelectorAll<HTMLButtonElement>('.tab')[next]
    ?.focus();
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

const relationCn = computed(() => RELATION_CN[r.value.judge.relation]);

/**
 * 互 / 变视图的体用生克结论（体卦固定为本卦之体，用卦取互 / 变中与原用侧
 * 同位之卦）。2026-10-13 需求：互卦、变卦也要判断并显示体用关系。
 */
const currentJudge = computed(() =>
  tab.value === 'hu' ? r.value.huJudge : r.value.bianJudge,
);

/** 互 / 变视图的「用卦」信息：取互 / 变中与原用侧同位的那一卦 */
const currentYongInfo = computed(() => {
  const hex = tab.value === 'hu' ? r.value.hu : r.value.bian;
  const y = TRIGRAMS[tiIsUpper.value ? hex.lower : hex.upper];
  return `${y.name}（${elementCn(y.element)}）`;
});

/* ---------------------------------------------------------------
 * 互卦 / 变卦视图的下方事实（意见 4：切到互 / 变时，下方区域整体
 * 换成该卦自己的内容）。全部由爻画直接推出，不含吉凶断语。
 * ------------------------------------------------------------- */

/** 爻位中文序数：1 → 初爻、6 → 上爻、其余 → 第 N 爻（06 §6.1 措辞） */
function posLabel(n: number): string {
  if (n === 1) return '初爻';
  if (n === 6) return '上爻';
  return `第${CN_NUM[n]}爻`;
}

/** 互卦构成：下互 / 上互取自本卦哪几爻，以及与本卦的爻画异同 */
const huFacts = computed(() => {
  const r0 = r.value;
  const hu = huLinesValue.value;
  let diff = 0;
  for (let i = 0; i < 6; i += 1) {
    if (hu[i] !== r0.lines[i]) diff += 1;
  }
  return {
    /** 下互：本卦二至四爻 */
    lower: TRIGRAMS[r0.hu.lower],
    /** 上互：本卦三至五爻 */
    upper: TRIGRAMS[r0.hu.upper],
    diff,
  };
});

/** 动爻与变爻：变卦由本卦动爻一变而得（03 §3.3） */
const bianFacts = computed(() => {
  const r0 = r.value;
  const i = r0.moving - 1;
  const upperMoved = r0.moving >= 4;
  return {
    lineName: r0.movingLineName,
    pos: posLabel(r0.moving),
    from: r0.lines[i] === 1 ? '阳' : '阴',
    to: r0.changedLines[i] === 1 ? '阳' : '阴',
    moved: upperMoved ? '上卦（外卦）' : '下卦（内卦）',
    kept: upperMoved ? '下卦（内卦）' : '上卦（外卦）',
  };
});

/** 卦辞 / 爻辞 / 传注 数据到位性：判据是「六字段任一非空」——占位卡消失、聚合面板接管。
 *
 *  数据侧现状（2026-10-14 核对 knowledge/hexagrams.ts 的 RAW_TEXT）：64 卦的卦辞与
 *  六爻爻辞**全部录入完毕**，六字段均为空的情况已不存在。这里的分支保留为**防御性兜底**：
 *  将来若某卦文本被回退/抽换，页面降级成一句说明，而不是渲染一片空白。 */
const hasGuaciData = computed(() => {
  const h = r.value.ben;
  return !!(
    h.guaci ||
    h.lines ||
    h.yongText ||
    h.tuan ||
    h.daxiang ||
    (h.wenyan && h.wenyan.length)
  );
});

/** 当前互卦 / 变卦的错卦（六爻阴阳相反）与综卦（六爻上下颠倒） */
const cuoZong = computed(() => {
  const r0 = r.value;
  const lines = tab.value === 'hu' ? huLinesValue.value : r0.changedLines;
  const self = tab.value === 'hu' ? r0.hu : r0.bian;
  const cuo = getHexagramByLines(lines.map((l) => 1 - l));
  const zong = getHexagramByLines([...lines].reverse());
  const sub = (h: Hexagram): string => `${tgNamePy(h.upper)}上${tgNamePy(h.lower)}下`;
  return {
    cuoName: cuo.name,
    cuoSub: sub(cuo),
    zongName: zong.name,
    zongSub: sub(zong),
    /** 综卦与当前卦相同（六爻上下对称的卦） */
    zongSelf: zong.code === self.code,
  };
});

/** 互卦 / 变卦的上下卦类象行——体用是本卦概念，这里只按上 / 下卦取象 */
const halfRows = computed(() => {
  const hex = tab.value === 'hu' ? r.value.hu : r.value.bian;
  return [
    { key: 'up', label: '上', trigram: TRIGRAMS[hex.upper] },
    { key: 'down', label: '下', trigram: TRIGRAMS[hex.lower] },
  ];
});
</script>

<template>
  <div class="result">
    <p v-if="context" class="ctx">{{ context }}</p>

    <!-- 三卦切换器：顶部三个醒目卦名块，点击 / 键盘切换下方详情 -->
    <div class="tabs" role="tablist" aria-label="卦象切换" @keydown="onTabKey">
      <button
        v-for="t in tabs"
        :id="`hex-tab-${t.key}`"
        :key="t.key"
        type="button"
        role="tab"
        class="tab"
        :class="{ active: tab === t.key }"
        :aria-selected="tab === t.key"
        aria-controls="hex-panel"
        :tabindex="tab === t.key ? 0 : -1"
        @click="tab = t.key"
      >
        <span class="tab-cap">{{ t.cap }}</span>
        <b class="tab-name serif">{{ t.name }}</b>
        <span v-if="t.py" class="tab-py">{{ t.py }}</span>
        <span class="tab-sub">{{ t.sub }}</span>
      </button>
    </div>

    <!-- 详情面板：切到哪个卦，切换器下方**全部内容**（卦名 / 上下卦事实行 / 卦象舞台 /
         卦意 chips / 动爻标记归属 + 其下的卡片组）都整体换成那个卦自己的内容。
         id 固定：三个 tab 的 aria-controls 都指向这一个面板；
         :key 让切换时整块重挂载，逐爻浮现动画重放，也保证下方卡片组不残留上一卦。 -->
    <section
      id="hex-panel"
      :key="tab"
      class="tabpanel"
      role="tabpanel"
      :aria-labelledby="`hex-tab-${tab}`"
      tabindex="0"
    >
      <div class="card panel">
        <div class="p-head">
          <span class="p-cap">{{ panel.cap }}</span>
          <b class="p-name serif">{{ panel.name }}</b>
          <span v-if="panel.py" class="p-py">{{ panel.py }}</span>
          <span v-if="panel.en" class="p-en">{{ panel.en }}</span>
          <span class="p-meta">{{ panel.meta }}</span>
        </div>

        <HexagramStage
          :lines="panel.lines"
          :moving="panel.moving"
          :role="panel.role"
          :upper-mark="panel.upperMark"
          :lower-mark="panel.lowerMark"
          size="lg"
          animate
        />

        <div class="kw">
          <span class="kw-label">卦意</span>
          <span v-for="k in panel.keywords" :key="k" class="chip">{{ k }}</span>
        </div>
      </div>

      <!-- ========== 本卦：体用生克结论（第二视觉焦点）+ 体用类象 + 卦辞爻辞 ========== -->
      <template v-if="tab === 'ben'">
        <section class="card judge">
          <div class="judge-top">
            <DegreeBadge :degree="r.judge.degree" />
            <b class="serif">{{ relationCn }}</b>
          </div>
          <p class="judge-sum">{{ r.judge.summary }}</p>
          <p class="judge-elem">
            体卦 <b>{{ tiInfo }}</b>　用卦 <b>{{ yongInfo }}</b>
          </p>
        </section>

        <!-- 解卦参考：结合卦象与所问之事（问题改动实时重算）。
             位置（2026-10-13 用户要求）：卦象与生克结论卡之后、体用类象之前。 -->
        <InterpretationCard :resolved="r" :question="question" view="ben" />

        <!-- 一键分享卡片（canvas 生成 PNG）。
             三卦视图都可生成：卡片画的是**整盘**（本卦卦象 + 整体断语 + 起卦信息），
             与当前 tab 无关，所以互 / 变视图下不必先切回本卦。 -->
        <ShareCard :resolved="r" :question="question" :context="context" />

        <!-- 体用类象：体 / 用是本卦专属概念，只在本卦视图出现 -->
        <section class="card">
          <h3 class="card-title">体用类象</h3>
          <div v-for="row in xxRows" :key="row.role" class="xx-row">
            <b class="tag" :class="row.role">
              {{ row.label }} {{ row.trigram.name }}<span v-if="bil" class="bil-py"> {{ trigramPinyin(row.trigram.number) }}</span> · {{ elementCn(row.trigram.element) }}
            </b>
            <ul>
              <li v-for="c in XX_CATEGORIES" :key="c.key">
                <i>{{ c.label }}</i>{{ row.trigram[c.key] }}
              </li>
            </ul>
          </div>
        </section>

        <!-- 卦辞 / 爻辞：正常情况下走聚合面板（GuaciYaoCiPanel）；占位卡是数据缺失时的兜底 -->
        <GuaciYaoCiPanel
          v-if="hasGuaciData"
          :hexagram="r.ben"
          :moving-line="r.moving"
        />
        <section v-else class="card">
          <h3 class="card-title">卦辞 · 爻辞</h3>
          <p class="pending">
            本卦卦辞与动爻爻辞（{{ r.movingLineName }}）数据暂无，当前以「卦意关键词 + 类象」作为参考。
          </p>
        </section>
      </template>

      <template v-else>
        <!-- 互 / 变：体用生克结论（2026-10-13 起，互 / 变也判断并显示；
             体卦固定为本卦之体，用卦取互 / 变中与原用侧同位之卦） -->
        <section class="card judge">
          <div class="judge-top">
            <DegreeBadge :degree="currentJudge.degree" />
            <b class="serif">{{ RELATION_CN[currentJudge.relation] }}</b>
          </div>
          <p class="judge-sum">{{ currentJudge.summary }}</p>
          <p class="judge-elem">
            体卦 <b>{{ tiInfo }}</b>　用卦 <b>{{ currentYongInfo }}</b>
          </p>
        </section>

        <!-- 解卦参考：结合卦象与所问之事（问题改动实时重算）。
             2026-10-14 起，互 / 变视图也展示——用户要求三卦切换时都给断语参考；
             引擎本身已含本·互·变三审叙述，故三卦所见为同一段整体断语。
             :view 把当前查看的卦传给卡片，互 / 变视图会显示语境提示。 -->
        <InterpretationCard :resolved="r" :question="question" :view="tab" />

        <!-- 一键分享卡片：与上方解卦卡一样在三卦视图常驻（内容为整盘，与 tab 无关） -->
        <ShareCard :resolved="r" :question="question" :context="context" />

        <!-- 互 / 变：该卦自己的推演事实 + 该卦上下卦类象 + 该卦错综。 -->
        <!-- 互卦来路：下互取二至四爻、上互取三至五爻（03 §3.4） -->
        <section v-if="tab === 'hu'" class="card">
          <h3 class="card-title">互卦构成</h3>
          <dl class="facts">
            <div class="fact">
              <dt>下互</dt>
              <dd>本卦二至四爻 · {{ huFacts.lower.name }}<span v-if="bil" class="bil-py"> {{ trigramPinyin(huFacts.lower.number) }}</span>（{{ elementCn(huFacts.lower.element) }}）</dd>
            </div>
            <div class="fact">
              <dt>上互</dt>
              <dd>本卦三至五爻 · {{ huFacts.upper.name }}<span v-if="bil" class="bil-py"> {{ trigramPinyin(huFacts.upper.number) }}</span>（{{ elementCn(huFacts.upper.element) }}）</dd>
            </div>
            <div class="fact">
              <dt>共用爻</dt>
              <dd>三、四两爻上下互共用</dd>
            </div>
            <div class="fact">
              <dt>爻画异同</dt>
              <dd>与本卦六爻相比，{{ huFacts.diff }} 爻不同</dd>
            </div>
          </dl>
        </section>

        <!-- 变卦来路：本卦动爻一变而得（03 §3.3） -->
        <section v-else class="card">
          <h3 class="card-title">动爻与变爻</h3>
          <dl class="facts">
            <div class="fact">
              <dt>动爻</dt>
              <dd>{{ bianFacts.lineName }}（本卦{{ bianFacts.pos }}）</dd>
            </div>
            <div class="fact">
              <dt>变爻</dt>
              <dd>{{ bianFacts.from }} → {{ bianFacts.to }}</dd>
            </div>
            <div class="fact">
              <dt>卦变</dt>
              <dd>{{ bianFacts.moved }}变动，{{ bianFacts.kept }}与本卦相同</dd>
            </div>
            <div class="fact">
              <dt>爻画异同</dt>
              <dd>变卦与本卦仅此一爻不同，其余五爻相同</dd>
            </div>
          </dl>
        </section>

        <section class="card">
          <h3 class="card-title">上下卦类象</h3>
          <div v-for="row in halfRows" :key="row.key" class="xx-row">
            <b class="tag">
              {{ row.label }} {{ row.trigram.name }}<span v-if="bil" class="bil-py"> {{ trigramPinyin(row.trigram.number) }}</span> · {{ elementCn(row.trigram.element) }}
            </b>
            <ul>
              <li v-for="c in XX_CATEGORIES" :key="c.key">
                <i>{{ c.label }}</i>{{ row.trigram[c.key] }}
              </li>
            </ul>
          </div>
        </section>

        <section class="card">
          <h3 class="card-title">错卦 · 综卦</h3>
          <dl class="facts">
            <div class="fact">
              <dt>错卦</dt>
              <dd>
                {{ cuoZong.cuoName }}<span v-if="bil && hexagramPinyin(cuoZong.cuoName)" class="bil-py"> {{ hexagramPinyin(cuoZong.cuoName) }}</span>（{{ cuoZong.cuoSub }}）· 六爻阴阳相反
              </dd>
            </div>
            <div class="fact">
              <dt>综卦</dt>
              <dd>
                {{ cuoZong.zongName }}<span v-if="bil && hexagramPinyin(cuoZong.zongName)" class="bil-py"> {{ hexagramPinyin(cuoZong.zongName) }}</span>（{{ cuoZong.zongSub }}）·
                {{ cuoZong.zongSelf ? '六爻上下颠倒后仍为此卦' : '六爻上下颠倒' }}
              </dd>
            </div>
          </dl>
        </section>
      </template>
    </section>

    <!-- 六十四卦全图对照：常驻于排盘结果底部，高亮当前查看的卦（本 / 互 / 变随切换器同步） -->
    <HexagramChart :current-upper="chartUpper" :current-lower="chartLower" />
  </div>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: calc(14px * var(--font-scale));
}

.ctx {
  font-size: var(--fs-xs);
  line-height: 1.7;
  color: var(--c-muted);
  word-break: break-word;
}

/* ---------- 三卦切换器 ---------- */

.tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-height: var(--tap-min);
  padding: 11px 6px 10px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  background: var(--c-surface);
  color: var(--c-muted);
  text-align: center;
  box-shadow: var(--shadow-card);
  transition:
    border-color var(--dur),
    background var(--dur),
    box-shadow var(--dur),
    transform var(--dur);
}

.tab:hover {
  border-color: var(--c-accent);
  transform: translateY(-2px);
}

.tab:active {
  transform: translateY(0);
}

.tab.active {
  border-color: var(--c-accent);
  background:
    linear-gradient(180deg, var(--c-accent-soft), transparent 72%),
    var(--c-surface);
  box-shadow: var(--shadow-main);
  transform: translateY(-2px);
}

.tab-cap {
  font-size: var(--fs-xs);
  letter-spacing: 2px;
}

.tab-name {
  /* 三列等宽，长卦名（四字）也要一行放得下：随视口缩放，两端夹紧 */
  font-size: clamp(19px, 5.6vw, var(--fs-xl));
  line-height: 1.25;
  letter-spacing: 1px;
  white-space: nowrap;
  color: var(--c-ink);
}

.tab.active .tab-cap,
.tab.active .tab-name {
  color: var(--c-accent);
}

.tab-sub {
  font-size: var(--fs-xs);
  letter-spacing: 1px;
  color: var(--c-muted);
}

/* 双语：切换器下方的卦名拼音 */
.tab-py {
  font-size: var(--fs-xs);
  letter-spacing: 0.5px;
  color: var(--c-accent);
  font-style: italic;
}

/* ---------- 详情面板（tabpanel：内部整块随 tab 重挂载） ---------- */

.tabpanel {
  display: flex;
  flex-direction: column;
  gap: calc(14px * var(--font-scale));
}

.tabpanel:focus-visible {
  outline-offset: 4px;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: calc(16px * var(--font-scale));
}

.p-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 10px;
}

.p-cap {
  font-size: var(--fs-xs);
  letter-spacing: 3px;
  color: var(--c-muted);
}

.p-name {
  font-size: var(--fs-lg);
  letter-spacing: 1px;
}

.p-meta {
  margin-left: auto;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

/* 双语：详情面板卦名旁的拼音与英文 */
.p-py {
  font-size: var(--fs-sm);
  letter-spacing: 0.5px;
  color: var(--c-accent);
  font-style: italic;
}

.p-en {
  margin-left: 6px;
  font-size: var(--fs-xs);
  letter-spacing: 0.5px;
  color: var(--c-muted);
  font-style: italic;
}

/* 双语：类象 / 推演事实中追加的八卦拼音（行内小字） */
.bil-py {
  font-size: 0.85em;
  letter-spacing: 0.3px;
  color: var(--c-accent);
  font-style: italic;
}

/* ---------- 面板内的事实行（互卦构成 / 动爻与变爻 / 错卦·综卦） ---------- */

.facts {
  margin: 0;
}

.fact {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px dashed var(--c-line);
  font-size: var(--fs-sm);
  line-height: 1.7;
}

.fact:first-child {
  padding-top: 0;
}

.fact:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.fact dt {
  flex: none;
  min-width: 4.5em;
  font-size: var(--fs-xs);
  letter-spacing: 1px;
  color: var(--c-muted);
}

.fact dd {
  flex: 1;
  min-width: 0;
  margin: 0;
}

.kw {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 2px;
  padding-top: 12px;
  border-top: 1px dashed var(--c-line);
}

.kw-label {
  margin-right: 6px;
  font-size: var(--fs-xs);
  letter-spacing: 1px;
  color: var(--c-muted);
}

/* ---------- 生克结论卡 ---------- */

.judge-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

/* 生克结论卡首行（大凶 / 用克体 等）放大，强化为视觉焦点 */
.judge-top :deep(.badge) {
  font-size: var(--fs-md);
  padding: 4px 12px;
}

.judge-top b {
  font-size: var(--fs-xl);
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

/* ---------- 类象卡：本卦「体用类象」与互 / 变「上下卦类象」共用 ---------- */

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

/* 桌面端：切换器与面板更舒展（判据为 data-layout，见 App.vue 的断点说明） */
[data-layout='desk'] .tabs {
  gap: 16px;
}

[data-layout='desk'] .tab {
  padding: 16px 10px 14px;
}

[data-layout='desk'] .panel {
  gap: calc(20px * var(--font-scale));
  padding: var(--sp-6);
}
</style>
