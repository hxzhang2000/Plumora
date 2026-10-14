/* ============================================================
 * 卦例导入解析测试 —— 导出文件的反向还原（04 §五 的补全）
 *
 * 为什么需要：导入是「用户数据进库」的入口，最怕的是「半对」——
 *   ① 结构错的文件被逐条容错，写进半个错库；
 *   ② 手改过的文件把与卦体不符的冗余列（卦名 / 卦码 / 关系）带进库。
 * 这里针对这两点各设护栏：结构错整包拒绝、单条错逐条丢弃、派生字段一律重算。
 *
 * 纯函数，不需要 IndexedDB；与 records.test.ts 的读写用例分开，各自聚焦。
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { ImportError, parseExportBundle, toExportBundle } from '@/platform/records';
import type { HexagramRecord } from '@plumora/core';

/** 组装一条「文件里」的记录（含全部冗余列，故意可被改坏） */
function rawRecord(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    createdAt: 1_790_000_000_000,
    updatedAt: 1_790_000_000_000,
    method: 'TIME',
    inputParams: '{"type":"TIME"}',
    lunarLabel: '丙午年 八月十五 午时',
    upperTrigram: 6,
    lowerTrigram: 5,
    movingLine: 1,
    benGuaCode: '06-05',
    benGuaName: '水风井',
    huGuaCode: '06-05',
    bianGuaCode: '06-05',
    tiTrigram: 6,
    yongTrigram: 5,
    tiYongRule: 'MOVING_LINE',
    relation: 'BI_HE',
    question: '这次能否成',
    note: null,
    verifyStatus: 'UNVERIFIED',
    ...over,
  };
}

function bundle(records: unknown[]) {
  return { schemaVersion: 1, exportedAt: '2026-10-14T00:00:00.000Z', app: '观梅 · Plumora', records };
}

describe('卦例导入 parseExportBundle', () => {
  it('结构错误（非对象 / schemaVersion 不符 / records 非数组）整包拒绝', () => {
    expect(() => parseExportBundle(null)).toThrow(ImportError);
    expect(() => parseExportBundle('字符串')).toThrow(ImportError);
    expect(() => parseExportBundle({ schemaVersion: 2, records: [] })).toThrow(/schemaVersion/);
    expect(() => parseExportBundle({ schemaVersion: 1, records: '不是数组' })).toThrow(/records/);
  });

  it('合法文件：全部接收，派生字段由卦体重算，id 不被带入库', () => {
    const out = parseExportBundle(bundle([rawRecord()]));
    expect(out.rejected).toEqual([]);
    expect(out.accepted).toHaveLength(1);

    const r = out.accepted[0] as HexagramRecord & { id?: number };
    expect('id' in r).toBe(false); // 自增主键由存储层重新分配
    // 冗余列被知识库重推，而不是照抄文件里的假值（06-05 井 → 互/变各不相同）
    expect(r.benGuaCode).toBe('06-05');
    expect(r.benGuaName).toBe('水风井');
    expect(r.huGuaCode).not.toBe('06-05');
    expect(r.relation).not.toBe('BI_HE');
  });

  it('单条脏数据被逐条丢弃，其余照常导入，并给出可读原因', () => {
    const out = parseExportBundle(
      bundle([
        rawRecord(),
        rawRecord({ upperTrigram: 0 }), // 非法先天数
        rawRecord({ movingLine: 7 }), // 动爻越界
        'not an object',
        rawRecord({ question: '第二条有效' }),
      ]),
    );
    expect(out.accepted).toHaveLength(2);
    expect(out.rejected.map((r) => r.index)).toEqual([2, 3, 4]);
    expect(out.rejected[0].reason).toMatch(/上卦|下卦|动爻/);
  });

  it('缺失的 tiTrigram/yongTrigram 按 tiYongRule 现推，保证导入后自洽', () => {
    const out = parseExportBundle(
      bundle([rawRecord({ tiTrigram: undefined, yongTrigram: undefined })]),
    );
    const r = out.accepted[0];
    expect(r.tiTrigram).toBeGreaterThanOrEqual(1);
    expect(r.tiTrigram).toBeLessThanOrEqual(8);
    expect(r.yongTrigram).toBeGreaterThanOrEqual(1);
    expect(r.yongTrigram).toBeLessThanOrEqual(8);
  });

  it('超长所问之事截断到 200 字而非丢弃；非法应验状态回退 UNVERIFIED', () => {
    const out = parseExportBundle(
      bundle([rawRecord({ question: '甲'.repeat(250), verifyStatus: '乱写' })]),
    );
    const r = out.accepted[0];
    expect(r.question).toHaveLength(200);
    expect(r.verifyStatus).toBe('UNVERIFIED');
  });

  it('导出 → 导入往返：条数与关键字段守恒', () => {
    const source = [rawRecord(), rawRecord({ upperTrigram: 1, lowerTrigram: 1 })] as unknown as HexagramRecord[];
    const exported = toExportBundle(source);
    const back = parseExportBundle(JSON.parse(JSON.stringify(exported)));
    expect(back.accepted).toHaveLength(source.length);
    expect(back.rejected).toHaveLength(0);
    expect(back.accepted[0].benGuaCode).toBe('06-05');
    expect(back.accepted[1].benGuaCode).toBe('01-01');
  });
});
