/* ============================================================
 * 弹层通用行为 —— Esc 关闭 / 焦点陷阱 / 焦点回收 / 背景滚动锁
 *
 * 起因（审查 W-7 / W-16）：各弹窗都只做了「Esc 关闭」这一半，
 * 焦点仍能 Tab 到遮罩背后的页面元素上（视觉上弹窗盖着，键盘却跑到了后面），
 * 关掉弹窗后焦点也不会回到当初点开它的那个按钮上。
 *
 * 三件事必须一起做才算数：
 *   ① 焦点陷阱：Tab / Shift+Tab 在弹窗内循环；
 *   ② 焦点回收：关闭后把焦点还给打开它的元素（找不到就落回 body）；
 *   ③ 背景滚动锁：多弹层叠加时按「打开集合」计数，不会互相提前解锁。
 *
 * 叠加（如「设置抽屉里的导入确认框」）由模块级栈解决：
 * 只有**最上层**那个弹层响应 Esc 与 Tab，下层保持静默。
 * ============================================================ */

import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue';

/** 可聚焦元素选择器（与 focus-trap 类库的常用口径一致） */
const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),iframe,object,embed,video[controls],audio[controls],' +
  '[contenteditable="true"],[tabindex]:not([tabindex="-1"])';

/** 当前打开的弹层栈（只比较身份，不存引用外部对象） */
const stack: symbol[] = [];
/** 已锁滚动的弹层集合 —— 用集合而非计数，重复加锁 / 提前解锁都不会失衡 */
const lockedTokens = new Set<symbol>();

function syncOverflow(): void {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = lockedTokens.size ? 'hidden' : '';
}

function lock(token: symbol): void {
  lockedTokens.add(token);
  syncOverflow();
}

function unlock(token: symbol): void {
  lockedTokens.delete(token);
  syncOverflow();
}

function focusablesWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // inert 子树整体不可聚焦（如关闭态的设置抽屉还留在 DOM 里）
    if (el.closest('[inert]')) return false;
    return true;
  });
}

export interface DialogOptions {
  /** 是否打开（响应式求值） */
  readonly open: () => boolean;
  /** 请求关闭（Esc 或遮罩点击） */
  readonly close: () => void;
  /**
   * 弹窗根节点。需带 `tabindex="-1"`：它既是初始焦点落点，
   * 也是焦点陷阱的边界（Tab 时在它内部的第一个 / 最后一个可聚焦元素间循环）。
   */
  readonly root: Ref<HTMLElement | null>;
  /**
   * 组件自己的按键处理（如确认框的 Enter）。
   * 仅在焦点位于弹窗内部时被调用；返回 true 表示已消费该按键。
   */
  readonly onKey?: (e: KeyboardEvent) => boolean;
}

export interface DialogHandle {
  /** KeepAlive 的 onDeactivated 用：弹窗随视图被收走时立刻解锁背景滚动 */
  releaseLock(): void;
  /** KeepAlive 的 onActivated 用：视图回来且弹窗仍打开时重新加锁 */
  reacquireLock(): void;
}

export function useDialog(options: DialogOptions): DialogHandle {
  const token = Symbol('dialog');
  let lastFocused: HTMLElement | null = null;
  /** 是否真的打开过 —— immediate 首次求值为 false 时不走任何收尾逻辑 */
  let everOpened = false;

  const isTop = (): boolean => stack.length > 0 && stack[stack.length - 1] === token;

  function trapTab(e: KeyboardEvent): void {
    const root = options.root.value;
    if (!root) return;
    const list = focusablesWithin(root);
    const active = document.activeElement as HTMLElement | null;
    if (!list.length) {
      // 弹窗里没有可聚焦元素：把焦点钉在弹窗自身上，别让它 Tab 到背后
      e.preventDefault();
      root.focus();
      return;
    }
    const first = list[0]!;
    const last = list[list.length - 1]!;
    if (!active || !root.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (!options.open() || !isTop()) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      options.close();
      return;
    }

    const root = options.root.value;
    const target = e.target as Node | null;
    // 自定义按键只在焦点位于弹窗内部时生效：否则会重现 W-2 ——
    // 人在别的页面按 Enter，打到一个还开着的弹窗上（甚至触发删除确认）。
    if (root && target && root.contains(target) && options.onKey?.(e)) return;

    if (e.key === 'Tab') trapTab(e);
  }

  watch(
    options.open,
    (open) => {
      if (open) {
        everOpened = true;
        // 记录打开前的焦点，关闭时还回去（无触发器时回落 null）
        const active = typeof document === 'undefined' ? null : document.activeElement;
        lastFocused = active instanceof HTMLElement && active !== document.body ? active : null;
        stack.push(token);
        lock(token);
        void nextTick(() => {
          if (options.open()) options.root.value?.focus();
        });
        return;
      }

      // 挂载时的首次求值（弹层本就是关闭态）：什么都没做过，不该「回收」焦点。
      // 否则组件一挂载就会把用户当前的焦点 blur 掉（如结果页刚渲染时）。
      if (!everOpened) return;

      const at = stack.indexOf(token);
      if (at >= 0) stack.splice(at, 1);
      unlock(token);

      if (lastFocused && document.contains(lastFocused)) {
        lastFocused.focus();
      } else {
        // 触发元素可能已被移除（如列表项刚被删除）：把焦点交还 body，
        // 否则焦点会留在被卸载的节点上，键盘用户在页面上「失去位置」。
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      lastFocused = null;
    },
    { immediate: true },
  );

  if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown);

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown);
    const at = stack.indexOf(token);
    if (at >= 0) stack.splice(at, 1);
    unlock(token);
  });

  return {
    releaseLock: () => unlock(token),
    reacquireLock: () => {
      if (options.open()) lock(token);
    },
  };
}
