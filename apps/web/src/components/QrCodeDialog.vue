<script setup lang="ts">
/**
 * 二维码弹窗 —— 「手机扫码打开本页」
 *
 * 扫码得到的是**当前路由**的完整地址（含 hash），所以扫完落在同一页。
 *
 * 两个容易做错的地方：
 *   1. 直接用 location.href：用户在电脑上开的是 localhost，手机扫出来是它自己的
 *      localhost，打不开且看不出原因。地址选择逻辑在 platform/share.ts。
 *   2. 二维码跟随主题配色：浅色模块 + 深底色能被部分现代解码器识别，但失败率
 *      明显上升。这里固定白底深模块，不跟主题走。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { qrSvg } from '@/platform/qrcode';
import { copyText, shareTarget } from '@/platform/share';
import { toast } from '@/stores/toast';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

/** 打开时才重新算：路由 hash 可能已经变了 */
const target = ref(shareTarget());
const qr = computed(() => qrSvg(target.value.url));
const copied = ref(false);

const dialogEl = ref<HTMLElement | null>(null);

function onKey(e: KeyboardEvent) {
  if (!props.open) return;
  const root = dialogEl.value;
  const t = e.target as Node | null;
  if (!root || !t || !root.contains(t)) return;
  // 焦点在按钮上时 Enter 会合成 click，别再处理一次
  if (e.key === 'Enter' && t instanceof HTMLElement && t.closest('button')) return;
  if (e.key === 'Escape' || e.key === 'Enter') emit('close');
}

function syncBodyScroll(open: boolean) {
  document.body.style.overflow = open ? 'hidden' : '';
}

watch(
  () => props.open,
  async (v) => {
    syncBodyScroll(v);
    if (!v) return;
    target.value = shareTarget();
    copied.value = false;
    await nextTick();
    dialogEl.value?.focus();
  },
);

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  syncBodyScroll(false);
});

async function doCopy() {
  const ok = await copyText(target.value.url);
  copied.value = ok;
  toast(ok ? '已复制链接' : '复制失败，请手动选中上方地址复制');
}
</script>

<template>
  <!-- 宿主 #app：预览态下即机身屏幕（说明见 SettingsPanel.vue 同处） -->
  <Teleport to="#app">
    <Transition name="qr">
      <div v-if="open" class="mask" @click.self="emit('close')">
        <div
          ref="dialogEl"
          class="dialog"
          role="dialog"
          aria-modal="true"
          aria-label="在手机上打开本页"
          tabindex="-1"
        >
          <header class="head">
            <h3 class="serif">在手机上打开</h3>
            <button type="button" class="icon-btn" aria-label="关闭" @click="emit('close')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <!-- 白底 + 深色模块：二维码不跟随主题，见文件头第 2 点 -->
          <div class="qr-box">
            <svg
              class="qr"
              :viewBox="qr.viewBox"
              role="img"
              :aria-label="`扫码打开：${target.url}`"
            >
              <rect :width="qr.size" :height="qr.size" fill="#ffffff" />
              <path :d="qr.path" fill="#111111" />
            </svg>
          </div>

          <p class="url" dir="ltr">{{ target.url }}</p>

          <p v-if="target.note" class="note" :class="{ warn: !target.viaLan }">
            {{ target.note }}
          </p>
          <p v-else class="note">用手机相机或浏览器扫一扫，即可打开当前页面。</p>

          <div class="ops">
            <button type="button" class="btn-ghost" @click="doCopy">
              {{ copied ? '已复制' : '复制链接' }}
            </button>
            <button type="button" class="btn-ghost" @click="emit('close')">关闭</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--c-scrim);
}

.dialog {
  width: min(360px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 20px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-float);
}

/* tabindex="-1" 只为承载打开时的程序化焦点，不参与 Tab 序 */
.dialog:focus {
  outline: none;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.head h3 {
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

.qr-box {
  padding: 12px;
  border-radius: var(--r-md);
  background: #fff;
  border: 1px solid var(--c-line);
}

.qr {
  display: block;
  width: 100%;
  height: auto;
  /* 放大时保持模块边缘锐利（默认会做平滑，二维码会糊） */
  shape-rendering: crispEdges;
}

.url {
  margin-top: 14px;
  font-size: var(--fs-xs);
  line-height: 1.6;
  color: var(--c-muted);
  word-break: break-all;
  user-select: all;
}

.note {
  margin-top: 10px;
  font-size: var(--fs-xs);
  line-height: 1.7;
  color: var(--c-muted);
}

.note.warn {
  color: var(--c-accent);
}

.ops {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.ops > * {
  flex: 1;
}

.qr-enter-active,
.qr-leave-active {
  transition: opacity var(--dur);
}

.qr-enter-from,
.qr-leave-to {
  opacity: 0;
}
</style>
