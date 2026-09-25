<script setup lang="ts">
/** 首启声明页 —— 01 §五合规对策 / 06 §七：首次启动展示声明，确认后方可使用 */
import { updateSetting, useSettings } from '@/stores/settings';

const settings = useSettings();

function accept() {
  updateSetting('disclaimerAcknowledged', true);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="gate">
      <div v-if="!settings.disclaimerAcknowledged" class="gate">
        <div class="sheet">
          <p class="brand serif">观梅 · Plumora</p>
          <h2>使用前请阅读</h2>
          <ul>
            <li>本应用是<strong>梅花易数起卦与排盘工具</strong>，定位为传统文化学习与研究用途。</li>
            <li>应用内呈现的卦辞、爻辞、类象与体用生克关系，均为<strong>传统文献内容与规则推导结果</strong>，不构成任何预测、建议或决策依据。</li>
            <li>所有数据仅保存在你的设备本地，应用不收集、不上传任何个人信息，也不含任何统计与广告组件。</li>
            <li>笔画数以本应用内置标准为准，不同辞书或有出入。</li>
          </ul>
          <p class="foot">本应用仅供传统文化学习与研究使用。</p>
          <button type="button" class="btn-main" @click="accept">我已知悉</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gate {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--c-bg);
}

.sheet {
  width: min(520px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 28px 24px;
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-float);
}

.brand {
  font-size: var(--fs-sm);
  letter-spacing: 3px;
  color: var(--c-accent);
}

h2 {
  font-family: var(--font-serif);
  font-size: var(--fs-xl);
  letter-spacing: 2px;
  margin: 8px 0 16px;
}

ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

li {
  position: relative;
  padding-left: 16px;
  font-size: var(--fs-base);
  line-height: 1.75;
  color: var(--c-text);
}

li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 0.72em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--c-accent);
}

strong {
  color: var(--c-accent);
  font-weight: 600;
}

.foot {
  margin: 18px 0 20px;
  padding: 12px 14px;
  border-left: 3px solid var(--c-accent);
  background: var(--c-accent-soft);
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
  font-size: var(--fs-base);
  color: var(--c-text);
}

.gate-enter-active,
.gate-leave-active {
  transition: opacity var(--dur);
}

.gate-enter-from,
.gate-leave-to {
  opacity: 0;
}
</style>
