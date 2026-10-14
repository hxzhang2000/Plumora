<script setup lang="ts">
/**
 * 一键分享卡片 —— 把当前占得的结果绘成一张图，供社交分享。
 *
 * 纯 canvas 绘制（不依赖外部库）：卦画 + 卦名 + 体用 + 总断 + 一句话答案 + 起卦信息。
 * 版面几何全部由 `@/platform/shareLayout` 纯函数算出（可单测），本组件只负责
 * 「测量 → 画」与预览弹层。
 *
 * 2026-10-14 修排版（用户反馈「手机端和 PC 端格式都不对」）：
 *   - 根因：画布曾是固定 600×880，且用 inline style 把显示宽度写死 600px。
 *     窄屏（手机 ~390px）横向溢出、文字被两侧裁掉；矮窗口下 CSS 的 max-height
 *     只压高度不缩宽度，整张卡被纵向压扁；高度写死又让短答案留下大片空白。
 *   - 现在：高度按内容算，显示尺寸交给 CSS 按 `--share-ratio` 等比缩放并同时
 *     受视口宽高约束，手机 / PC 都不会溢出或变形。
 *
 * 2026-10-14 二改（分享真正可用 + 起卦信息）：
 *   - iOS Safari 对 `<a download>` + blob/data URL 会忽略 download、直接把图打开，
 *     等于存不进相册。现在优先走 `navigator.share({ files })` 弹系统分享面板
 *     （可直接发微信 / 存相册），不支持才降级到下载，最后才是「长按保存」。
 *   - 卡片补一行起卦信息（方式 · 农历时间），分享出去更有记录感。
 */
import { computed, nextTick, ref, watch } from 'vue';
import { interpret } from '@plumora/core';
import type { ResolvedHexagram } from '@plumora/core';
import { useDialog } from '@/platform/useDialog';
import {
  cleanFontStack,
  computeShareLayout,
  shareFonts,
  type Measure,
  type ShareFonts,
  type ShareLayout,
} from '@/platform/shareLayout';

const props = defineProps<{
  resolved: ResolvedHexagram;
  question?: string;
  /** 起卦上下文（起卦方式 · 农历时间），来自结果页；为空则不画该行 */
  context?: string;
}>();

const INK = '#2a2622';
const ACCENT = '#b23b2e';
const PAPER = '#fbf7ef';
const MUTED = '#7a6f63';
const FAINT = '#a99c8c';

const show = ref(false);
const canvasRef = ref<HTMLCanvasElement | null>(null);

/** 六爻自下而上 → 自上而下 */
function topDown(lines: readonly number[]): readonly number[] {
  return lines.slice().reverse();
}

function trigramName(n: number): string {
  const names = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
  return names[n - 1] ?? String(n);
}

/** 从页面 CSS 变量取真实字体栈，保证卡片与界面同款字体 */
function resolveFonts(): ShareFonts {
  const cs = getComputedStyle(document.documentElement);
  return shareFonts(
    cleanFontStack(cs.getPropertyValue('--font-sans'), 'sans-serif'),
    cleanFontStack(cs.getPropertyValue('--font-serif'), 'serif'),
  );
}

/** 圆角矩形路径（roundRect 不可用时退化为直角） */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function draw(): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const r = props.resolved;
  const out = interpret(r, props.question ?? '');
  const fonts = resolveFonts();

  // 先用一块离屏画布测量（字体串与正式绘制完全一致）
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return;
  const measure: Measure = (text, font) => {
    probe.font = font;
    return probe.measureText(text).width;
  };

  const L: ShareLayout = computeShareLayout(measure, fonts, {
    answer: out.answer,
    headline: out.headline,
    meta: props.context ?? '',
  });

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(L.width * dpr);
  canvas.height = Math.round(L.height * dpr);
  canvas.style.setProperty('--share-ratio', String(L.ratio));
  canvas.setAttribute('aria-label', `分享卡片：${r.ben.name}`);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, L.width, L.height);
  ctx.textBaseline = 'alphabetic';

  // 纸底 + 双线框
  roundRectPath(ctx, 0, 0, L.width, L.height, 18);
  ctx.fillStyle = PAPER;
  ctx.fill();

  roundRectPath(ctx, L.inset, L.inset, L.width - L.inset * 2, L.height - L.inset * 2, 12);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.stroke();

  roundRectPath(
    ctx,
    L.inset + 7,
    L.inset + 7,
    L.width - (L.inset + 7) * 2,
    L.height - (L.inset + 7) * 2,
    8,
  );
  ctx.strokeStyle = 'rgba(178, 59, 46, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 标题
  ctx.textAlign = 'center';
  ctx.font = fonts.title;
  ctx.letterSpacing = '2px';
  ctx.fillStyle = ACCENT;
  ctx.fillText('观梅 · PLUMORA 起卦', L.width / 2, L.titleY);
  ctx.letterSpacing = '0px';

  // 标题下的短装饰线
  ctx.strokeStyle = 'rgba(178, 59, 46, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L.width / 2 - 40, L.titleY + 14);
  ctx.lineTo(L.width / 2 + 40, L.titleY + 14);
  ctx.stroke();

  // 卦名
  ctx.font = fonts.name;
  ctx.fillStyle = INK;
  ctx.fillText(r.ben.name, L.width / 2, L.nameY);

  // 上下卦 + 动爻小字
  ctx.font = fonts.sub;
  ctx.fillStyle = MUTED;
  ctx.fillText(
    `${trigramName(r.upper)}上${trigramName(r.lower)}下 · 动爻 ${r.movingLineName}`,
    L.width / 2,
    L.subY,
  );

  // 卦画（本卦六爻，自上而下；动爻右侧朱砂点）
  const gx = (L.width - L.glyphW) / 2;
  const movingRow = 6 - r.moving;
  let gy = L.glyphTop;
  topDown(r.lines).forEach((v, i) => {
    ctx.fillStyle = INK;
    if (v === 1) {
      roundRectPath(ctx, gx, gy, L.glyphW, L.glyphRowH, 4);
      ctx.fill();
    } else {
      const seg = (L.glyphW - 16) / 2;
      roundRectPath(ctx, gx, gy, seg, L.glyphRowH, 4);
      ctx.fill();
      roundRectPath(ctx, gx + seg + 16, gy, seg, L.glyphRowH, 4);
      ctx.fill();
    }
    if (i === movingRow) {
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(gx + L.glyphW + 24, gy + L.glyphRowH / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    gy += L.glyphRowH + L.glyphGap;
  });

  // 体用（关系词已在下方总断里出现，此处只标两侧卦）
  ctx.textAlign = 'center';
  ctx.font = fonts.relation;
  ctx.fillStyle = INK;
  ctx.fillText(`体 ${trigramName(r.ti)} · 用 ${trigramName(r.yong)}`, L.width / 2, L.relationY);

  // 总断
  ctx.font = fonts.headline;
  ctx.fillStyle = ACCENT;
  L.headlineLines.forEach((line, i) => {
    ctx.fillText(line, L.width / 2, L.headlineY + i * L.headlineLineH);
  });

  // 一句话答案
  ctx.textAlign = 'left';
  ctx.font = fonts.answer;
  ctx.fillStyle = INK;
  L.answerLines.forEach((line, i) => {
    ctx.fillText(line, L.contentX, L.answerY + i * L.answerLineH);
  });

  // 起卦信息行（起卦方式 · 农历时间）—— 分享出去能看出「何时、以何法起卦」
  if (L.metaLines.length) {
    ctx.textAlign = 'center';
    ctx.font = fonts.meta;
    ctx.fillStyle = FAINT;
    L.metaLines.forEach((line, i) => {
      ctx.fillText(line, L.width / 2, L.metaY + i * L.metaLineH);
    });
  }

  // 落款
  ctx.textAlign = 'center';
  ctx.font = fonts.footer;
  ctx.fillStyle = FAINT;
  ctx.fillText('梅花易数 · 体用生克 · 事在人为', L.width / 2, L.footerY);
}

const fileName = computed(() => `观梅_${props.resolved.ben.name}.png`);

/**
 * 是否支持「带文件的系统分享」——iOS Safari 15+ / Android Chrome 支持。
 * 支持时必须优先走它：iOS 对 `<a download>` + blob:/data: URL 会忽略 download
 * 直接把图打开，用户根本存不进相册（这是上一版只能挂「长按保存」提示的原因）。
 */
function canShareFile(file: File): boolean {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

const shareSupported = computed(() => typeof navigator?.share === 'function');

/** 画布 → PNG Blob（toBlob 缺失时退回 data URL 解包，测试环境也能跑） */
function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((b) => resolve(b), 'image/png');
      return;
    }
    try {
      const url = canvas.toDataURL('image/png');
      const bin = atob(url.slice(url.indexOf(',') + 1));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      resolve(new Blob([bytes], { type: 'image/png' }));
    } catch {
      resolve(null);
    }
  });
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 交给浏览器把文件读完再回收，太快 revoke 会让下载中断
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** 保存图片：系统分享面板 → 下载 → （实在不行）页面上的「长按保存」提示 */
async function saveImage(): Promise<void> {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const blob = await canvasBlob(canvas);
  if (!blob) return;
  const name = fileName.value;

  if (typeof File === 'function') {
    const file = new File([blob], name, { type: 'image/png' });
    if (canShareFile(file)) {
      try {
        await navigator.share({ files: [file] });
        return; // 系统面板已接管：发微信 / 存相册 / 隔空投送都走它
      } catch (e) {
        // 用户主动取消：什么都不做，也不要再弹一次下载
        if ((e as DOMException | undefined)?.name === 'AbortError') return;
        // 其它失败（如 NotAllowedError：非用户手势触发）继续降级到下载
      }
    }
  }

  downloadBlob(blob, name);
}

/* 预览弹层：Esc / 焦点陷阱 / 焦点回收 / 背景滚动锁统一走 useDialog。
   画布本身不可聚焦，弹层里有两颗按钮 —— 没有焦点陷阱时 Tab 会跑到
   遮罩背后的结果页上（视觉上盖着、键盘却已经在后面）。 */
const modalEl = ref<HTMLElement | null>(null);
useDialog({
  open: () => show.value,
  close: () => {
    show.value = false;
  },
  root: modalEl,
});

/** 打开预览：绘制交给下面的 watch（等 DOM 挂上后再画，canvasRef 才拿得到） */
function openCard(): void {
  show.value = true;
}

/**
 * 需要重绘的两种情况：
 *   ① 预览刚打开（要等 DOM 挂上，canvasRef 才拿得到）；
 *   ② **同一实例换了另一盘** —— 本组件被结果页复用（`v-for`/key 不变），
 *      弹层开着的时候卦象被换成别的（例如地址栏粘进一条分享链接），
 *      不跟着重画就会留着一张写着上一卦的旧图。
 */
watch([show, () => props.resolved], ([open]) => {
  if (!open) return;
  void nextTick(() => draw());
});
</script>

<template>
  <div class="share">
    <button type="button" class="share-btn" @click="openCard">生成分享卡片</button>

    <div v-if="show" class="share-mask" @click.self="show = false">
      <div
        ref="modalEl"
        class="share-modal"
        role="dialog"
        aria-modal="true"
        aria-label="分享卡片预览"
        tabindex="-1"
      >
        <div class="share-stage">
          <canvas ref="canvasRef" class="share-canvas" />
        </div>
        <p class="share-hint">
          {{ shareSupported ? '点「分享」可直接发送微信 / 存相册' : '长按图片可保存到相册' }}
        </p>
        <div class="share-actions">
          <button type="button" class="share-primary" @click="saveImage">
            {{ shareSupported ? '分享 / 保存' : '保存图片' }}
          </button>
          <button type="button" class="share-ghost" @click="show = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-btn {
  margin-top: 12px;
  padding: 9px 16px;
  border: 1px solid var(--c-accent);
  border-radius: var(--r-md);
  background: var(--c-bg);
  color: var(--c-accent);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.share-btn:hover {
  background: var(--c-accent-soft);
}

.share-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}

.share-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  max-height: 100%;
}

/* 弹层自身是初始焦点落点（tabindex="-1"），不该画出焦点圈 */
.share-modal:focus {
  outline: none;
}

/* 卡片显示区：阴影与圆角落在容器上，避免 overflow 裁掉画布自身的阴影；
   极端窄高窗口里允许滚动，不至于把卡片压得看不清 */
.share-stage {
  max-width: 100%;
  max-height: calc(92vh - 104px);
  overflow: auto;
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

/* 关键：宽高都由 CSS 按 --share-ratio（JS 写入）等比算出，同时不吃掉视口 */
.share-canvas {
  display: block;
  width: min(600px, 88vw, max(260px, (92vh - 104px) * var(--share-ratio, 0.77)));
  height: auto;
  border-radius: 18px;
}

.share-hint {
  display: none;
  margin: 0;
  color: rgba(255, 255, 255, 0.85);
  font-size: var(--fs-xs);
}

/* 触屏设备才提示长按保存（桌面端 download 直接可用） */
@media (hover: none) and (pointer: coarse) {
  .share-hint {
    display: block;
  }
}

.share-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

/* 注：这里**不能**复用全局设计系统的 .btn-main / .btn-ghost ——
   它们是「全宽主操作按钮」（width:100%、letter-spacing:.35em、text-indent:.35em、
   var(--font-serif)），局部样式只覆盖了一部分属性，残留的 width:100% / 字距
   会把按钮撑得忽宽忽窄，窄屏下「关闭」二字被压成竖排。故本组件用独立类名。 */
.share-primary,
.share-ghost {
  flex: 0 0 auto;
  min-height: 40px;
  padding: 9px 22px;
  border-radius: var(--r-md);
  font-size: var(--fs-sm);
  line-height: 1.35;
  white-space: nowrap;
  cursor: pointer;
}

.share-primary {
  border: 0;
  background: var(--c-accent);
  color: #fff;
  font-weight: 600;
}

.share-primary:hover {
  filter: brightness(1.06);
}

.share-primary:active {
  transform: translateY(1px);
}

.share-ghost {
  border: 1px solid var(--c-line);
  background: var(--c-bg);
  color: var(--c-ink);
}

.share-ghost:hover {
  background: var(--c-accent-soft);
}
</style>
