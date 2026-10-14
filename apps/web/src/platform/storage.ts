/* ============================================================
 * 持久化存储 —— 请求「持久存储」（Storage Bucket persistence）
 *
 * 为什么需要：卦例 100% 存在本机 IndexedDB 里，浏览器在**存储压力**下
 * （磁盘紧张、长期未访问、隐私清理策略）可以把整个源站的存储**整体清掉**，
 * 且不会询问用户。对一款「用户攒了几百条卦例」的应用来说，这是静默丢数据。
 *
 * `navigator.storage.persist()` 一旦获批，该源站的存储就变为 persistent，
 * 浏览器在清理时不会再自动删除（只有用户主动清站点数据才会没）。
 *
 * 调用时机：**在用户明确保存卦例之后**再申请。规范允许浏览器自行决定
 * （Chrome 依据站点参与度heuristics，Firefox 可能弹权限询问），
 * 放在「刚存下一条卦例」这个用户意图明确的时间点，通过率最高，
 * 也不会在用户还没用起来时就弹窗打扰。
 *
 * 全部失败路径静默降级：不支持 / 被拒 / 抛异常都只是「维持现状」，
 * 不影响任何功能。
 * ============================================================ */

interface PersistCapableNav {
  storage?: StorageManager & {
    persisted?: () => Promise<boolean>;
    persist?: () => Promise<boolean>;
  };
}

/**
 * 申请持久存储。返回最终是否处于 persistent 状态。
 * 已获批时直接返回 true（幂等，反复调用无副作用）。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const manager = (navigator as PersistCapableNav | undefined)?.storage;
    if (!manager || typeof manager.persist !== 'function') return false;
    if (typeof manager.persisted === 'function' && (await manager.persisted())) return true;
    return await manager.persist();
  } catch {
    return false;
  }
}
