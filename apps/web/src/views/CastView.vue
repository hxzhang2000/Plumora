<script setup lang="ts">
/**
 * 起卦页（首页）—— 06 文档 §3.1
 *
 * 方式选择器记忆「默认起卦方式」设置（FR-10）；
 * 三种方式各自的输入区 + 拇指热区内的「起卦」主按钮（06 §一 原则 4）。
 * 随机起卦不占方式选择器，走底部独立按钮（模拟「外应」，P2）。
 */
import { computed, onActivated, onDeactivated, onMounted, reactive, ref, watch } from 'vue';
import {
  CastInputError,
  castByCharacter,
  castByNumber,
  castByRandom,
  castByTime,
  castContext,
  hourBranchName,
  hourNumber,
  type CastResult,
  type CastMethod,
} from '@plumora/core';
import { isHanChar, lookupStrokes, type StrokeStandard } from '@plumora/knowledge';
import {
  isValidSolarDate,
  leapDays,
  leapMonth,
  lunar2solar,
  lunarAt,
  monthDays,
  solarlunarProvider,
} from '@plumora/lunar';
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
  if (isTime.value && timeSource.value === 'NOW') startTimer();
});
onActivated(() => {
  now.value = new Date();
  if (isTime.value && timeSource.value === 'NOW') startTimer();
});
onDeactivated(stopTimer);

/* ---------- 手动输入时间（公历 / 农历） ---------- */

/** 手动输入的年份范围（solarlunar 数据表范围，01 文档口径同为 1900–2100） */
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

/** 时间来源：默认当前时刻（01 PRD FR-01）；「公历 / 农历」即手动输入入口 */
type TimeSource = 'NOW' | 'SOLAR' | 'LUNAR';

const timeSourceOptions = [
  { value: 'NOW' as const, label: '当前时刻' },
  { value: 'SOLAR' as const, label: '公历' },
  { value: 'LUNAR' as const, label: '农历' },
];

const timeSource = ref<TimeSource>('NOW');
const isManualTime = computed(() => timeSource.value !== 'NOW');

/** 手动输入的原始值：保留字符串，才能区分「没填」与「填了非数字」（v-model.number 会把两者都变成 0） */
type Field = string | number;

const solarInput = reactive<{ y: Field; m: Field; d: Field; h: Field }>({
  y: 0,
  m: 0,
  d: 0,
  h: 0,
});
const lunarInput = reactive<{ y: Field; m: Field; d: Field; h: Field; leap: boolean }>({
  y: 0,
  m: 0,
  d: 0,
  h: 0,
  leap: false,
});

/** 农历月份的中文数字（第 1 月称「正月」；「闰」前缀统一由提示文案拼一次，避免「闰闰六月」） */
const CN_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 以当前时刻预填手动输入（农历页签预填当前农历，用户从今天改起） */
function prefillManualInputs() {
  const base = now.value;
  solarInput.y = base.getFullYear();
  solarInput.m = base.getMonth() + 1;
  solarInput.d = base.getDate();
  solarInput.h = base.getHours();
  const lu = lunarAt(base);
  lunarInput.y = lu ? lu.lYear : base.getFullYear();
  lunarInput.m = lu ? lu.lMonth : base.getMonth() + 1;
  lunarInput.d = lu ? lu.lDay : base.getDate();
  lunarInput.h = base.getHours();
  lunarInput.leap = false;
}
prefillManualInputs();

function isBlank(v: Field): boolean {
  return typeof v === 'string' && v.trim() === '';
}

/** 输入 → 整数；空串 / 非整数（含 12.5、abc）返回 null，交由调用方给提示 */
function intOf(v: Field): number | null {
  const n = typeof v === 'string' ? (v.trim() === '' ? NaN : Number(v)) : v;
  return Number.isInteger(n) ? n : null;
}

type Resolved = { ok: true; date: Date } | { ok: false; error: string };

function parseFour(raw: Field[]): { ok: true; v: [number, number, number, number] } | { ok: false; error: string } {
  if (raw.some(isBlank)) return { ok: false, error: '请填写完整的年月日时' };
  const [y, m, d, h] = raw.map(intOf);
  if (y === null || m === null || d === null || h === null) {
    return { ok: false, error: '年月日时须为整数' };
  }
  if (y < YEAR_MIN || y > YEAR_MAX) {
    return { ok: false, error: `请输入 ${YEAR_MIN}–${YEAR_MAX} 年之间的时间` };
  }
  if (h < 0 || h > 23) return { ok: false, error: '时须为 0–23 的整数' };
  return { ok: true, v: [y, m, d, h] };
}

/** 公历页签 → 起卦用 Date（校验通过后交 castByTime 统一处理晚子时与年支） */
function resolveSolar(): Resolved {
  const parsed = parseFour([solarInput.y, solarInput.m, solarInput.d, solarInput.h]);
  if (!parsed.ok) return parsed;
  const [y, m, d, h] = parsed.v;
  if (!isValidSolarDate(y, m, d)) {
    return { ok: false, error: '公历日期无效，请检查月与日（如 2 月没有 30 日）' };
  }
  return { ok: true, date: new Date(y, m - 1, d, h) };
}

/** 农历页签 → 起卦用 Date（先换算回公历，跨年 / 跨月 / 晚子时位移全部交给 castByTime） */
function resolveLunar(): Resolved {
  const parsed = parseFour([lunarInput.y, lunarInput.m, lunarInput.d, lunarInput.h]);
  if (!parsed.ok) return parsed;
  const [y, m, d, h] = parsed.v;
  if (m < 1 || m > 12) return { ok: false, error: '农历月须为 1–12 的整数' };
  const isLeap = lunarInput.leap && leapMonth(y) === m;
  const maxDay = isLeap ? leapDays(y) : monthDays(y, m);
  if (maxDay < 1 || d < 1 || d > maxDay) {
    return { ok: false, error: `农历日须为 1–${maxDay > 0 ? maxDay : 30} 的整数` };
  }
  const solar = lunar2solar(y, m, d, isLeap);
  if (!solar) return { ok: false, error: '农历日期无效，请检查年月日与闰月' };
  return { ok: true, date: new Date(solar.y, solar.m - 1, solar.d, h) };
}

function resolveManualTime(): Resolved {
  return timeSource.value === 'SOLAR' ? resolveSolar() : resolveLunar();
}

/** 该年是否恰有当前所选月份的闰月（决定闰月开关是否可用） */
const canLeap = computed(() => {
  const y = intOf(lunarInput.y);
  const m = intOf(lunarInput.m);
  // m 须落在 1–12：leapMonth 对「无闰月」返回 0，不排除的话 m=0 会被误判为可勾选
  return y !== null && m !== null && m >= 1 && m <= 12 && leapMonth(y) === m;
});

/** 年 / 月改动后若不再对应闰月，立刻取消勾选，避免「勾着却没生效」 */
watch(canLeap, (ok) => {
  if (!ok) lunarInput.leap = false;
});

const leapLabel = computed(() => {
  const m = intOf(lunarInput.m);
  return canLeap.value && m !== null ? `按闰${CN_MONTHS[m - 1]}月计` : '按闰月计';
});

/** 农历月字段提示：该年有闰月时明示是哪一个月 */
const lunarMonthHint = computed(() => {
  const y = intOf(lunarInput.y);
  const m = intOf(lunarInput.m);
  if (y === null || m === null || m < 1 || m > 12) return '';
  return leapMonth(y) === m ? `该年有闰${CN_MONTHS[m - 1]}月` : '';
});

/** 农历日字段提示：封顶天数（闰月与非闰月不同） */
const lunarDayHint = computed(() => {
  const y = intOf(lunarInput.y);
  const m = intOf(lunarInput.m);
  if (y === null || m === null || m < 1 || m > 12) return '';
  const max = lunarInput.leap && leapMonth(y) === m ? leapDays(y) : monthDays(y, m);
  return max > 0 ? `共 ${max} 天` : '';
});

/** 时字段提示：换算成时辰地支（23 点即子时，晚子时位移由 castByTime 处理） */
const hourHint = computed(() => {
  const h = intOf(timeSource.value === 'SOLAR' ? solarInput.h : lunarInput.h);
  if (h === null || h < 0 || h > 23) return '';
  return `${hourBranchName(hourNumber(h))}时`;
});

/** 农历页签的公历回显（让用户核对换算结果） */
const lunarEcho = computed(() => {
  const r = resolveLunar();
  return r.ok
    ? `${r.date.getFullYear()}-${pad2(r.date.getMonth() + 1)}-${pad2(r.date.getDate())}`
    : '';
});

/* ---------- 时间预演 ---------- */

const timePreview = computed(() => {
  const manual = isManualTime.value;
  if (manual) {
    const r = resolveManualTime();
    if (!r.ok) {
      return { valid: false, label: '时间待确认', shifted: false, clock: '', manual, error: r.error };
    }
    try {
      const cast = castByTime(r.date, solarlunarProvider);
      return {
        valid: true,
        label: cast.label,
        shifted: cast.params.shifted,
        clock: `${pad2(r.date.getHours())}:${pad2(r.date.getMinutes())}`,
        manual,
        error: '',
      };
    } catch {
      return {
        valid: false,
        label: '农历转换失败',
        shifted: false,
        clock: '',
        manual,
        error: `请输入 ${YEAR_MIN}–${YEAR_MAX} 年之间的时间`,
      };
    }
  }
  try {
    const cast = castByTime(now.value, solarlunarProvider);
    return {
      valid: true,
      label: cast.label,
      shifted: cast.params.shifted,
      clock: `${pad2(now.value.getHours())}:${pad2(now.value.getMinutes())}:${pad2(now.value.getSeconds())}`,
      manual,
      error: '',
    };
  } catch {
    return {
      valid: false,
      label: '农历转换失败',
      shifted: false,
      clock: '',
      manual,
      error: `请检查系统时间是否在 ${YEAR_MIN}–${YEAR_MAX} 年之间`,
    };
  }
});

/** 切到手动输入就停掉每秒刷新（预演不再依赖 now）；切回当前时刻再恢复 */
watch(timeSource, (src) => {
  if (src === 'NOW') {
    now.value = new Date();
    startTimer();
  } else {
    stopTimer();
  }
});

/* ---------- 数字起卦 ---------- */

/**
 * Vue 3 的 v-model 对 `type="number"` 输入框会自动把值转成 number（空串仍为 ''），
 * 所以这里和手动时间输入一样声明为 string | number，空判断走 isBlank()，
 * 不能直接 .trim()（number 上没有这个方法，会抛 "trim is not a function"）。
 */
const num1 = ref<Field>('');
const num2 = ref<Field>('');

/* ---------- 汉字起卦 ---------- */

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

/* ---------- 起卦 ---------- */

const busy = ref(false);

function buildCast(): CastResult | null {
  switch (method.value) {
    case 'TIME': {
      if (isManualTime.value) {
        const resolved = resolveManualTime();
        if (!resolved.ok) {
          toast(resolved.error);
          return null;
        }
        return castByTime(resolved.date, solarlunarProvider);
      }
      return castByTime(now.value, solarlunarProvider);
    }
    case 'NUMBER': {
      const v1 = Number(num1.value);
      if (isBlank(num1.value)) {
        toast('请输入第一个数字');
        return null;
      }
      if (!Number.isInteger(v1) || v1 < 1) {
        toast('请输入 1 以上的数字');
        return null;
      }
      if (isBlank(num2.value)) {
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
    case 'RANDOM':
      return castByRandom();
    default:
      // 不可达分支：CastMethod 上已穷尽。真走到这里说明设置里残留了已下线的方式
      // （如声音起卦），响亮失败好过静默返回 null —— 后者表现为「点了起卦没反应」。
      throw new CastInputError(`未知的起卦方式：${String(method.value)}`);
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
        <span class="time-meta">
          <span v-if="timePreview.manual" class="tag-pill manual">手动输入</span>
          <span v-if="timePreview.shifted" class="tag-pill shift">晚子时 · 按次日计</span>
          <span v-if="timePreview.clock" class="clock mono">{{ timePreview.clock }}</span>
        </span>
      </div>
      <p v-if="timePreview.error" class="preview-error" role="status">{{ timePreview.error }}</p>

      <!-- 时间来源：默认当前时刻；公历 / 农历即手动输入入口 -->
      <SegControl
        v-model="timeSource"
        :options="timeSourceOptions"
        compact
        aria-label="时间来源"
        class="time-source"
      />

      <!-- 手动输入 · 公历 -->
      <div v-if="timeSource === 'SOLAR'" class="time-inputs">
        <div class="time-grid">
          <div class="field">
            <label for="s-year">公历年</label>
            <input
              id="s-year"
              v-model="solarInput.y"
              type="number"
              inputmode="numeric"
              placeholder="1900"
            />
          </div>
          <div class="field">
            <label for="s-month">月</label>
            <input
              id="s-month"
              v-model="solarInput.m"
              type="number"
              min="1"
              max="12"
              inputmode="numeric"
              placeholder="1–12"
            />
          </div>
          <div class="field">
            <label for="s-day">日</label>
            <input
              id="s-day"
              v-model="solarInput.d"
              type="number"
              min="1"
              max="31"
              inputmode="numeric"
              placeholder="1–31"
            />
          </div>
          <div class="field">
            <label for="s-hour">时</label>
            <input
              id="s-hour"
              v-model="solarInput.h"
              type="number"
              min="0"
              max="23"
              inputmode="numeric"
              placeholder="0–23"
            />
            <span class="hint">{{ hourHint }}</span>
          </div>
        </div>
        <p class="input-note">年份限 1900–2100；公历自动换算农历与年支，23 点按晚子时（次日）计。</p>
      </div>

      <!-- 手动输入 · 农历 -->
      <div v-else-if="timeSource === 'LUNAR'" class="time-inputs">
        <div class="time-grid">
          <div class="field">
            <label for="l-year">农历年</label>
            <input
              id="l-year"
              v-model="lunarInput.y"
              type="number"
              inputmode="numeric"
              placeholder="1900"
            />
          </div>
          <div class="field">
            <label for="l-month">月</label>
            <input
              id="l-month"
              v-model="lunarInput.m"
              type="number"
              min="1"
              max="12"
              inputmode="numeric"
              placeholder="1–12"
            />
            <span class="hint">{{ lunarMonthHint }}</span>
          </div>
          <div class="field">
            <label for="l-day">日</label>
            <input
              id="l-day"
              v-model="lunarInput.d"
              type="number"
              min="1"
              max="30"
              inputmode="numeric"
              placeholder="1–30"
            />
            <span class="hint">{{ lunarDayHint }}</span>
          </div>
          <div class="field">
            <label for="l-hour">时</label>
            <input
              id="l-hour"
              v-model="lunarInput.h"
              type="number"
              min="0"
              max="23"
              inputmode="numeric"
              placeholder="0–23"
            />
            <span class="hint">{{ hourHint }}</span>
          </div>
        </div>
        <label v-if="canLeap" class="toggle leap">
          <input v-model="lunarInput.leap" type="checkbox" />
          <span>{{ leapLabel }}</span>
        </label>
        <p class="input-note">
          农历自动换算公历与年支；年份限 1900–2100。
          <span v-if="lunarEcho" class="mono echo">→ {{ lunarEcho }}</span>
        </p>
      </div>
    </section>

    <!-- 数字 -->
    <section v-else-if="isNumber" class="card panel">
      <h3 class="card-title">数字起卦</h3>
      <div class="two-fields">
        <div class="field">
          <label for="num-1">第一数</label>
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
        <div class="field">
          <label for="num-2">第二数</label>
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
        正整数，上限 999,999,999；0 视为无效输入。
      </p>
    </section>

    <!-- 汉字 -->
    <section v-else-if="isCharacter" class="card panel">
      <h3 class="card-title">汉字笔画起卦</h3>
      <div class="two-fields">
        <div class="field">
          <label for="char-1">第一字</label>
          <input id="char-1" v-model="char1" type="text" maxlength="2" placeholder="如 梅" />
          <span class="hint">{{ strokeHint1 }}</span>
        </div>
        <div class="field">
          <label for="char-2">第二字</label>
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
        笔画标准：<b>{{ standardLabel }}</b>（设置中可切换，同一卦内必须统一）。
      </p>
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

.time-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.time-preview .clock {
  font-size: var(--fs-xs);
}

/* 预演行下的输入错误提示（实时、不打断输入，与 toast 互补） */
.preview-error {
  margin-top: 6px;
  text-align: center;
  font-size: var(--fs-xs);
  line-height: 1.7;
  color: var(--c-accent);
}

.tag-pill {
  padding: 2px 8px;
  border-radius: var(--r-pill);
  font-size: var(--fs-xs);
}

.tag-pill.shift {
  background: var(--c-accent-soft);
  color: var(--c-accent);
}

.tag-pill.manual {
  background: var(--c-second-soft);
  color: var(--c-second);
}

.time-source {
  margin-top: 14px;
}

.time-inputs {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

/* 年份最宽、其余等宽；窄屏下保证「1900–2100」这类占位不被挤掉 */
.time-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr 1fr;
  gap: 8px;
}

.time-grid .field {
  margin-bottom: 0;
}

.time-grid input {
  padding: 10px 6px;
  font-size: var(--fs-sm);
  text-align: center;
}

.time-inputs .toggle {
  margin-top: 0;
}

.input-note {
  font-size: var(--fs-xs);
  line-height: 1.7;
  color: var(--c-muted);
}

.input-note .echo {
  margin-left: 4px;
  color: var(--c-ink);
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
