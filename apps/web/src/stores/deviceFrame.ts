/* ============================================================
 * 手机框预览状态（响应式单例）—— 写入 <html data-device> 与 --frame-scale
 *
 * 生命周期规则（进 / 出时机，Product Owner 口径）：
 *   进：宽屏上一切换到「手机形态」就自动套框（含首屏直开手机形态）；
 *   出：① 点顶栏的框图标手动退出（本次手机形态内不再自动进入）；
 *       ② 切回电脑形态 / 视口缩到断点以内（此时抑制标记一并复位，
 *          下次再切手机形态会重新套框）。
 *
 * 只依赖 platform/ 的纯函数与 stores/settings，DOM 写入集中在 applyFrame 一处。
 * ============================================================ */

import { computed, ref, watch } from 'vue';
import { frameEligible, frameScale } from '@/platform/deviceFrame';
import { matchesDesktop, resolveLayout, watchViewport } from '@/platform/settings';
import { useSettings } from '@/stores/settings';

const settings = useSettings();

/**
 * 视口跨断点的触发器：matchMedia 不是响应式源，跨断点时由 watchViewport 打标记，
 * 借此让 available 重算；重算本身走 matchesDesktop() 的实时查询，
 * 不缓存查询结果——否则「窗口变宽」这种外部变化会读到过期值。
 */
const viewportTick = ref(0);
watchViewport(() => {
  viewportTick.value += 1;
});

/** 可用性：宽屏 + 手机形态（真机窄屏恒 false，不会给真手机套框） */
const available = computed(() => {
  void viewportTick.value; // 视口跨断点时重算
  return frameEligible(resolveLayout(settings.layoutMode), matchesDesktop());
});

/** 用户手动退出后的抑制：只对「当前这次手机形态」有效 */
const suppressed = ref(false);

/** 是否正在框内预览 */
const framed = ref(false);

function sync(): void {
  if (!available.value) {
    // 形态不再适用：退出并清掉抑制，下次切到手机形态时重新自动进入
    framed.value = false;
    suppressed.value = false;
    return;
  }
  if (!suppressed.value) framed.value = true;
}

/** 缩放系数随窗口尺寸走；机身尺寸恒定，靠 --frame-scale 等比缩放（见 platform/deviceFrame.ts） */
function updateScale(): void {
  document.documentElement.style.setProperty(
    '--frame-scale',
    String(frameScale(window.innerWidth, window.innerHeight)),
  );
}

/** 唯一的 DOM 出口：属性开关 + 缩放系数 + resize 监听的挂/卸 */
function applyFrame(on: boolean): void {
  const root = document.documentElement;
  if (on) {
    root.setAttribute('data-device', 'phone');
    updateScale();
    window.addEventListener('resize', updateScale);
  } else {
    window.removeEventListener('resize', updateScale);
    root.removeAttribute('data-device');
    root.style.removeProperty('--frame-scale');
  }
}

/**
 * 进 / 出框的动画窗口：给 <html> 挂 520ms 的 frame-anim，
 * 过渡属性只写在这个类上（styles/frame.css）——
 * 常驻 transition 会让窗口拖拽缩放一直被 0.46s 过渡拖出迟滞。
 */
let animTimer = 0;

function armAnimation(): void {
  const root = document.documentElement;
  root.classList.add('frame-anim');
  window.clearTimeout(animTimer);
  animTimer = window.setTimeout(() => root.classList.remove('frame-anim'), 520);
}

watch(available, sync, { immediate: true });
watch(
  framed,
  (on, prev) => {
    // 首帧（含预览态直开的防闪路径）不加动画窗口：没有「切换」就不该有过渡
    if (prev !== undefined && prev !== on) armAnimation();
    applyFrame(on);
  },
  { immediate: true },
);

/** 顶栏框图标的点击：在「框内 / 未框但可用」之间切换 */
export function toggleDeviceFrame(): void {
  if (framed.value) {
    framed.value = false;
    suppressed.value = true;
    return;
  }
  suppressed.value = false;
  framed.value = available.value;
}

export function useDeviceFrame(): { framed: typeof framed; available: typeof available } {
  return { framed, available };
}
