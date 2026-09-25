/* ============================================================
 * 卦例记录持久化 —— 对应 04 文档 §二 Room 数据库的 Web 等价实现
 *
 * Web 端用 IndexedDB（替代 Room/SQLite）：
 *   - 对象仓库 hexagram_record，keyPath = id，autoIncrement（对应 04 §2.2 PK autoGenerate）
 *   - 索引 createdAt / benGuaCode / verifyStatus（对应 04 §2.2 的三条索引）
 *   - 数据 100% 留在本机，不联网（NFR-02 / NFR-03）
 *
 * ⚠️ 结构变更必须 DB_VERSION + 1 并写迁移（对应 04 §2.6），
 *    禁止删库重建（destructive migration）。
 * ============================================================ */

import type { HexagramRecord, NewHexagramRecord, VerifyStatus } from '@plumora/core';

const DB_NAME = 'plumora';
const DB_VERSION = 1;
const STORE = 'hexagram_record';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前环境不支持 IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('benGuaCode', 'benGuaCode');
        store.createIndex('verifyStatus', 'verifyStatus');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'));
    // onblocked = 另一个标签页仍持有旧版本连接。此时 open 请求**依然挂起**，
    // 待对方关闭后会继续并触发 onsuccess——所以只提示、不 reject：
    // reject 会让 resolve 变成空操作，等于把随后到手的连接直接丢掉且永不关闭。
    req.onblocked = () => {
      console.warn('[plumora] IndexedDB 被其他标签页占用，正在等待其释放…');
    };
  });
  // 打开失败（隐私模式 / 站点数据被禁 / onerror）不能污染缓存：
  // 复位 dbPromise，让下一次调用重新尝试；否则此后每次读写都复用同一个
  // 已 reject 的 promise，用户会永久看到「读取卦例失败」直到手动刷新（审查 W-5）。
  dbPromise = opening.catch((e: unknown) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作失败'));
      }),
  );
}

/* ---------- CRUD ---------- */

/** 新增一条记录，返回分配到的 id */
export async function insertRecord(rec: NewHexagramRecord): Promise<number> {
  const key = await run<IDBValidKey>('readwrite', (s) => s.add(rec));
  return Number(key);
}

export async function updateRecord(rec: HexagramRecord): Promise<void> {
  await run('readwrite', (s) => s.put(rec));
}

export async function deleteRecord(id: number): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}

export async function clearRecords(): Promise<void> {
  await run('readwrite', (s) => s.clear());
}

export async function getRecord(id: number): Promise<HexagramRecord | undefined> {
  return run<HexagramRecord | undefined>('readonly', (s) => s.get(id) as IDBRequest<HexagramRecord | undefined>);
}

/** 全部记录，按起卦时间倒序（04 §2.3 observeAll） */
export async function listRecords(): Promise<HexagramRecord[]> {
  const all = await run<HexagramRecord[]>('readonly', (s) => s.getAll() as IDBRequest<HexagramRecord[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function countRecords(): Promise<number> {
  return run<number>('readonly', (s) => s.count());
}

/* ---------- 查询（04 §2.3 search 的 Web 等价实现） ---------- */

export interface RecordQuery {
  /** 关键字：命中所问之事 / 备注 / 本卦卦名（与 04 §2.3 的 SQL 三列一致） */
  readonly keyword?: string;
  readonly verifyStatus?: VerifyStatus | 'ALL';
}

export async function queryRecords(q: RecordQuery = {}): Promise<HexagramRecord[]> {
  const kw = (q.keyword ?? '').trim().toLowerCase();
  const status = q.verifyStatus ?? 'ALL';
  return (await listRecords()).filter((r) => {
    if (status !== 'ALL' && r.verifyStatus !== status) return false;
    if (!kw) return true;
    return (
      (r.question ?? '').toLowerCase().includes(kw) ||
      (r.note ?? '').toLowerCase().includes(kw) ||
      r.benGuaName.toLowerCase().includes(kw)
    );
  });
}

/* ---------- 保留上限（04 §3 record_limit / §六） ---------- */

/**
 * 按上限裁剪最旧记录。
 * @param limit 0 = 不限制
 * @returns 被删除的条数
 */
export async function enforceRecordLimit(limit: number): Promise<number> {
  if (!limit || limit <= 0) return 0;
  const all = await listRecords(); // 已按 createdAt 倒序
  if (all.length <= limit) return 0;
  const stale = all.slice(limit);
  for (const r of stale) await deleteRecord(r.id);
  return stale.length;
}

/* ---------- 导出（FR-08 / 04 §五） ---------- */

export interface ExportBundle {
  readonly schemaVersion: 1;
  readonly exportedAt: string;
  readonly app: '观梅 · Plumora';
  readonly records: HexagramRecord[];
}

/** JSON 导出（全字段，数组按 createdAt 升序 —— 04 §五） */
export function toExportBundle(records: readonly HexagramRecord[]): ExportBundle {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: '观梅 · Plumora',
    records: [...records].sort((a, b) => a.createdAt - b.createdAt),
  };
}

const CSV_HEADER = [
  '时间',
  '农历',
  '方式',
  '所问之事',
  '本卦',
  '互卦',
  '变卦',
  '动爻',
  '体用',
  '关系',
  '备注',
  '应验状态',
];

/** CSV 导出（列序见 04 §五；调用方需加 UTF-8 BOM 保证 Excel 不乱码） */
export function toCsv(
  records: readonly HexagramRecord[],
  lookup: {
    hexName: (code: string) => string;
    lineName: (r: HexagramRecord) => string;
    tiYong: (r: HexagramRecord) => string;
    methodCn: (r: HexagramRecord) => string;
    verifyCn: (r: HexagramRecord) => string;
  },
): string {
  /**
   * CSV 字段转义。
   *
   * ⚠️ 除引号 / 换行转义外，还必须中和**公式注入**：Excel / WPS / Numbers 会把
   * 以 `=` `+` `-` `@`（含前导 Tab、CR）开头的单元格当公式求值。用户在「所问之事」
   * 或备注里写 `=cmd|' /C calc'!A0`，导出后自己打开、或把文件发给别人打开，
   * 都会触发 DDE / 公式执行——引号包裹只是字段分隔转义，挡不住这个（审查 W-6）。
   * 前缀一个单引号即可让表格软件按纯文本处理（Excel 自身的文本转义约定）。
   */
  const esc = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [...records]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) =>
      [
        new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }),
        r.lunarLabel,
        lookup.methodCn(r),
        r.question ?? '',
        r.benGuaName,
        lookup.hexName(r.huGuaCode),
        lookup.hexName(r.bianGuaCode),
        lookup.lineName(r),
        lookup.tiYong(r),
        r.relation,
        r.note ?? '',
        lookup.verifyCn(r),
      ]
        .map(esc)
        .join(','),
    );
  return [CSV_HEADER.join(','), ...rows].join('\r\n');
}

/** 触发浏览器下载 */
export function downloadFile(filename: string, content: string, mime: string): void {
  const bom = mime.includes('csv') ? '\uFEFF' : '';
  const blob = new Blob([bom + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 文件名：guanmei_export_yyyyMMdd_HHmmss.ext（04 §五） */
export function exportFilename(ext: string, at = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `guanmei_export_${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}_${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}.${ext}`;
}
