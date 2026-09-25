/* 轻提示（Snackbar）—— 06 §五：保存卦例后提示「卦例已保存」并带「查看」动作 */

import { ref } from 'vue';

export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export interface ToastMessage {
  readonly id: number;
  readonly text: string;
  readonly action?: ToastAction;
}

const items = ref<ToastMessage[]>([]);
let seq = 0;

export function useToasts() {
  return items;
}

export function toast(text: string, action?: ToastAction, duration = 2400): void {
  const id = ++seq;
  items.value = [...items.value, { id, text, action }];
  setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id: number): void {
  items.value = items.value.filter((t) => t.id !== id);
}
