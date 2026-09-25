/* ============================================================
 * 最小 IndexedDB 替身 —— 仅供运行时冒烟（scripts/runtime-smoke.cjs）使用
 *
 * 为什么需要它：jsdom **不实现 IndexedDB**，于是 platform/records.ts 会直接
 * reject，卦例列表永远只有空态 / 报错态。结果是「保存卦例 → 列表按名称显示」
 * 这条链路在冒烟里完全测不到——而它恰好是最容易悄悄坏掉的部分。
 *
 * 只实现 platform/records.ts 实际用到的子集：
 *   indexedDB.open / db.transaction / objectStoreNames.contains / createObjectStore / createIndex
 *   store.add / put / get / getAll / delete / clear / count
 *
 * 两条必须遵守的时序约定（否则会得到「永远通过」的假护栏）：
 *   ① 所有请求**异步**回调。platform/records.ts 的 run() 是
 *      `const req = fn(store); req.onsuccess = ...` —— 先拿请求、后挂回调，
 *      同步 fire 会让回调丢在赋值之前。
 *   ② 回调通过 `req.onsuccess({ target: req })` 触发，与浏览器一致
 *      （代码里用的是 `req.result` / `req.error`，但保留 target 以防调用方改用 e.target）。
 *
 * ⚠️ 它只服务于冒烟。真实持久化行为（事务隔离、索引、版本迁移）一律以浏览器为准，
 *    不要用这个替身去验证 04 文档 §2.6 的迁移语义。
 *
 * ③ 调度器可注入（见 `installIndexedDB(target, { scheduler })`）。默认 `setTimeout(fn, 0)`，
 *    与浏览器「请求回调落在后续任务」一致；但 **Windows 上 `setTimeout(0)` 的实际粒度约
 *    15.6ms**（系统时钟节拍），一次 `insertRecord` 就吃掉一个节拍。批量用例（如
 *    TC-D06 的 501 条）因此要 7 秒以上。需要跑大批量时传 `scheduler: queueMicrotask`：
 *    仍然是「回调在赋值之后才触发」（满足 ①），只是不再吃时钟节拍。
 * ============================================================ */

/** 构造一个 IDBRequest 形状的对象 */
function makeRequest() {
  return { result: undefined, error: null, onsuccess: null, onerror: null };
}

/* 护栏自检开关：置位后替身**故意不落库**，用来验证冒烟里的 #卦例名称 断言
 * 真的会因为「替身空转」而失败——永远通过的护栏等于没有护栏。
 *
 *   IDB_STUB_SELFTEST=1 node scripts/runtime-smoke.cjs   → 必须 FAIL 且 exit 1
 */
const SELFTEST_SKIP_WRITE = process.env.IDB_STUB_SELFTEST === '1';

/** 默认调度器：下一个宏任务（贴近浏览器行为，但吃时钟节拍） */
const defaultScheduler = (fn) => setTimeout(fn, 0);

/** 异步派发成功回调（见文件头 ①） */
function ok(req, value, scheduler = defaultScheduler) {
  req.result = value;
  scheduler(() => {
    if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
  });
}

function fail(req, message, scheduler = defaultScheduler) {
  req.error = new Error(message);
  scheduler(() => {
    if (typeof req.onerror === 'function') req.onerror({ target: req });
  });
}

/**
 * 把一个内存对象仓库挂到 `target.indexedDB` 上。
 *
 * @param {object} target 通常是 jsdom 的 window
 * @param {object} [opts]
 * @param {string} [opts.keyPath] 主键字段名，默认 'id'
 * @param {boolean} [opts.autoIncrement] 是否自增，默认 true
 * @param {(fn: () => void) => void} [opts.scheduler] 回调调度器，默认 setTimeout(fn, 0)。
 *        批量用例可传 queueMicrotask 绕开 Windows 15.6ms 时钟节拍（见文件头 ③）。
 * @returns {{ rows: Map<number, object>, reset: () => void, size: () => number }}
 *          暴露内部状态，便于断言「替身真的存进去了」（防止护栏空转）
 */
function installIndexedDB(target, opts = {}) {
  const keyPath = opts.keyPath ?? 'id';
  const autoIncrement = opts.autoIncrement ?? true;
  const scheduler = opts.scheduler ?? defaultScheduler;

  /** storeName -> Map<id, record> */
  const stores = new Map();
  let nextId = 1;

  function getStore(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  }

  function makeStore(name) {
    const rows = getStore(name);
    return {
      keyPath,
      autoIncrement,
      createIndex() {
        return {};
      },
      add(rec) {
        const req = makeRequest();
        const id = autoIncrement ? nextId++ : rec[keyPath];
        if (autoIncrement) rec[keyPath] = id;
        if (!SELFTEST_SKIP_WRITE) rows.set(id, rec);
        ok(req, id, scheduler);
        return req;
      },
      put(rec) {
        const req = makeRequest();
        // 与 add() 同样受自检开关控制（审查 I-9）：
        // 当前保存走 add()，故自检有效；但将来保存若改走 put()，
        // 漏掉这一处会让 IDB_STUB_SELFTEST=1 显示 PASS 却什么也没验证。
        if (!SELFTEST_SKIP_WRITE) rows.set(rec[keyPath], rec);
        ok(req, rec[keyPath], scheduler);
        return req;
      },
      get(id) {
        const req = makeRequest();
        ok(req, rows.get(id), scheduler);
        return req;
      },
      getAll() {
        const req = makeRequest();
        ok(req, [...rows.values()], scheduler);
        return req;
      },
      delete(id) {
        const req = makeRequest();
        rows.delete(id);
        ok(req, undefined, scheduler);
        return req;
      },
      clear() {
        const req = makeRequest();
        rows.clear();
        ok(req, undefined, scheduler);
        return req;
      },
      count() {
        const req = makeRequest();
        ok(req, rows.size, scheduler);
        return req;
      },
    };
  }

  target.indexedDB = {
    open(name) {
      const req = makeRequest();
      const storeNames = {
        contains: (n) => stores.has(n),
      };
      const db = {
        objectStoreNames: storeNames,
        createObjectStore: (n) => makeStore(n),
        transaction: (n) => ({ objectStore: () => makeStore(n) }),
      };
      req.result = db;
      // 首次打开 → version 0 → 1，必然触发 upgradeneeded（与浏览器一致）
      scheduler(() => {
        if (typeof req.onupgradeneeded === 'function') req.onupgradeneeded({ target: req });
        if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
      });
      return req;
    },
  };

  return {
    rows: getStore('hexagram_record'),
    reset() {
      stores.clear();
      nextId = 1;
    },
    size() {
      return [...stores.values()].reduce((n, m) => n + m.size, 0);
    },
  };
}

module.exports = { installIndexedDB, makeRequest, ok, fail };
