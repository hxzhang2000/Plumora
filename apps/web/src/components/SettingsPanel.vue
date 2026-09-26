<script setup lang="ts">
/** 设置面板 —— 06 §二「设置（右上角图标入口，非 Tab）」+ FR-10 设置项 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { METHOD_CN, VERIFY_STATUS_CN, lineName, type HexagramRecord } from '@plumora/core';
import { getHexagramByCode } from '@plumora/knowledge';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import QrCodeDialog from '@/components/QrCodeDialog.vue';
import SegControl from '@/components/SegControl.vue';
import { APP_NAME, APP_STAGE, APP_VERSION_LABEL } from '@/generated/version';

// 纯字标（public/mark.svg）。用运行时相对 URL，理由同 App.vue 的 brandMark：
// 静态 src 会被 Vite 当模块解析，且 base 为 './' 时只有相对 URL 才能适配子目录部署。
const aboutMark = './mark.svg';
import {
  clearRecords,
  downloadFile,
  enforceRecordLimit,
  exportFilename,
  listRecords,
  toCsv,
  toExportBundle,
} from '@/platform/records';
import type { ThemeMode } from '@/platform/settings';
import { updateSetting, useSettings } from '@/stores/settings';
import { toast } from '@/stores/toast';
import { refreshRecords } from '@/stores/records';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const settings = useSettings();
const confirmClear = ref(false);
const qrOpen = ref(false);

const strokeOptions = [
  { value: 'SIMPLIFIED' as const, label: '简体' },
  { value: 'TRADITIONAL' as const, label: '繁体' },
];

const methodOptions = [
  { value: 'TIME' as const, label: '时间' },
  { value: 'NUMBER' as const, label: '数字' },
  { value: 'CHARACTER' as const, label: '汉字' },
  { value: 'SOUND' as const, label: '声音' },
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

const layoutOptions = [
  { value: 'AUTO' as const, label: '自动' },
  { value: 'DESKTOP' as const, label: '电脑' },
  { value: 'MOBILE' as const, label: '手机' },
];

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
  methodCn: (r: HexagramRecord) => METHOD_CN[r.method],
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
  await clearRecords();
  await refreshRecords();
  toast('已清空全部卦例');
}

/**
 * 关闭态必须真正「不可达」（审查 W-7）。
 *
 * 原实现只用 transform: translateX(102%) 把面板挪出视口——控件仍留在 Tab 序
 * 与无障碍树里，键盘用户从起卦页一路 Tab 会「消失」到屏幕外，并且能聚焦到
 * 「清空全部卦例」这类不可逆按钮。CSS 侧用 visibility 兜底，这里再补
 * inert（连点击/聚焦一起屏蔽）与 aria-hidden（对屏幕阅读器隐藏）。
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

watch(
  () => props.open,
  (v) => {
    document.body.style.overflow = v ? 'hidden' : '';
    syncPanelA11y(v);
  },
);

onMounted(() => syncPanelA11y(props.open));
onBeforeUnmount(() => {
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div class="mask" :class="{ open }" @click="emit('close')" />
    <aside ref="panelEl" class="panel" :class="{ open }" aria-label="设置">
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
          <span class="group-label">布局形态</span>
          <SegControl
            v-model="settings.layoutMode"
            :options="layoutOptions"
            compact
            aria-label="布局形态"
          />
          <p class="note">
            「自动」按视口宽度切换（≥ 900px 为电脑形态）；选「电脑」或「手机」则固定下来，不再随窗口宽度变化。顶栏与侧栏的切换按钮只在这两者之间互换，要回到「自动」请在此选择。
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
          <button type="button" class="btn-ghost btn-danger block" @click="confirmClear = true">
            清空全部卦例
          </button>
        </section>

        <section class="group">
          <span class="group-label">跨设备</span>
          <button type="button" class="btn-ghost block" @click="qrOpen = true">
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

  <QrCodeDialog :open="qrOpen" @close="qrOpen = false" />

  <ConfirmDialog
    :open="confirmClear"
    title="清空全部卦例"
    message="将删除本机保存的所有卦例，且无法恢复。确定继续吗？"
    confirm-text="确认清空"
    danger
    @cancel="confirmClear = false"
    @confirm="doClear"
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

.btn-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.btn-row > * {
  flex: 1;
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
