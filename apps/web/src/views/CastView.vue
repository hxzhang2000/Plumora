<script setup lang="ts">
/**
 * 起卦页（首页）—— 06 文档 §3.1
 *
 * 方式选择器记忆「默认起卦方式」设置（FR-10）；
 * 四种方式各自的输入区 + 拇指热区内的「起卦」主按钮（06 §一 原则 4）。
 */
import { computed, onActivated, onDeactivated, onMounted, reactive, ref } from 'vue';
import {
  CastInputError,
  castByCharacter,
  castByNumber,
  castByRandom,
  castBySound,
  castByTime,
  castByTimeParts,
  castContext,
  hourBranchName,
  hourNumber,
  type CastResult,
  type CastMethod,
} from '@plumora/core';
import { isHanChar, lookupStrokes, type StrokeStandard } from '@plumora/knowledge';
import { solarlunarProvider } from '@plumora/lunar';
import SegControl from '@/components/SegControl.vue';
import { navigate } from '@/router';
import { setCurrentCast } from '@/stores/cast';
import { updateSetting, useSettings } from '@/stores/settings';
import { toast } from '@/stores/toast';

const settings = useSettings();

/* ---------- 方式 ---------- */

const methodOptions = [
  { value: 'TIME' as const, label: '时间' },
  { value: 'NUMBER' as const, label: '数字' },
  { value: 'CHARACTER' as const, label: '汉字' },
  { value: 'SOUND' as const, label: '声音' },
];

/**
 * 当前起卦方式 —— **直接读写设置**，不再另存一份组件 ref。
 *
 * 原来这里是 `ref(settings.defaultCastMethod)`（setup 只求值一次）+ setMethod 反向写回设置，
 * 于是同一份状态有两个主人：设置面板改成「汉字」后，被 KeepAlive 缓存的起卦页仍停在「时间」；
 * 用户随后点一下「时间」，又会把设置静默改回去，覆盖他刚做的选择（审查 W-3）。
 */
const method = computed<CastMethod>({
  get: () => settings.defaultCastMethod,
  set: (m) => updateSetting('defaultCastMethod', m),
});

const isTime = computed(() => method.value === 'TIME');
const isNumber = computed(() => method.value === 'NUMBER');
const isCharacter = computed(() => method.value === 'CHARACTER');

/* ---------- 时间起卦 ---------- */

const now = ref(new Date());
let timer: number | undefined;

function startTimer() {
  stopTimer();
  timer = window.setInterval(() => (now.value = new Date()), 1000);
}
function stopTimer() {
  if (timer !== undefined) {
    window.clearInterval(timer);
    timer = undefined;
  }
}

onMounted(() => {
  if (isTime.value) startTimer();
});
onActivated(() => {
  now.value = new Date();
  if (isTime.value) startTimer();
});
onDeactivated(stopTimer);

const timePreview = computed(() => {
  try {
    const cast = castByTime(now.value, solarlunarProvider);
    return {
      ok: true as const,
      label: cast.label,
      shifted: cast.params.shifted,
      detail: `年支 ${cast.params.yearBranchNo} ＋ 月 ${cast.params.lunarMonth} ＋ 日 ${cast.params.lunarDay} ＝ ${cast.params.s1}　＋ 时 ${cast.params.hourNo} ＝ ${cast.params.s2}`,
      clock: `${String(now.value.getHours()).padStart(2, '0')}:${String(now.value.getMinutes()).padStart(2, '0')}:${String(now.value.getSeconds()).padStart(2, '0')}`,
    };
  } catch {
    return { ok: false as const, label: '农历转换失败', shifted: false, detail: '请检查系统时间是否在 1900–2100 年之间', clock: '' };
  }
});

/** 手动修正（FR-01 / 03 §6.4）：允许用户直接指定农历月、日、时辰 */
const manual = reactive({ enabled: false, month: 8, day: 15, hourNo: 7 });

/** 当前年支序数（手动修正时年支仍取当前农历年） */
const currentYearBranchNo = computed(() => {
  const lu = solarlunarProvider.solar2lunar(
    now.value.getFullYear(),
    now.value.getMonth() + 1,
    now.value.getDate(),
  );
  return lu ? ((((lu.lYear - 4) % 12) + 12) % 12) + 1 : 1;
});

const manualLabel = computed(
  () => `${manual.month} 月 ${manual.day} 日 ${hourBranchName(manual.hourNo)}时（手动修正）`,
);

/* ---------- 数字起卦 ---------- */

const numMode = ref<'TWO' | 'ONE'>('TWO');
const num1 = ref('');
const num2 = ref('');

/* ---------- 汉字起卦 ---------- */

const charMode = ref<'TWO' | 'ONE'>('TWO');
const char1 = ref('');
const char2 = ref('');
/** 手动补充的笔画（04 §4.2「记住该字」的内存版） */
const manualStrokes = reactive<Record<string, number>>({});
const manualFor = ref<{ char: string; slot: number } | null>(null);
const manualValue = ref('');

const standard = computed<StrokeStandard>(() => settings.strokeStandard);
const standardLabel = computed(() => (standard.value === 'TRADITIONAL' ? '繁体' : '简体'));

function strokeInfo(ch: string) {
  if (!ch) return null;
  if (!isHanChar(ch)) return { invalid: true as const };
  return lookupStrokes(ch, standard.value, manualStrokes);
}

const strokeHint1 = computed(() => {
  const info = strokeInfo(char1.value);
  if (!info) return '';
  if ('invalid' in info) return '请输入汉字';
  return `${info.strokes} 画${info.manual ? '（手动）' : ''}${info.fellBackToSimplified ? '（繁体缺省，按简体）' : ''}`;
});

const strokeHint2 = computed(() => {
  if (charMode.value === 'ONE') return '';
  const info = strokeInfo(char2.value);
  if (!info) return '';
  if ('invalid' in info) return '请输入汉字';
  return `${info.strokes} 画${info.manual ? '（手动）' : ''}${info.fellBackToSimplified ? '（繁体缺省，按简体）' : ''}`;
});

function openManual(char: string, slot: number) {
  manualFor.value = { char, slot };
  manualValue.value = '';
}

function confirmManual() {
  const target = manualFor.value;
  if (!target) return;
  const v = Number(manualValue.value);
  if (!Number.isInteger(v) || v < 1 || v > 40) {
    toast('请输入 1–40 的笔画数');
    return;
  }
  manualStrokes[target.char] = v;
  manualFor.value = null;
  doCast();
}

/* ---------- 声音起卦 ---------- */

const sound = reactive({ c1: 0, c2: 0 });
function tap(which: 1 | 2) {
  const key = which === 1 ? 'c1' : 'c2';
  if (sound[key] < 999) sound[key] += 1;
}
function resetSound() {
  sound.c1 = 0;
  sound.c2 = 0;
}

/* ---------- 起卦 ---------- */

const busy = ref(false);

function buildCast(): CastResult | null {
  switch (method.value) {
    case 'TIME': {
      if (manual.enabled) {
        return castByTimeParts(currentYearBranchNo.value, manual.month, manual.day, manual.hourNo, {
          label: manualLabel.value,
        });
      }
      return castByTime(now.value, solarlunarProvider);
    }
    case 'NUMBER': {
      const v1 = Number(num1.value);
      if (!num1.value.trim()) {
        toast('请输入第一个数字');
        return null;
      }
      if (!Number.isInteger(v1) || v1 < 1) {
        toast('请输入 1 以上的数字');
        return null;
      }
      if (numMode.value === 'TWO') {
        if (!num2.value.trim()) {
          toast('请输入第二个数字');
          return null;
        }
        const v2 = Number(num2.value);
        if (!Number.isInteger(v2) || v2 < 1) {
          toast('请输入 1 以上的数字');
          return null;
        }
        return castByNumber(v1, v2);
      }
      return castByNumber(v1, null, hourNumber(now.value.getHours()));
    }
    case 'CHARACTER': {
      const c1 = char1.value.trim();
      if (!c1) {
        toast('请输入汉字');
        return null;
      }
      if (!isHanChar(c1)) {
        toast('请只输入汉字（字母、数字、标点会被忽略）');
        return null;
      }
      const s1 = strokeInfo(c1);
      if (!s1 || 'invalid' in s1) {
        toast(`「${c1}」未收录笔画，请手动输入`);
        openManual(c1, 1);
        return null;
      }
      if (charMode.value === 'ONE') {
        return castByCharacter({
          strokes: [s1.strokes],
          chars: [c1],
          standard: standard.value,
          hourNo: hourNumber(now.value.getHours()),
        });
      }
      const c2 = char2.value.trim();
      if (!c2) {
        toast('请输入第二个汉字');
        return null;
      }
      if (!isHanChar(c2)) {
        toast('请只输入汉字');
        return null;
      }
      const s2 = strokeInfo(c2);
      if (!s2 || 'invalid' in s2) {
        toast(`「${c2}」未收录笔画，请手动输入`);
        openManual(c2, 2);
        return null;
      }
      return castByCharacter({
        strokes: [s1.strokes, s2.strokes],
        chars: [c1, c2],
        standard: standard.value,
        second: now.value.getSeconds(),
      });
    }
    case 'SOUND': {
      if (sound.c1 < 1 || sound.c2 < 1) {
        toast('两组至少各点按 1 次');
        return null;
      }
      return castBySound(sound.c1, sound.c2);
    }
    default:
      return castByRandom();
  }
}

function doCast() {
  if (busy.value) return;
  busy.value = true;
  try {
    const cast = buildCast();
    if (!cast) return;
    setCurrentCast(cast, settings.tiYongRule);
    navigate('/result');
  } catch (e) {
    toast(e instanceof CastInputError ? e.message : `起卦失败：${(e as Error).message}`);
  } finally {
    busy.value = false;
  }
}

function doRandomCast() {
  const cast = castByRandom();
  setCurrentCast(cast, settings.tiYongRule);
  toast(`随机起卦：${castContext(cast)}`);
  navigate('/result');
}

/** 结果页顶部上下文预演（让用户在按按钮前就看到参数如何参与计算） */
const previewContext = computed(() => {
  if (manual.enabled) {
    const s1 = currentYearBranchNo.value + manual.month + manual.day;
    const s2 = s1 + manual.hourNo;
    return `上卦 (${currentYearBranchNo.value}＋${manual.month}＋${manual.day}) mod 8 = ${s1 % 8 === 0 ? 8 : s1 % 8}；下卦 (${s2}) mod 8 = ${s2 % 8 === 0 ? 8 : s2 % 8}；动爻 ${s2} mod 6 = ${s2 % 6 === 0 ? 6 : s2 % 6}`;
  }
  return '';
});
</script>

<template>
  <div class="cast">
    <SegControl
      v-model="method"
      :options="methodOptions"
      aria-label="起卦方式"
    />

    <!-- 时间 -->
    <section v-if="isTime" class="card panel">
      <h3 class="card-title">年月日时起卦 · 农历自动转换</h3>
      <div class="time-preview serif">
        <b>{{ timePreview.label }}</b>
        <span v-if="timePreview.shifted" class="shift-tag">晚子时 · 按次日计</span>
        <span class="clock mono">{{ timePreview.clock }}</span>
      </div>
      <p class="detail mono">{{ timePreview.detail }}</p>

      <label class="toggle">
        <input v-model="manual.enabled" type="checkbox" />
        <span>手动修正农历（当自动转换与实际不符时）</span>
      </label>

      <div v-if="manual.enabled" class="manual-grid">
        <div class="field">
          <label for="manual-month">农历月</label>
          <input id="manual-month" v-model.number="manual.month" type="number" min="1" max="12" />
        </div>
        <div class="field">
          <label for="manual-day">农历日</label>
          <input id="manual-day" v-model.number="manual.day" type="number" min="1" max="30" />
        </div>
        <div class="field">
          <label for="manual-hour">时辰</label>
          <select id="manual-hour" v-model.number="manual.hourNo">
            <option v-for="h in 12" :key="h" :value="h">{{ hourBranchName(h) }}时</option>
          </select>
        </div>
      </div>
      <p v-if="manual.enabled" class="detail mono">{{ previewContext }}</p>

      <p class="rule">
        上卦 =（年支＋月＋日）÷ 8 之余；下卦 = 再加时辰 ÷ 8 之余；动爻 = ÷ 6 之余（余 0 取 8 / 6）。
      </p>
    </section>

    <!-- 数字 -->
    <section v-else-if="isNumber" class="card panel">
      <h3 class="card-title">数字起卦</h3>
      <SegControl
        v-model="numMode"
        compact
        aria-label="数字起卦模式"
        :options="[
          { value: 'TWO', label: '报两个数字' },
          { value: 'ONE', label: '报一个数字' },
        ]"
      />
      <div class="two-fields">
        <div class="field">
          <label for="num-1">第一数（上卦）</label>
          <input
            id="num-1"
            v-model="num1"
            type="number"
            min="1"
            max="999999999"
            placeholder="如 3"
            inputmode="numeric"
          />
        </div>
        <div v-if="numMode === 'TWO'" class="field">
          <label for="num-2">第二数（下卦）</label>
          <input
            id="num-2"
            v-model="num2"
            type="number"
            min="1"
            max="999999999"
            placeholder="如 8"
            inputmode="numeric"
          />
        </div>
      </div>
      <p class="rule">
        <template v-if="numMode === 'TWO'">上 = 第一数 mod 8；下 = 第二数 mod 8；动 =（两数之和）mod 6。</template>
        <template v-else>上 = 该数 mod 8；下与动爻以（该数 ＋ 当前时辰序数）计算。</template>
        正整数，上限 999,999,999；0 视为无效输入。
      </p>
    </section>

    <!-- 汉字 -->
    <section v-else-if="isCharacter" class="card panel">
      <h3 class="card-title">汉字笔画起卦</h3>
      <SegControl
        v-model="charMode"
        compact
        aria-label="汉字起卦模式"
        :options="[
          { value: 'TWO', label: '两字起卦' },
          { value: 'ONE', label: '一字起卦' },
        ]"
      />
      <div class="two-fields">
        <div class="field">
          <label for="char-1">第一字（上卦）</label>
          <input id="char-1" v-model="char1" type="text" maxlength="2" placeholder="如 梅" />
          <span class="hint">{{ strokeHint1 }}</span>
        </div>
        <div v-if="charMode === 'TWO'" class="field">
          <label for="char-2">第二字（下卦）</label>
          <input id="char-2" v-model="char2" type="text" maxlength="2" placeholder="如 花" />
          <span class="hint">{{ strokeHint2 }}</span>
        </div>
      </div>

      <div v-if="manualFor" class="manual-box">
        「{{ manualFor.char }}」未收录笔画，请手动输入：
        <input
          v-model="manualValue"
          type="number"
          min="1"
          max="40"
          placeholder="1–40"
          aria-label="手动输入笔画数"
        />
        <button type="button" class="btn-ghost" @click="confirmManual">确定</button>
        <button type="button" class="btn-ghost" @click="manualFor = null">取消</button>
      </div>

      <p class="rule">
        两字：动爻 =（两字笔画和 ＋ 起卦秒数）÷ 6 之余（余 0 取 6）；一字：动爻 =（笔画总数 ＋ 时辰序数）÷ 6 之余。
        笔画标准：<b>{{ standardLabel }}</b>（设置中可切换，同一卦内必须统一）。
      </p>
    </section>

    <!-- 声音 -->
    <section v-else class="card panel">
      <h3 class="card-title">声音（点数）起卦</h3>
      <p class="rule">闻声逐次点按计数：第一组为上卦，第二组为下卦，两组之和除以 6 取动爻。</p>
      <div class="sound-grid">
        <div class="sound-box">
          <span class="tag">上卦组</span>
          <span class="cnt serif">{{ sound.c1 }}</span>
          <button type="button" class="sound-tap" @click="tap(1)">点 按</button>
        </div>
        <div class="sound-box">
          <span class="tag">下卦组</span>
          <span class="cnt serif">{{ sound.c2 }}</span>
          <button type="button" class="sound-tap" @click="tap(2)">点 按</button>
        </div>
      </div>
      <button type="button" class="btn-ghost block" @click="resetSound">归零</button>
    </section>

    <!-- 拇指热区内的主按钮（06 §一 原则 4） -->
    <div class="cast-actions">
      <button type="button" class="btn-main" :disabled="busy" @click="doCast">起 卦</button>
      <button type="button" class="random-btn" @click="doRandomCast">
        随机起卦（模拟外应 · P2）
      </button>
    </div>
  </div>
</template>

<style scoped>
.cast {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel {
  margin-bottom: 0;
}

.time-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 0 6px;
  text-align: center;
}

.time-preview b {
  font-size: var(--fs-lg);
  letter-spacing: 1px;
}

.time-preview .clock {
  font-size: var(--fs-xs);
}

.shift-tag {
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: var(--c-accent-soft);
  color: var(--c-accent);
  font-size: var(--fs-xs);
}

.detail {
  display: block;
  margin-top: 8px;
  text-align: center;
  line-height: 1.7;
}

.rule {
  margin-top: 12px;
  font-size: var(--fs-xs);
  line-height: 1.8;
  color: var(--c-muted);
}

.rule b {
  color: var(--c-accent);
}

.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  font-size: var(--fs-sm);
  color: var(--c-muted);
  cursor: pointer;
}

.toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--c-accent);
}

.manual-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.two-fields {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.two-fields .field {
  flex: 1;
  min-width: 0;
  margin-bottom: 0;
}

.manual-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--c-second);
  border-radius: var(--r-md);
  font-size: var(--fs-sm);
}

.manual-box input {
  width: 90px;
}

.sound-grid {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.sound-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 10px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  background: var(--c-surface);
}

.sound-box .cnt {
  font-size: 40px;
  line-height: 1.1;
  color: var(--c-accent);
}

.sound-tap {
  width: 100%;
  min-height: var(--tap-min);
  border: 0;
  border-radius: var(--r-md);
  background: var(--c-ink);
  color: var(--c-bg);
  font-size: var(--fs-md);
  letter-spacing: 4px;
}

.sound-tap:active {
  transform: scale(0.97);
}

.block {
  width: 100%;
  margin-top: 12px;
}

.cast-actions {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0 4px;
  background: linear-gradient(to top, var(--c-bg) 70%, transparent);
}

.random-btn {
  border: 0;
  background: none;
  color: var(--c-muted);
  font-size: var(--fs-xs);
  padding: 6px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.random-btn:hover {
  color: var(--c-accent);
}
</style>
