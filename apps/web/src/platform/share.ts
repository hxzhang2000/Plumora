/* ============================================================
 * 跨设备打开 —— 决定「扫码后在手机上打开哪个地址」
 *
 * 关键难点：浏览器 JS **拿不到本机的局域网 IP**。
 * 用户在电脑上开着 `http://localhost:5173/#/cast`，把这个地址做成二维码，
 * 手机扫出来是它自己的 localhost —— 打不开，而且用户完全看不出为什么。
 *
 * 所以：dev server 必须同时监听局域网（vite.config.ts 的 server.host），
 * 并把解析到的局域网地址写进页面 meta（vite 的 resolvedUrls.network，
 * 浏览器算不出来、只有 dev server 知道）。本模块负责在两者之间选一个。
 * ============================================================ */

/** 回环 / 通配地址：手机扫了也打不开 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]', '']);

/** dev server 写在页面里的局域网地址；生产构建下为空 */
export function lanUrls(): string[] {
  if (typeof document === 'undefined') return [];
  const meta = document.querySelector('meta[name="plumora-lan-urls"]');
  const raw = meta?.getAttribute('content') ?? '';
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
  } catch {
    return [];
  }
}

export interface ShareTarget {
  /** 可直接扫码 / 复制的绝对 URL，含当前路由的 hash */
  readonly url: string;
  /** 是否把回环地址换成了局域网地址 */
  readonly viaLan: boolean;
  /** 界面提示：能不能扫、为什么 */
  readonly note: string;
}

/**
 * 算出当前页面「给手机扫」的地址。
 *
 * 优先级：
 *   1. 已经是局域网 / 公网地址 → 原样返回（保留 path + query + hash）
 *   2. 回环地址且有局域网地址 → 换过去（保留 path + query + hash）
 *   3. 回环地址且没有局域网地址 → 仍返回原地址，但 note 说明扫不了
 */
export function shareTarget(): ShareTarget {
  const { href, hostname, pathname, search, hash } = location;
  const tail = `${pathname}${search}${hash}`;

  if (!LOOPBACK_HOSTS.has(hostname)) {
    return { url: href, viaLan: false, note: '' };
  }

  const first = lanUrls()[0];
  if (first) {
    try {
      const origin = new URL(first).origin;
      return {
        url: `${origin}${tail}`,
        viaLan: true,
        note: '已换成局域网地址：手机需与本机连同一个 Wi-Fi，且本机防火墙放行该端口。',
      };
    } catch {
      /* 地址不合法就走下面的兜底 */
    }
  }

  return {
    url: href,
    viaLan: false,
    note: '当前是本机地址（localhost），手机扫了打不开。用 start.bat 启动时 dev server 会同时监听局域网，刷新本页即可扫码。',
  };
}

/**
 * 复制文本到剪贴板。
 *
 * 局域网 http 页面**不是安全上下文**，`navigator.clipboard` 在那里是 undefined
 * （而这个功能恰恰多半用在局域网调试场景）。故降级到 textarea + execCommand。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 权限被拒 → 走降级 */
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
