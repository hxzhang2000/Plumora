/* ============================================================
 * 二维码弹窗的共享开关（响应式单例）
 *
 * 为什么要有它：「手机扫码打开本页」有两个常驻入口——
 *   ① 顶栏 / 侧栏的扫码图标（App.vue）；
 *   ② 设置面板「跨设备」区的原入口（SettingsPanel.vue）。
 * 弹窗本体只渲染**一份**（App.vue，Teleport 到 #app 与其它弹层同层），
 * 开关就必须是模块级的：两处各持一份 ref 的话，点设置面板的按钮只会打开
 * 它自己那份弹窗，顶栏这份永远打不开（反之亦然）。
 *
 * 只放状态与开/关动作，不碰 DOM：焦点、滚动锁、Esc/Enter 关闭仍在
 * QrCodeDialog.vue；二维码编码与地址选择仍只由 platform/qrcode.ts、
 * platform/share.ts 提供（本模块不 import 它们）。
 * ============================================================ */

import { ref } from 'vue';

/** 弹窗开合 —— 模块级：跨组件共享同一份状态 */
const qrOpen = ref(false);

/** 打开二维码（顶栏 / 侧栏 / 设置面板共用） */
export function openQr(): void {
  qrOpen.value = true;
}

/** 关闭二维码 */
export function closeQr(): void {
  qrOpen.value = false;
}

/**
 * 取共享状态与动作。
 * 解构出的顶层 ref 在 <script setup> 模板里会自动解包（同 useDeviceFrame），
 * 所以模板可直接写 :open="qrOpen"。
 */
export function useQrDialog(): {
  qrOpen: typeof qrOpen;
  openQr: typeof openQr;
  closeQr: typeof closeQr;
} {
  return { qrOpen, openQr, closeQr };
}
