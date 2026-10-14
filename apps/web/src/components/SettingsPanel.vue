<script setup lang="ts">
/** 设置面板 —— 06 §二「设置（右上角图标入口，非 Tab）」+ FR-10 设置项 */
import { computed, onMounted, ref, watch } from 'vue';
import { methodCn as methodCnOf, TIME_PRECISION_CN, VERIFY_STATUS_CN, lineName, type HexagramRecord, type TimePrecision } from '@plumora/core';
import { getHexagramByCode } from '@plumora/knowledge';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import ImportDialog from '@/components/ImportDialog.vue';
import SegControl from '@/components/SegControl.vue';
import { useDialog } from '@/platform/useDialog';
import { APP_NAME, APP_STAGE, APP_VERSION_LABEL } from '@/generated/version';

// 纯字标（public/mark.svg）。用运行时相对 URL，理由同 App.vue 的 brandMark：
// 静态 src 会被 Vite 当模块解析，且 base 为 './' 时只有相对 URL 才能适配子目录部署。
const aboutMark = './mark.svg';
import {
  clearRecords,
  downloadFile,
  enforceRecordLimit,
  exportFilename,
  ImportError,
  insertRecords,
  listRecords,
  parseExportBundle,
  restoreRecords,
  toCsv,
  toExportBundle,
  type ImportOutcome,
} from '@/platform/records';
import type { ThemeMode } from '@/platform/settings';
import { openQr } from '@/stores/qrDialog';
import { updateSetting, useSettings } from '@/stores/settings';
import { toast } from '@/stores/toast';
import { refreshRecords } from '@/stores/records';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const settings = useSettings();
const confirmClear = ref(false);
/* 二维码弹窗不在本组件里：开关走 stores/qrDialog 的共享状态，
   弹窗本体只在 App.vue 渲染一份（顶栏/侧栏图标与这里共用同一份）。 */

const strokeOptions = [
  { value: 'SIMPLIFIED' as const, label: '简体' },
  { value: 'TRADITIONAL' as const, label: '繁体' },
];

const methodOptions = [
  { value: 'TIME' as const, label: '时间' },
  { value: 'NUMBER' as const, label: '数字' },
  { value: 'CHARACTER' as const, label: '汉字' },
];

const tiYongOptions = [
  { value: 'MOVING_LINE' as const, label: '动爻所在为用（通行）' },
  { value: 'UPPER_YONG_LOWER_TI' as const, label: '上卦恒为用（笔记流派）' },
];

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'LIGHT', label: '浅色' },
  { value: 'DARK', label: '深色' },
  { value: 'SYSTEM', label: '跟随系统' },
];

/** 时间起卦精度（03 文档 §6.6）—— 由 core 的 TIME_PRECISION_CN 派生，避免两处口径漂移 */
const timePrecisionOptions: { value: TimePrecision; label: string }[] = (
  Object.keys(TIME_PRECISION_CN) as TimePrecision[]
).map((v) => ({ value: v, label: TIME_PRECISION_CN[v] }));

const bilOptions = [
  { value: 'on' as const, label: '开' },
  { value: 'off' as const, label: '关' },
];

/** 布尔设置通过 on/off 字符串桥接到字符串型 SegControl */
const bilValue = computed({
  get: () => (settings.showBilingual ? 'on' : 'off') as 'on' | 'off',
  set: (v: 'on' | 'off') => updateSetting('showBilingual', v === 'on'),
});

/** 字号滑块：实时预览、即时生效；范围 0.8–1.5（80%–150%），默认 1 = 100% */
const fontScaleLabel = computed(() => `${Math.round(settings.fontScale * 100)}%`);

/** 一键归位到默认字号（100%） */
function resetFontScale() {
  updateSetting('fontScale', 1);
}

const limitOptions = [
  { value: '0' as const, label: '不限制' },
  { value: '500' as const, label: '500 条' },
  { value: '1000' as const, label: '1000 条' },
];

const limitValue = computed({
  get: () => String(settings.recordLimit) as '0' | '500' | '1000',
  set: (v) => {
    updateSetting('recordLimit', Number(v) as 0 | 500 | 1000);
    void applyLimit();
  },
});

async function applyLimit() {
  const removed = await enforceRecordLimit(settings.recordLimit);
  if (removed > 0) {
    toast(`已按上限清理 ${removed} 条最旧卦例`);
    await refreshRecords();
  }
}

/* ---------- 导出 ---------- */

const hexName = (code: string) => getHexagramByCode(code)?.name ?? code;

const csvLookup = {
  hexName,
  lineName: (r: HexagramRecord) => {
    const h = getHexagramByCode(r.benGuaCode);
    const yang = h ? ((h.binary >> (r.movingLine - 1)) & 1) === 1 : false;
    return lineName(r.movingLine, yang);
  },
  tiYong: (r: HexagramRecord) => `体${r.tiTrigram}用${r.yongTrigram}`,
  methodCn: (r: HexagramRecord) => methodCnOf(r.method),
  verifyCn: (r: HexagramRecord) => VERIFY_STATUS_CN[r.verifyStatus],
};

async function exportJson() {
  const records = await listRecords();
  if (!records.length) return toast('暂无卦例可导出');
  downloadFile(
    exportFilename('json'),
    JSON.stringify(toExportBundle(records), null, 2),
    'application/json',
  );
  toast(`已导出 ${records.length} 条卦例（JSON）`);
}

async function exportCsv() {
  const records = await listRecords();
  if (!records.length) return toast('暂无卦例可导出');
  downloadFile(exportFilename('csv'), toCsv(records, csvLookup), 'text/csv');
  toast(`已导出 ${records.length} 条卦例（CSV）`);
}

async function doClear() {
  confirmClear.value = false;
  // 清空前留底：这是最不可逆的破坏性操作，务必给一条撤销后路
  const snapshot = await listRecords();
  await clearRecords();
  await refreshRecords();
  if (!snapshot.length) {
    toast('已清空全部卦例');
    return;
  }
  toast(
    `已清空 ${snapshot.length} 条卦例`,
    { label: '撤销', run: () => void undoClear(snapshot) },
    6000,
  );
}

/** 撤销清空：原样回写全部记录（保留 id 与时间） */
async function undoClear(snapshot: readonly HexagramRecord[]) {
  try {
    await restoreRecords(snapshot);
  } catch (err) {
    toast(`撤销失败：${(err as Error).message}`);
    return;
  }
  await refreshRecords();
  toast(`已恢复 ${snapshot.length} 条卦例`);
}

/* ---------- 导入（导出文件的反向还原） ---------- */

/** 待确认的导入结果：文件选好、解析通过后暂存，等用户在对话框选合并/覆盖 */
const importState = ref<{
  fileName: string;
  outcome: ImportOutcome;
  total: number;
  existing: number;
} | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const importBusy = ref(false);

function pickImportFile() {
  fileInput.value?.click();
}

async function onImportFile(e: Event) {
  const el = e.target as HTMLInputElement;
  const file = el.files?.[0];
  // 无论成败都清空，保证同一文件可再次选中（否则 change 不触发）
  el.value = '';
  if (!file) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    toast('导入失败：文件不是合法 JSON');
    return;
  }

  let outcome: ImportOutcome;
  try {
    outcome = parseExportBundle(parsed);
  } catch (err) {
    toast(
      err instanceof ImportError ? `导入失败：${err.message}` : `导入失败：${(err as Error).message}`,
    );
    return;
  }

  if (!outcome.accepted.length) {
    toast(
      outcome.rejected.length
        ? `文件中的 ${outcome.rejected.length} 条记录均无有效卦象，未导入`
        : '文件中没有可导入的卦例',
    );
    return;
  }

  const existing = (await listRecords()).length;
  importState.value = {
    fileName: file.name,
    outcome,
    total: outcome.accepted.length + outcome.rejected.length,
    existing,
  };
}

async function runImport(replace: boolean) {
  const s = importState.value;
  if (!s || importBusy.value) return;
  importBusy.value = true;
  try {
    const n = await insertRecords(s.outcome.accepted, replace);
    await refreshRecords();
    const skipped = s.outcome.rejected.length;
    const tail = skipped ? `，跳过 ${skipped} 条` : '';
    toast(replace ? `已覆盖导入 ${n} 条卦例${tail}` : `已合并导入 ${n} 条卦例${tail}`);
  } catch (err) {
    toast(`导入失败：${(err as Error).message}`);
  } finally {
    importBusy.value = false;
    importState.value = null;
  }
}

/**
 * 关闭态必须真正「不可达」（审查 W-7）。
 *
 * 原实现只用 transform: translateX(102%) 把面板挪出视口——控件仍留在 Tab 序
 * 与无障碍树里，键盘用户从起卦页一路 Tab 会「消失」到屏幕外，并且能聚焦到
 * 「清空全部卦例」这类不可逆按钮。CSS 侧用 visibility 兜底，这里再补
 * inert（连点击/聚焦一起屏蔽）与 aria-hidden（对屏幕阅读器隐藏）。
 *
 * 另外补上 useDialog 的通用行为：Esc 关闭、焦点陷阱（Tab 不跑出抽屉）、
 * 关闭后焦点回到「设置」入口、背景滚动锁。面板是抽屉形态，与遮罩同开同关，
 * 这些行为与普通弹窗一致。
 */
const panelEl = ref<HTMLElement | null>(null);

function syncPanelA11y(open: boolean) {
  const el = panelEl.value;
  if (!el) return;
  if (open) {
    el.removeAttribute('inert');
    el.removeAttribute('aria-hidden');
  } else {
    el.setAttribute('inert', '');
    el.setAttribute('aria-hidden', 'true');
  }
}

useDialog({
  open: () => props.open,
  close: () => emit('close'),
  root: panelEl,
});

watch(
  () => props.open,
  (v) => syncPanelA11y(v),
);

// 挂载时同步一次：面板是「首次打开才挂载」的懒加载组件，
// 挂载那一刻 props.open 往往已经是 true，上面的 watch 不会再触发。
onMounted(() => syncPanelA11y(props.open));
</script>

<template>
  <!--
    弹层宿主是 #app 而不是 body：非预览态两者等价（#app 无 transform，
    position: fixed 照旧相对视口）；手机框预览态下 #app 带 transform，
    成了这些 fixed 元素的包含块，遮罩与抽屉才会被机身屏幕裁住、不溢出到舞台。
    #app 是 index.html 里的静态节点，挂载时一定找得到（同级目标不行：
    Vue 会先把子树建完再把根插入文档，选择器那时还查不到）。
  -->
  <Teleport to="#app">
    <div class="mask" :class="{ open }" @click="emit('close')" />
    <aside ref="panelEl" class="panel" :class="{ open }" aria-label="设置" tabindex="-1">
      <header class="panel-head">
        <h2 class="serif">设置</h2>
        <button type="button" class="icon-btn" aria-label="关闭设置" @click="emit('close')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>

      <div class="panel-body scroll-area">
        <section class="group">
          <span class="group-label">笔画标准（汉字起卦）</span>
          <SegControl
            v-model="settings.strokeStandard"
            :options="strokeOptions"
            compact
            aria-label="笔画标准"
          />
        </section>

        <section class="group">
          <span class="group-label">默认起卦方式</span>
          <SegControl
            v-model="settings.defaultCastMethod"
            :options="methodOptions"
            compact
            aria-label="默认起卦方式"
          />
        </section>

        <section class="group">
          <span class="group-label">体用判定规则</span>
          <SegControl
            v-model="settings.tiYongRule"
            :options="tiYongOptions"
            compact
            aria-label="体用判定规则"
          />
          <p class="note">
            通行规则：动爻所在之卦为用卦；笔记流派：上卦恒为用、下卦恒为体。
          </p>
        </section>

        <section class="group">
          <span class="group-label">主题</span>
          <SegControl v-model="settings.theme" :options="themeOptions" compact aria-label="主题" />
        </section>

        <section class="group">
          <span class="group-label">卦名双语（拼音 / 英文）</span>
          <SegControl v-model="bilValue" :options="bilOptions" compact aria-label="卦名双语显示" />
          <p class="note">
            开启后，卦名与八卦名旁会显示拼音与英文（Wilhelm/Baynes 通行译名），仅作学习参考，不参与断卦。
          </p>
        </section>

        <section class="group">
          <span class="group-label">字号大小</span>
          <div class="slider-row">
            <span class="fs-end" aria-hidden="true">小</span>
            <input
              type="range"
              class="fs-slider"
              min="0.8"
              max="1.5"
              step="0.05"
              v-model.number="settings.fontScale"
              aria-label="字号大小"
              :aria-valuetext="fontScaleLabel"
            />
            <span class="fs-end" aria-hidden="true">大</span>
            <span class="fs-value" aria-live="polite">{{ fontScaleLabel }}</span>
          </div>
          <div class="slider-actions">
            <button type="button" class="btn-ghost btn-reset" @click="resetFontScale">重置默认</button>
          </div>
          <p class="note">拖动调整全局字号（80%–150%），实时预览、即时生效，设置会保存在本机。</p>
        </section>

        <section class="group">
          <span class="group-label">时间起卦精度</span>
          <SegControl
            v-model="settings.timePrecision"
            :options="timePrecisionOptions"
            compact
            aria-label="时间起卦精度"
          />
          <p class="note">
            传统时辰只精确到两小时一档，同一时辰内反复起卦结果完全相同。选「时辰 +
            分钟」或「时辰 + 分 + 秒」可让动爻随时刻变化。<b>仅影响动爻</b>，上卦 /
            下卦不变；切回「传统时辰」即可按 03 文档公式手算复核。
          </p>
        </section>

        <section class="group">
          <span class="group-label">保留记录上限</span>
          <SegControl
            v-model="limitValue"
            :options="limitOptions"
            compact
            aria-label="保留记录上限"
          />
          <p class="note">超出上限时自动清理最旧的卦例，清理后不可恢复。</p>
        </section>

        <hr class="divider" />

        <section class="group">
          <span class="group-label">数据</span>
          <div class="btn-row">
            <button type="button" class="btn-ghost" @click="exportJson">导出 JSON</button>
            <button type="button" class="btn-ghost" @click="exportCsv">导出 CSV</button>
          </div>
          <div class="btn-row">
            <button type="button" class="btn-ghost" :disabled="importBusy" @click="pickImportFile">
              导入 JSON
            </button>
          </div>
          <input
            ref="fileInput"
            class="file-input"
            type="file"
            accept="application/json,.json"
            @change="onImportFile"
          />
          <p class="note">
            导出的 JSON 备份可在本机或换机后导入。导入时可选「合并」（追加）或「覆盖」（先清空再写入）。
          </p>
          <button type="button" class="btn-ghost btn-danger block" @click="confirmClear = true">
            清空全部卦例
          </button>
        </section>

        <section class="group">
          <span class="group-label">跨设备</span>
          <button type="button" class="btn-ghost block" @click="openQr">
            <span class="qr-btn">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 4h6v6H4zM6 6h2v2H6zM14 4h6v6h-6zM16 6h2v2h-2zM4 14h6v6H4zM6 16h2v2H6z" />
                <path d="M14 14h2v2h-2zM16 16h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
              </svg>
              <span>手机扫码打开本页</span>
            </span>
          </button>
          <p class="note">生成当前页面的二维码（含当前路由），手机扫一扫即可在同一页继续。</p>
        </section>

        <hr class="divider" />

        <section class="about">
          <img class="about-mark" :src="aboutMark" alt="" aria-hidden="true" />
          <p class="brand-line serif">{{ APP_NAME }}</p>
          <p>梅花易数起卦排盘工具 · Web 端 {{ APP_VERSION_LABEL }}（{{ APP_STAGE }}）</p>
          <p>名取邵雍「观梅占」典故 —— 观物取象，以象占断。</p>
          <p class="privacy">
            隐私说明：所有卦例与设置仅保存在本机浏览器中，应用不含任何统计或广告组件，也不会向外部发送数据。
          </p>
          <p class="declare">本应用仅供传统文化学习与研究使用。</p>
        </section>
      </div>
    </aside>
  </Teleport>

  <!-- 二维码弹窗上移到 App.vue（与顶栏/侧栏的扫码图标共用 stores/qrDialog 状态） -->

  <ConfirmDialog
    :open="confirmClear"
    title="清空全部卦例"
    message="将删除本机保存的所有卦例。删除后数秒内可点底部提示条的「撤销」恢复；错过则无法找回（建议先导出 JSON 备份）。"
    confirm-text="确认清空"
    danger
    @cancel="confirmClear = false"
    @confirm="doClear"
  />

  <ImportDialog
    :open="importState !== null"
    :file-name="importState?.fileName ?? ''"
    :total="importState?.total ?? 0"
    :accepted="importState?.outcome.accepted.length ?? 0"
    :rejected="importState?.outcome.rejected ?? []"
    :existing="importState?.existing ?? 0"
    @cancel="importState = null"
    @merge="runImport(false)"
    @overwrite="runImport(true)"
  />
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: var(--c-scrim);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur);
}

.mask.open {
  opacity: 1;
  pointer-events: auto;
}

.panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 71;
  display: flex;
  flex-direction: column;
  width: min(420px, 92vw);
  background: var(--c-bg);
  border-left: 1px solid var(--c-line);
  transform: translateX(102%);
  /* 关闭态真正不可达（审查 W-7）：只靠 translateX 移出视口的话，控件仍在 Tab 序里。
     visibility 的 transition 只为把「隐藏」推迟到滑出动画结束，避免看到面板消失的过程。 */
  visibility: hidden;
  transition: transform var(--dur) var(--ease), visibility 0s linear var(--dur);
}

.panel.open {
  transform: none;
  visibility: visible;
  transition: transform var(--dur) var(--ease), visibility 0s;
}

/* tabindex="-1" 只为承载打开时的程序化焦点（useDialog），不参与 Tab 序 */
.panel:focus {
  outline: none;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 12px;
  flex: none;
}

.panel-head h2 {
  font-size: var(--fs-lg);
  letter-spacing: 2px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--c-line);
  border-radius: 50%;
  background: var(--c-surface);
  color: var(--c-ink);
}

.icon-btn svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.panel-body {
  flex: 1;
  min-height: 0;
  padding: 0 20px 32px;
}

.group {
  margin-bottom: 20px;
}

.group > .group-label {
  display: block;
  margin-bottom: 8px;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.note {
  margin-top: 8px;
  font-size: var(--fs-xs);
  line-height: 1.7;
  color: var(--c-muted);
}

/* ---------- 字号滑块 ---------- */

.slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fs-end {
  flex: none;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.slider-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn-reset {
  padding: 5px 12px;
  font-size: var(--fs-xs);
}

.fs-slider {
  flex: 1;
  min-width: 0;
  height: var(--tap-min);
  /* accent-color 让轨道与滑块统一用朱砂强调色，跨浏览器最简方案 */
  accent-color: var(--c-accent);
  cursor: pointer;
}

.fs-slider:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 3px;
  border-radius: var(--r-pill);
}

.fs-value {
  flex: none;
  min-width: 3.5em;
  text-align: right;
  font-size: var(--fs-md);
  font-variant-numeric: tabular-nums;
  color: var(--c-text);
}

.btn-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.btn-row > * {
  flex: 1;
}

/* 原生 file input 仅作触发器：真正的入口是上面的「导入 JSON」按钮 */
.file-input {
  display: none;
}

.block {
  width: 100%;
}

.qr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.qr-btn svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
  stroke: none;
}

.about p {
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--c-muted);
}

/* 关于区展示「纯字标」：朱文竖排篆书「观梅」（public/mark.svg）。
   这里尺寸够大（84px），字形看得清；页头/侧栏用的是印章形态，小尺寸才立得住。 */
.about-mark {
  display: block;
  width: 84px;
  height: 84px;
  margin: 0 auto 10px;
}

/* 深色主题下朱砂 #b03a2e 与面板底色对比不足，提亮一档 */
[data-theme='dark'] .about-mark {
  filter: brightness(1.42) saturate(1.05);
}

.brand-line {
  font-size: var(--fs-base);
  color: var(--c-text);
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.privacy {
  margin-top: 10px;
}

.declare {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--c-line);
  color: var(--c-accent);
}
</style>
