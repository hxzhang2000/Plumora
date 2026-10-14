/* ============================================================
 * 排盘文本 buildCastText 测试
 *
 * 结果页与详情页共用这段文案，一旦措辞或字段错位，两个页面会同时出问题；
 * 这里把「包含哪些行、用哪几个字段」钉死，避免日后只改一处导致两边不一致。
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { resolve } from '@plumora/core';
import { buildCastText } from '@/platform/castText';

describe('排盘文本 buildCastText', () => {
  it('包含标题、本卦、互卦/变卦、体用、卦意与免责声明', () => {
    const r = resolve(6, 5, 1); // 水风井，动爻初
    const text = buildCastText({ resolved: r, method: 'TIME', lunarLabel: '丙午年 八月十五 午时' });

    expect(text).toContain('【观梅 · Plumora 排盘】');
    expect(text).toContain('时间起卦');
    expect(text).toContain('丙午年 八月十五 午时');
    expect(text).toContain(`本卦：${r.ben.name}`);
    expect(text).toContain(`互卦：${r.hu.name}`);
    expect(text).toContain(`变卦：${r.bian.name}`);
    expect(text).toContain('体：');
    expect(text).toContain('用：');
    expect(text).toContain('仅供传统文化学习研究使用');
    // 空行不应出现（lunarLabel 为空时该行被 filter 掉）
    expect(text.split('\n').every((line) => line.length > 0)).toBe(true);
  });

  it('未下线方式（未知 method）走「其他方式」容错，而不是 undefined', () => {
    const r = resolve(1, 1, 3);
    const text = buildCastText({ resolved: r, method: 'SOUND', lunarLabel: '' });
    expect(text).toContain('其他方式');
    expect(text).not.toContain('undefined');
  });
});
