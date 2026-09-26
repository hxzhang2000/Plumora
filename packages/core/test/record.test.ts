/* ============================================================
 * 卦例记录单元测试 —— 07 文档 §3.7
 *
 * 重点覆盖「卦例名称」的派生规则（用户口径）：
 *   名称优先用占卜的目标（所问之事），没有目标再用其他名称代替。
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import {
  METHOD_CN,
  RECORD_TITLE_FALLBACK,
  buildRecord,
  castByTimeParts,
  methodCn,
  recordTitle,
  replayRecord,
  resolve,
} from '../src/index.js';
import type { HexagramRecord } from '../src/record.js';

/** 造一条最小记录：只填 recordTitle 用得到的字段，其余给安全默认值 */
function rec(over: Partial<HexagramRecord> = {}): HexagramRecord {
  return {
    id: 1,
    createdAt: 1_790_000_000_000,
    updatedAt: 1_790_000_000_000,
    method: 'TIME',
    inputParams: '{}',
    lunarLabel: '丙午年 八月十五 午时',
    upperTrigram: 6,
    lowerTrigram: 5,
    movingLine: 1,
    benGuaCode: '06-05',
    benGuaName: '水风井',
    huGuaCode: '03-02',
    bianGuaCode: '06-01',
    tiTrigram: 6,
    yongTrigram: 5,
    tiYongRule: 'MOVING_LINE',
    relation: 'TI_SHENG_YONG',
    question: null,
    note: null,
    verifyStatus: 'UNVERIFIED',
    ...over,
  };
}

describe('§3.7 卦例名称 recordTitle', () => {
  it('TC-D08 填了所问之事 → 名称取所问之事（占卜目标优先于卦名）', () => {
    expect(recordTitle(rec({ question: '这次面试能否通过' }))).toBe('这次面试能否通过');
    // 卦名仍然存在于记录里，只是不作为名称
    expect(recordTitle(rec({ question: '这次面试能否通过', benGuaName: '乾为天' }))).toBe(
      '这次面试能否通过',
    );
  });

  it('TC-D09 未填所问之事（null）→ 回退到本卦卦名', () => {
    expect(recordTitle(rec({ question: null }))).toBe('水风井');
  });

  it('TC-D10 所问之事为空白串 → 同样回退到卦名（不能出现空标题）', () => {
    expect(recordTitle(rec({ question: '' }))).toBe('水风井');
    expect(recordTitle(rec({ question: '   ' }))).toBe('水风井');
    expect(recordTitle(rec({ question: '\n\t ' }))).toBe('水风井');
  });

  it('TC-D11 所问之事前后空白被裁掉', () => {
    expect(recordTitle(rec({ question: '  问婚事  ' }))).toBe('问婚事');
  });

  it('TC-D12 卦名也缺失 → 回退到「起卦方式 · 农历标签」', () => {
    expect(recordTitle(rec({ question: null, benGuaName: '' }))).toBe(
      '时间起卦 · 丙午年 八月十五 午时',
    );
    expect(recordTitle(rec({ question: '  ', benGuaName: '   ' }))).toBe(
      '时间起卦 · 丙午年 八月十五 午时',
    );
  });

  it('TC-D13 农历也缺失 → 只剩起卦方式；全部缺失 → 固定兜底串', () => {
    expect(recordTitle(rec({ question: null, benGuaName: '', lunarLabel: '' }))).toBe('时间起卦');
    expect(
      recordTitle(
        rec({ question: null, benGuaName: '', lunarLabel: '', method: 'X' as HexagramRecord['method'] }),
      ),
    ).toBe(RECORD_TITLE_FALLBACK);
  });

  it('TC-D14 名称是派生值，不落库（记录结构里没有 title 列）', () => {
    const r = rec();
    expect('title' in r).toBe(false);
    expect('name' in r).toBe(false);
  });

  it('TC-D15 buildRecord 默认不填所问之事 → 名称即为本卦卦名（算例 A）', () => {
    const cast = castByTimeParts(7, 8, 15, 7, { label: '丙午年 八月十五 午时' });
    const draft = buildRecord({
      cast,
      resolved: resolve(6, 5, 1),
      lunarLabel: '丙午年 八月十五 午时',
    });
    expect(draft.question).toBeNull();
    expect(draft.benGuaName).toBe('水风井');
    expect(recordTitle(rec({ ...draft }))).toBe('水风井');
  });

  it('TC-D07 回放取落库的体用列，不随当前设置漂移（04 §2.7）', () => {
    // 这条记录是在「上用下体」流派下起的卦：上卦坎=6 为用、下卦巽=5 为体。
    // 与 MOVING_LINE（动爻 1 → 下卦为用、上卦为体）恰好互换，
    // 所以「回放是否重算」在这里会给出完全不同的答案，不会被巧合掩盖。
    const stored = rec({ tiTrigram: 5, yongTrigram: 6, tiYongRule: 'UPPER_YONG_LOWER_TI' });

    const r = replayRecord(stored);

    // 体用取自落库列：巽(木) 为体、坎(水) 为用 → 水生木 → 用生体 / 大吉
    expect(r.ti).toBe(5);
    expect(r.yong).toBe(6);
    expect(r.judge.relation).toBe('YONG_SHENG_TI');
    expect(r.judge.degree).toBe('DA_JI');
    // 卦名/变卦等其余部分仍由 upper/lower/moving 推出
    expect(r.ben.name).toBe('水风井');

    // 对照：若按当前设置（MOVING_LINE）重算，会得到体坎、用巽 → 体生用 / 小凶。
    // 断言两者确实不同，防止「漂移」这一缺陷因为两边结果一样而被漏掉。
    //
    // 注：`HexagramRecord` 的卦数字段是裸 `number`（落库值未经校验），
    // 不能直接喂给 `resolve`（它要求 `TrigramNumber`）。先断言夹具值，
    // 再用字面量重算——既过类型检查，也顺带锁住夹具本身。
    expect([stored.upperTrigram, stored.lowerTrigram, stored.movingLine]).toEqual([6, 5, 1]);
    const recomputed = resolve(6, 5, 1, 'MOVING_LINE');
    expect(recomputed.ti).toBe(6);
    expect(recomputed.yong).toBe(5);
    expect(recomputed.judge.relation).toBe('TI_SHENG_YONG');
    expect(r.ti).not.toBe(recomputed.ti);
    expect(r.judge.relation).not.toBe(recomputed.judge.relation);
  });

  it('TC-D07b 落库体用字段为脏数据时响亮失败，不在下游崩溃', () => {
    expect(() => replayRecord(rec({ tiTrigram: 0 }))).toThrow(/体卦先天数/);
    expect(() => replayRecord(rec({ yongTrigram: 9 }))).toThrow(/用卦先天数/);
  });

  it('TC-D16 改名后名称立刻跟随（派生值不会与被改字段脱钩）', () => {
    const cast = castByTimeParts(7, 8, 15, 7, { label: '丙午年 八月十五 午时' });
    const stored = rec({
      ...buildRecord({ cast, resolved: resolve(6, 5, 1), lunarLabel: '丙午年 八月十五 午时' }),
      id: 1,
      question: '问出行',
    });
    expect(recordTitle(stored)).toBe('问出行');

    // 模拟详情页「保存修改」：清空所问之事 → 名称回到卦名
    expect(recordTitle({ ...stored, question: null })).toBe('水风井');

    // 回放不受影响（体用取自落库列）
    expect(replayRecord(stored).ben.name).toBe('水风井');
  });

  /* ------------------------------------------------------------------
   * 起卦方式下线后的旧数据兜底
   * 声音（点数）起卦已移除，但旧卦例库里 method 仍是写入时的 'SOUND'。
   * 展示层若直查 METHOD_CN 会拿到 undefined 并渲染出「undefined · …」。
   * ------------------------------------------------------------------ */
  describe('已下线的起卦方式：旧记录不得渲染出 undefined', () => {
    it('methodCn 对在册方式照常返回中文', () => {
      expect(methodCn('TIME')).toBe('时间起卦');
      expect(methodCn('RANDOM')).toBe('随机起卦');
    });

    it('methodCn 对已下线 / 未知方式回退「其他方式」', () => {
      expect(methodCn('SOUND')).toBe('其他方式');
      expect(methodCn('')).toBe('其他方式');
      expect(METHOD_CN['SOUND' as keyof typeof METHOD_CN]).toBeUndefined();
    });

    it('recordTitle 不把「其他方式」写进派生名称：旧声音起卦记录回退到农历 / 固定兜底串', () => {
      const legacy = rec({ method: 'SOUND' as never, question: null, benGuaName: '' });
      expect(recordTitle(legacy)).toBe('丙午年 八月十五 午时');
      expect(recordTitle(legacy)).not.toContain('undefined');
      expect(recordTitle({ ...legacy, lunarLabel: '' })).toBe(RECORD_TITLE_FALLBACK);
    });
  });
});
