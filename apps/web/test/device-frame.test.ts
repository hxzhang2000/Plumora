/* ============================================================
 * 手机框预览测试 —— 缩放系数与进框判据（platform/deviceFrame.ts 的纯函数）
 *
 * 为什么需要它：进框判据错了的后果不对称——
 *   「窄屏也套框」= 真实手机上冒出一个机身壳（产品红线：预览只属于桌面）；
 *   「宽屏不套框」= 功能整个静默失效。
 * 状态机与 DOM 写入由运行时冒烟覆盖（inspectDeviceFrame），这里只测纯逻辑。
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { FRAME_H, FRAME_W, frameEligible, frameScale } from '@/platform/deviceFrame';

/** 舞台留白（与 platform/deviceFrame.ts 的常量保持一致的口径） */
const PAD_X = 72;
const PAD_Y = 96;

describe('手机框预览 · 逻辑屏与缩放', () => {
  it('逻辑屏是 390 × 844（真机口径，框内断点/间距据此排版）', () => {
    expect(FRAME_W).toBe(390);
    expect(FRAME_H).toBe(844);
  });

  it('窗口够大时 1:1 呈现（预览只缩小、不放大）', () => {
    expect(frameScale(1920, 1080)).toBe(1);
    expect(frameScale(FRAME_W + PAD_X, FRAME_H + PAD_Y)).toBe(1);
  });

  it('窗口偏矮时按短边等比缩小，且缩完仍留得下机身与余量', () => {
    const h = 700;
    const s = frameScale(1600, h);
    expect(s).toBeLessThan(1);
    // 机身 + 上下留白必须塞得进窗口，否则机身会顶到窗口边缘
    expect(FRAME_H * s + PAD_Y).toBeLessThanOrEqual(h + 1);
    // 宽度方向此时并未触顶：缩小高度时宽度同步跟着缩（整体等比）
    expect(FRAME_W * s + PAD_X).toBeLessThanOrEqual(1600);
  });

  it('缩放下限兜底：窗口再小也保持一块可读的机身，而不是缩成色块', () => {
    expect(frameScale(400, 300)).toBe(0.4);
    expect(frameScale(900, 400)).toBeGreaterThanOrEqual(0.4);
  });

  it('缩放系数保留 3 位小数（不把 0.7156487… 写进内联样式）', () => {
    const s = frameScale(1237, 777);
    expect(s).toBe(Math.round(s * 1000) / 1000);
  });
});

describe('手机框预览 · 进框判据', () => {
  it('宽屏 + 手机形态 → 套框', () => {
    expect(frameEligible('mobile', true)).toBe(true);
  });

  it('窄屏恒不套框 —— 真实手机拿普通响应式布局（产品红线）', () => {
    expect(frameEligible('mobile', false)).toBe(false);
  });

  it('电脑形态不套框：桌面布局下机身壳毫无意义', () => {
    expect(frameEligible('desk', true)).toBe(false);
    expect(frameEligible('desk', false)).toBe(false);
  });
});
