/* 设置状态（响应式单例）—— 写入即持久化并即时生效 */

import { reactive, watch } from 'vue';
import {
  applyLayout,
  applyTheme,
  loadSettings,
  saveSettings,
  watchSystemTheme,
  watchViewport,
  type Settings,
} from '@/platform/settings';

const state = reactive<Settings>(loadSettings());

applyTheme(state.theme);
applyLayout(state.layoutMode);

// 系统主题变化时，仅在「跟随系统」下重新解析
watchSystemTheme(() => {
  if (state.theme === 'SYSTEM') applyTheme('SYSTEM');
});

// 视口跨断点时，仅在「自动」下重算（强制值不受视口影响）
watchViewport(() => {
  if (state.layoutMode === 'AUTO') applyLayout('AUTO');
});

// 任何字段变更 → 落盘 + 应用主题 + 应用布局
watch(state, () => {
  saveSettings({ ...state });
  applyTheme(state.theme);
  applyLayout(state.layoutMode);
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
