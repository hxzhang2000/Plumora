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

import {
  judge,
  resolve,
  VERIFY_STATUS_LIST,
  type CastMethod,
  type HexagramRecord,
  type NewHexagramRecord,
  type TiYongRule,
  type VerifyStatus,
} from '@plumora/core';
import { trigram, type TrigramNumber } from '@plumora/knowledge';
import { requestPersistentStorage } from '@/platform/storage';

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
  // 用户刚明确保存了一条卦例 —— 此刻申请持久存储通过率最高（理由见 platform/storage.ts）
  void requestPersistentStorage();
  return Number(key);
}

export async function updateRecord(rec: HexagramRecord): Promise<void> {
  await run('readwrite', (s) => s.put(rec));
}

export async function deleteRecord(id: number): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}

/**
 * 批量写入（导入用）——单事务，全部成功或全部回滚。
 *
 * 为什么不用循环调 insertRecord：那样每条一个事务，中途失败会留下「导入了一半」
 * 的半吊子状态，且用户无法判断该不该重试。这里用一个 readwrite 事务，
 * 任一条 add 出错即 abort，库回到导入前状态。
 *
 * @param replace true = 覆盖模式（先清空再写入）；false = 合并模式（追加）
 * @returns 实际写入条数
 */
export async function insertRecords(
  records: readonly NewHexagramRecord[],
  replace = false,
): Promise<number> {
  if (!records.length) return 0;
  const db = await openDatabase();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (replace) store.clear();
    for (const rec of records) store.add(rec);
    tx.oncomplete = () => {
      // 导入同样是一次明确的「我要长期留着这些卦例」的表态
      void requestPersistentStorage();
      resolve(records.length);
    };
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 批量写入失败'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 批量写入被中止'));
  });
}

/**
 * 原样回写（**保留 id**）——用于「撤销删除 / 撤销清空」。
 *
 * 与 insertRecords 的区别：用 put 而非 add，因此原主键被保留。
 * 撤销的意义就在于「当作没发生过」——若换了新 id，用户之前打开的详情链接、
 * 以及刚吞下「已删除」的那条记录会对不上号。单事务，全成或全回滚。
 */
export async function restoreRecords(records: readonly HexagramRecord[]): Promise<number> {
  if (!records.length) return 0;
  const db = await openDatabase();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const rec of records) store.put(rec);
    tx.oncomplete = () => resolve(records.length);
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 回写失败'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 回写被中止'));
  });
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

/* ---------- 导入（导出文件的反向还原，FR-08 补全） ---------- */

/** 导入结果：成功条数 + 逐条丢弃原因（供 UI 给出可读反馈） */
export interface ImportOutcome {
  /** 通过校验、已归一化、可落库的记录（id 由存储层重新分配） */
  readonly accepted: NewHexagramRecord[];
  /** 因字段非法而丢弃的记录：第 n 条（1 起）+ 原因 */
  readonly rejected: { readonly index: number; readonly reason: string }[];
}

/** 导入失败（文件级错误，非单条记录问题）时抛出 */
export class ImportError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** 1–8 的整数先天数；非法返回 null */
function asTrigramNo(v: unknown): TrigramNumber | null {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 8
    ? (v as TrigramNumber)
    : null;
}

/** 有限数字（epoch millis），非法返回 null */
function asMillis(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

function asNullableText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

const VALID_RULES: readonly TiYongRule[] = ['MOVING_LINE', 'UPPER_YONG_LOWER_TI'];

/**
 * 解析导出文件 → 可落库记录。
 *
 * 设计取舍：
 *   - **结构错误整包拒绝**（抛 {@link ImportError}）：schemaVersion 不符、records 不是数组，
 *     说明文件根本不是本应用的导出物，逐条容错只会把半个错文件写进库。
 *   - **单条错误逐条丢弃**（记入 rejected）：一条记录脏了不该连累其余 99 条。
 *   - **派生字段全部重算**：只信任四要素（upper/lower/moving/tiYongRule）+ 体用 + 时间等；
 *     `benGuaCode`/`benGuaName`/`huGuaCode`/`bianGuaCode`/`relation` 一律用知识库重推，
 *     避免手工改过的旧文件把与卦体不符的冗余列带进库。
 *   - **体用**：优先用落库的 tiTrigram/yongTrigram（历史口径的凭据，replayRecord 亦以此为准），
 *     缺失或非法时回退到按 tiYongRule 现推，保证导入后必定自洽。
 */
export function parseExportBundle(input: unknown): ImportOutcome {
  if (!isObj(input)) throw new ImportError('文件内容不是 JSON 对象');
  if (input.schemaVersion !== 1) {
    throw new ImportError(`不支持的 schemaVersion：${String(input.schemaVersion ?? '（缺失）')}`);
  }
  if (!Array.isArray(input.records)) throw new ImportError('records 字段缺失或不是数组');

  const accepted: NewHexagramRecord[] = [];
  const rejected: { index: number; reason: string }[] = [];

  input.records.forEach((raw, i) => {
    const index = i + 1;
    if (!isObj(raw)) {
      rejected.push({ index, reason: '不是对象' });
      return;
    }

    const upper = asTrigramNo(raw.upperTrigram);
    const lower = asTrigramNo(raw.lowerTrigram);
    const moving = Number.isInteger(raw.movingLine) && (raw.movingLine as number) >= 1 && (raw.movingLine as number) <= 6
      ? (raw.movingLine as number)
      : null;
    if (upper === null || lower === null || moving === null) {
      rejected.push({ index, reason: '上卦 / 下卦 / 动爻非法' });
      return;
    }

    const rule: TiYongRule = VALID_RULES.includes(raw.tiYongRule as TiYongRule)
      ? (raw.tiYongRule as TiYongRule)
      : 'MOVING_LINE';

    // 以上下卦 + 动爻重推本 · 互 · 变与体用关系，杜绝文件里的冗余列与卦体打架
    const resolved = resolve(upper, lower, moving, rule);

    const tiRaw = asTrigramNo(raw.tiTrigram);
    const yongRaw = asTrigramNo(raw.yongTrigram);
    const ti = tiRaw ?? resolved.ti;
    const yong = yongRaw ?? resolved.yong;

    const createdAt = asMillis(raw.createdAt) ?? Date.now();
    const updatedAt = asMillis(raw.updatedAt) ?? createdAt;

    const verifyStatus: VerifyStatus = VERIFY_STATUS_LIST.includes(raw.verifyStatus as VerifyStatus)
      ? (raw.verifyStatus as VerifyStatus)
      : 'UNVERIFIED';

    const question = asNullableText(raw.question);
    // 所问之事 ≤200 字（04 §2.2），超长截断而非丢弃
    const questionClipped = question && question.length > 200 ? question.slice(0, 200) : question;

    accepted.push({
      createdAt,
      updatedAt,
      method: (typeof raw.method === 'string' ? raw.method : 'TIME') as CastMethod,
      // inputParams 原样保留（复现起卦上下文用，结构由 core 定义，导入侧不做语义校验）
      inputParams: typeof raw.inputParams === 'string' ? raw.inputParams : '{}',
      lunarLabel: typeof raw.lunarLabel === 'string' && raw.lunarLabel.trim() ? raw.lunarLabel : '—',
      upperTrigram: upper,
      lowerTrigram: lower,
      movingLine: moving,
      benGuaCode: resolved.ben.code,
      benGuaName: resolved.ben.name,
      huGuaCode: resolved.hu.code,
      bianGuaCode: resolved.bian.code,
      tiTrigram: ti,
      yongTrigram: yong,
      tiYongRule: rule,
      relation: judge(trigram(ti), trigram(yong)).relation,
      question: questionClipped,
      note: asNullableText(raw.note),
      verifyStatus,
    });
  });

  return { accepted, rejected };
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
