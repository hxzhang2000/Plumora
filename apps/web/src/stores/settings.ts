/* 设置状态（响应式单例）—— 写入即持久化并即时生效 */

import { reactive, watch } from 'vue';
import {
  applyTheme,
  loadSettings,
  saveSettings,
  watchSystemTheme,
  type Settings,
} from '@/platform/settings';

const state = reactive<Settings>(loadSettings());

applyTheme(state.theme);

// 系统主题变化时，仅在「跟随系统」下重新解析
watchSystemTheme(() => {
  if (state.theme === 'SYSTEM') applyTheme('SYSTEM');
});

// 任何字段变更 → 落盘 + 应用主题
watch(state, () => {
  saveSettings({ ...state });
  applyTheme(state.theme);
});

export function useSettings(): Settings {
  return state;
}

export function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  state[key] = value;
}

export function resetDisclaimer(): void {
  state.disclaimerAcknowledged = false;
}
