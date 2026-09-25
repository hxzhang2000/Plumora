/* ============================================================
 * 卦例记录存储层测试 —— 07 文档 §3.7 的 TC-D01 ~ TC-D06（Web 端实现）
 *
 * 为什么需要它：审查报告 D-3 指出「TC-D01–D06（IndexedDB 增删改查 / 搜索 /
 * 保留上限裁剪）无任何自动化护栏」——`apps/web/src/platform/records.ts`
 * 里最容易悄悄坏掉的就是这一层。
 *
 * 做法：复用运行时冒烟已在用的最小 IndexedDB 替身
 * （`apps/web/scripts/idb-stub.cjs`，异步回调时序与浏览器一致），
 * 挂到 globalThis 上即可让 platform/records.ts 真的跑起来。
 *
 * 调度器选 queueMicrotask：替身默认的 setTimeout(fn, 0) 在 Windows 上实际粒度约
 * 15.6ms，TC-D06 要串行插 501 条 → 7.7s，直接顶穿 vitest 默认 5s 超时；超时后那个
 * 循环还在后台写库，会把后续用例的计数污染成「7」「1」这类无关数字。改用微任务后
 * 「回调仍在赋值之后触发」这一契约不变（见替身文件头 ①③），耗时降到毫秒级。
 *
 * 注意：替身只服务于「行为契约」，不验证事务隔离 / 索引 / 版本迁移语义
 *       （那属于真实浏览器，见 04 文档 §2.6）。
 * ============================================================ */

import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HexagramRecord, NewHexagramRecord } from '@plumora/core';

const require_ = createRequire(import.meta.url);
const { installIndexedDB } = require_('../scripts/idb-stub.cjs') as {
  installIndexedDB: (
    target: unknown,
    opts?: unknown,
  ) => { rows: Map<number, unknown>; reset: () => void; size: () => number };
};

const idb = installIndexedDB(globalThis, { scheduler: queueMicrotask });

/** 组装一条可落库的记录（结构与 core 的 buildRecord 一致，直接构造更易读） */
function rec(over: Partial<NewHexagramRecord> = {}): NewHexagramRecord {
  return {
    createdAt: 1_790_000_000_000,
    updatedAt: 1_790_000_000_000,
    method: 'TIME',
    inputParams: '{}',
    lunarLabel: '丙午年 八月十五 午时',
    upperTrigram: 6,
    lowerTrigram: 5,
    movingLine: 1,
    benGuaCode: '06-05',
    benGuaName: '乾为天',
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

/** 每个用例都拿一份「全新的模块实例」，避免 dbPromise 在用例间串味 */
async function freshRecords() {
  vi.resetModules();
  idb.reset();
  return import('@/platform/records');
}

beforeEach(() => {
  idb.reset();
});

describe('§3.7 卦例记录存储（Web / IndexedDB）', () => {
  it('TC-D01 插入 3 条后按 createdAt 倒序查询', async () => {
    const { insertRecord, listRecords } = await freshRecords();
    await insertRecord(rec({ createdAt: 300, question: '最早' }));
    await insertRecord(rec({ createdAt: 100, question: '更早' }));
    await insertRecord(rec({ createdAt: 200, question: '居中' }));

    const all = await listRecords();
    expect(all.map((r) => r.question)).toEqual(['最早', '居中', '更早']);
    // 替身里确实存了 3 条 —— 否则上面的断言只是在空数组上做检查
    expect(idb.size()).toBe(3);
  });

  it('TC-D02 按 question / note / 卦名三列关键字搜索，各自命中', async () => {
    const { insertRecord, queryRecords } = await freshRecords();
    // 三条的卦名互不相同 —— 否则「卦名命中 1 条」会因为夹具同名而误判成 3 条
    await insertRecord(rec({ question: '这次面试能否通过', benGuaName: '乾为天' }));
    await insertRecord(rec({ note: '面试后第三天收到回复', benGuaName: '坤为地' }));
    await insertRecord(rec({ question: null, note: null, benGuaName: '水风井' }));

    expect((await queryRecords({ keyword: '面试' })).length).toBe(2); // question + note 各一条
    expect((await queryRecords({ keyword: '水风井' })).length).toBe(1); // 卦名命中
    expect((await queryRecords({ keyword: '不存在的词' })).length).toBe(0);
  });

  it('TC-D02b 应验状态筛选与关键字可叠加', async () => {
    const { insertRecord, queryRecords } = await freshRecords();
    await insertRecord(rec({ question: '甲事', verifyStatus: 'VERIFIED' }));
    await insertRecord(rec({ question: '甲事后续', verifyStatus: 'UNVERIFIED' }));
    await insertRecord(rec({ question: '乙事', verifyStatus: 'VERIFIED' }));

    expect((await queryRecords({ keyword: '甲事' })).length).toBe(2);
    expect((await queryRecords({ keyword: '甲事', verifyStatus: 'VERIFIED' })).length).toBe(1);
    expect((await queryRecords({ verifyStatus: 'ALL' })).length).toBe(3);
  });

  it('TC-D03 更新备注与应验状态，字段更新且 updatedAt 刷新', async () => {
    const { insertRecord, getRecord, updateRecord } = await freshRecords();
    const id = await insertRecord(rec({ createdAt: 1_000, updatedAt: 1_000 }));
    const before = (await getRecord(id)) as HexagramRecord;

    await updateRecord({ ...before, note: '事后补记', verifyStatus: 'VERIFIED', updatedAt: 2_000 });

    const after = (await getRecord(id)) as HexagramRecord;
    expect(after.note).toBe('事后补记');
    expect(after.verifyStatus).toBe('VERIFIED');
    expect(after.updatedAt).toBe(2_000);
    expect(after.createdAt).toBe(1_000); // 起卦时间不得被改写
    expect(idb.size()).toBe(1); // 更新而非新增
  });

  it('TC-D04 删除后重查，列表不再包含该条', async () => {
    const { insertRecord, listRecords, deleteRecord, countRecords } = await freshRecords();
    const a = await insertRecord(rec({ createdAt: 100, question: '甲' }));
    const b = await insertRecord(rec({ createdAt: 200, question: '乙' }));

    await deleteRecord(a);

    expect(await countRecords()).toBe(1);
    expect((await listRecords()).map((r) => r.question)).toEqual(['乙']);
    expect(await getRecordSafe(b)).toBe('乙');
  });

  it('TC-D04b 删除不存在的 id 不抛异常（幂等）', async () => {
    const { deleteRecord, countRecords } = await freshRecords();
    await expect(deleteRecord(9999)).resolves.toBeUndefined();
    expect(await countRecords()).toBe(0);
  });

  it('TC-D06 enforceRecordLimit(500) 于 501 条数据：仅删最旧 1 条，返回 1', async () => {
    const { insertRecord, enforceRecordLimit, countRecords, listRecords } = await freshRecords();
    // createdAt 越大越新；构造 501 条，最旧的是 createdAt = 0
    for (let i = 0; i < 501; i++) await insertRecord(rec({ createdAt: i, question: `第${i}条` }));

    const removed = await enforceRecordLimit(500);

    expect(removed).toBe(1);
    expect(await countRecords()).toBe(500);
    const all = await listRecords();
    expect(all.some((r) => r.question === '第0条')).toBe(false); // 最旧的被清掉
    expect(all.some((r) => r.question === '第500条')).toBe(true); // 最新的保留
  });

  it('TC-D06b 不超上限 / 上限为 0 时不做任何删除', async () => {
    const { insertRecord, enforceRecordLimit, countRecords } = await freshRecords();
    await insertRecord(rec({ createdAt: 1 }));
    await insertRecord(rec({ createdAt: 2 }));

    expect(await enforceRecordLimit(10)).toBe(0);
    expect(await enforceRecordLimit(0)).toBe(0);
    expect(await countRecords()).toBe(2);
  });

  it('清空全部卦例后计数归零', async () => {
    const { insertRecord, clearRecords, countRecords } = await freshRecords();
    await insertRecord(rec());
    await insertRecord(rec());
    await clearRecords();
    expect(await countRecords()).toBe(0);
  });

  /**
   * 审查 W-5：打开失败不能污染 dbPromise。
   *
   * 隐私模式 / 站点数据被禁时 indexedDB.open 会报错；原实现把已 reject 的
   * promise 永久缓存在模块级变量里，此后每次读写都复用同一个失败结果，
   * 用户会一直看到「读取卦例失败」直到手动刷新。
   * 这里模拟「第一次打开失败 → 第二次成功」，断言第二次能自愈。
   */
  it('TC-D09 打开失败后自动复位，下一次调用可自愈（W-5）', async () => {
    vi.resetModules();
    idb.reset();

    let failNext = true;
    const realIDB = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    (globalThis as Record<string, unknown>).indexedDB = {
      open(...args: unknown[]) {
        if (failNext) {
          failNext = false;
          const req: Record<string, unknown> = {};
          setTimeout(() => {
            req.error = new Error('模拟：站点数据被禁用');
            (req.onerror as (() => void) | undefined)?.();
          }, 0);
          return req;
        }
        return (realIDB as IDBFactory).open(...(args as [string, number]));
      },
    };

    try {
      const { countRecords } = await import('@/platform/records');
      await expect(countRecords()).rejects.toThrow('模拟：站点数据被禁用');
      // 关键：复位后第二次应能成功，而不是复用同一个已 reject 的 promise
      await expect(countRecords()).resolves.toBe(0);
    } finally {
      (globalThis as Record<string, unknown>).indexedDB = realIDB;
    }
  });
});

/** 便捷读取（避免在用例里重复断言类型） */
async function getRecordSafe(id: number): Promise<string | null> {
  const { getRecord } = await import('@/platform/records');
  return (await getRecord(id))?.question ?? null;
}
