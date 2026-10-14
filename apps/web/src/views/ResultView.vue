<script setup lang="ts">
/** 排盘结果页 —— 06 §3.2；保存卦例后提供「查看」动作（06 §五） */
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { buildRecord, methodCn } from '@plumora/core';
import ResultPanel from '@/components/ResultPanel.vue';
import { buildCastText } from '@/platform/castText';
import { enforceRecordLimit, insertRecord } from '@/platform/records';
import { copyText as copyToClipboard, shareTarget } from '@/platform/share';
import { sharedResultPath, withSharedCast } from '@/platform/shareLink';
import { goBack, navigate, replaceRoute, route } from '@/router';
import { ensureResolved, useCurrentCast, useResolvedCast } from '@/stores/cast';
import { refreshRecords } from '@/stores/records';
import { useSettings } from '@/stores/settings';
import { toast } from '@/stores/toast';

const settings = useSettings();
const current = useCurrentCast();
/* 推导结果异步就位（六十四卦全表按需加载，见 stores/cast.ts 的文件头）。
 * 正常路径：起卦时已经预热，进到本页时早就好了；
 * 兜底路径：刷新 / 深链直接落在结果页 —— 这里补一次推导，期间显示占位。 */
const resolved = useResolvedCast();
onMounted(() => {
  void ensureResolved();
});
/** 起卦前填写、随起卦结果带出；此处仍可修改，再决定是否保存为卦例 */
const question = ref(current.value?.question ?? '');
const saving = ref(false);

// 本组件被 App 的 <KeepAlive> 缓存，「再起一卦」后回到结果页不会重新挂载，
// question 只会在首次挂载时初始化——不监听就会一直显示上一次的空值
// （表现：起卦页填了所问之事，解卦却说「没有记下具体问的是什么事」）。
// 这里监听暂存的 question：每次起卦（setCurrentCast 更新 current）后，
// 把输入同步为本次起卦带入的所问之事。
watch(
  () => current.value?.question,
  (q) => {
    question.value = q ?? '';
  },
);

// 直接访问 /result（或刷新后会话丢失）时回到起卦页
// KeepAlive 缓存本组件：每次激活（含「再起一卦」后回来）都要确认推导已就位
onActivated(() => {
  if (!current.value) {
    replaceRoute('/cast');
    return;
  }
  void ensureResolved();
  // 从别的 Tab 回来时地址栏已被导航覆盖（`#/result`），补回这一盘的分享参数
  syncShareUrl();
});

const cast = computed(() => current.value?.cast ?? null);

const title = computed(() => {
  const c = cast.value;
  return c ? methodCn(c.method) : '排盘';
});

async function save() {
  const c = cast.value;
  const r = resolved.value;
  if (!c || !r || saving.value) return;
  saving.value = true;
  try {
    const draft = buildRecord({
      cast: c,
      resolved: r,
      lunarLabel: current.value?.lunarLabel ?? '',
    });
    const id = await insertRecord({ ...draft, question: question.value.trim() || null });
    await enforceRecordLimit(settings.recordLimit);
    await refreshRecords();
    question.value = '';
    toast('卦例已保存', { label: '查看', run: () => navigate(`/records/${id}`) });
  } catch (e) {
    toast(`保存失败：${(e as Error).message}`);
  } finally {
    saving.value = false;
  }
}

/** 复制排盘文本（FR-11）——文案见 platform/castText 的唯一实现。
 *  图片分享走 ResultPanel 里的 ShareCard，链接分享走下方的 shareLink()。 */
const copyText = computed(() => {
  const r = resolved.value;
  const c = cast.value;
  if (!r || !c) return '';
  return buildCastText({
    resolved: r,
    method: c.method,
    lunarLabel: current.value?.lunarLabel ?? '',
  });
});

async function copy() {
  // 走 platform/share 的 copyText：局域网 http 下 navigator.clipboard 不可用，
  // 它会降级到 textarea + execCommand（这个功能恰恰多用在局域网调试场景）
  const ok = await copyToClipboard(copyText.value);
  toast(ok ? '已复制排盘文本' : '当前环境不支持自动复制，请手动选择文本');
}

const isRecordDetail = computed(() => route.value.name === 'record-detail');

/* ---------------------------------------------------------------
 * 分享链接 —— 把这一整盘编进 URL（编码与校验见 platform/shareLink）
 * ------------------------------------------------------------- */

/** 分享用的绝对地址：走 shareTarget()，本机 localhost 会换成局域网地址（手机才点得开） */
const shareUrl = computed(() => {
  const c = current.value;
  if (!c) return '';
  return withSharedCast(shareTarget().url, c.cast, c.tiYongRule, c.castAt);
});

/** 有系统分享面板（手机）就直发，没有（桌面）就复制——按钮文案跟着变，别让人猜 */
const shareLabel = computed(() =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    ? '分享链接'
    : '复制链接',
);

async function shareLink() {
  const url = shareUrl.value;
  if (!url) return;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: '观梅 · 排盘', url });
      return; // 系统面板已接管：发微信 / 存备忘 / 隔空投送都走它
    } catch (e) {
      // 用户主动取消：什么都别做，也不要再弹一次「已复制」
      if ((e as DOMException | undefined)?.name === 'AbortError') return;
      // 其它失败（无权限 / 面板不可用）继续降级到复制
    }
  }

  const ok = await copyToClipboard(url);
  toast(ok ? '已复制排盘链接' : '当前环境不支持自动复制，请手动复制地址栏');
}

/**
 * 把当前这一盘写进地址栏（replaceState：不产生历史记录、不触发 hashchange）。
 *
 * 为什么值得做：地址栏即状态。这一步之后，刷新、收藏、直接复制地址栏、
 * 以及顶栏「手机扫码打开」（读的就是当前地址）全都自动带上这一盘，
 * 不用为每个入口各做一套分享逻辑。
 */
function syncShareUrl(): void {
  /* 守卫一：本组件被 KeepAlive 缓存，离开结果页后异步推导仍可能完成并触发联动；
   * 不拦住就会把用户从卦例页 / 学习页硬拉回结果页。 */
  if (route.value.name !== 'result') return;
  const c = current.value;
  if (!c) return;
  const path = sharedResultPath(c.cast, c.tiYongRule, c.castAt);
  // 守卫二：已经是这个地址（比如刚由分享链接进来）就不要白写一次
  if (location.hash === `#${path}`) return;
  replaceRoute(path);
}

// 起卦 / 采纳分享链接都会换掉 current；immediate 覆盖「刷新后直接落在结果页」
watch(current, () => syncShareUrl(), { immediate: true });
</script>

<template>
  <div v-if="cast" class="result-view">
    <header class="r-header">
      <button
        v-if="!isRecordDetail"
        type="button"
        class="icon-btn"
        aria-label="返回"
        @click="goBack('/cast')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <h1 class="title serif">{{ title }}</h1>
    </header>

    <template v-if="resolved">
      <!-- 排盘结果（含三卦切换；解卦参考卡在其内部：生克结论卡之后、体用类象之前） -->
      <ResultPanel :resolved="resolved" :context="current?.context" :question="question" />

      <!-- 起卦完成：所问之事已从起卦页带入（可修改），由用户决定是否保存卦例 -->
      <section class="card save">
        <h3 class="card-title">保存卦例（选填）</h3>
        <div class="field">
          <label for="q">所问之事（起卦前填写，此处可修改）</label>
          <input id="q" v-model="question" type="text" maxlength="200" placeholder="默念所问，一事一占" />
        </div>
        <div class="ops">
          <button type="button" class="btn-main" :disabled="saving" @click="save">保存卦例</button>
          <button type="button" class="btn-ghost" @click="copy">复制排盘</button>
          <button type="button" class="btn-ghost" @click="shareLink">{{ shareLabel }}</button>
        </div>
      </section>

      <button type="button" class="btn-ghost block" @click="navigate('/cast')">再起一卦</button>

      <p class="foot">本应用仅供传统文化学习与研究使用。</p>
    </template>

    <!-- 六十四卦全表按需加载，正常路径（起卦后进入）不会看到这里 -->
    <p v-else class="pending" role="status" aria-live="polite">正在推导卦象…</p>
  </div>
</template>

<style scoped>
.result-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.r-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.r-header .title {
  font-size: var(--fs-lg);
  letter-spacing: 2px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: none;
  border: 1px solid var(--c-line);
  border-radius: 50%;
  background: var(--c-surface);
  color: var(--c-ink);
}

.icon-btn svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.save .ops {
  display: flex;
  /* 三颗按钮（保存 + 复制排盘 + 分享链接）在 320px 窄屏放不下一行时换行，
     而不是把「保存卦例」挤成两行字 */
  flex-wrap: wrap;
  gap: 10px;
}

.save .ops .btn-main {
  flex: 1;
  font-size: var(--fs-md);
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  padding: 12px 14px;
}

.save .ops .btn-ghost {
  flex: none;
  white-space: nowrap;
}

.block {
  width: 100%;
}

.foot {
  padding-bottom: 8px;
  text-align: center;
  font-size: var(--fs-xs);
  color: var(--c-muted);
}

.pending {
  padding: 48px 0;
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--c-muted);
}
</style>
