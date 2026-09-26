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

/**
 * 给候选主机名打分（越大越适合给手机扫码）。
 *
 * 为什么不能直接取 vite 的 `resolvedUrls.network[0]`：那个数组按网卡枚举顺序排列，
 * 虚拟网卡（Tailscale / ZeroTier 的 100.64.0.0/10 段、VMware VMnet 的 x.x.x.1 宿主
 * 地址）可能排在真实 Wi-Fi 前面，手机扫出来是虚拟网卡地址，连不上。所以要按地址段
 * 打分挑选。
 *
 * 分档：
 *   5  192.168/16（末位 ≠ 1）     家庭 / 小型路由最常用
 *   4  10/8、172.16/12（末位 ≠ 1）企业 / 大网（RFC1918）
 *   3  其它公网 / 不明 IPv4
 *   2  RFC1918 内末位 = 1 —— VMware VMnet / VirtualBox host-only / Hyper-V /
 *      Windows ICS 等虚拟网卡宿主地址都默认占 x.x.x.1（真实路由占 .1、DHCP 不会发 .1）
 *   1  CGNAT 100.64/10（Tailscale 等）、IPv6 ULA / 其它 IPv6
 *   0  link-local（169.254/16、fe80::）——不可达
 */
const LAN_MIN_SCORE = 3; // 只有 RFC1918 真实局域网才算「真实局域网」

function hostScore(host: string): number {
  const clean = host.replace(/^\[|\]$/g, '');
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(clean);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    const d = Number(ipv4[4]);
    if (a === 169 && b === 254) return 0; // link-local
    if (a === 100 && b >= 64 && b <= 127) return 1; // CGNAT（虚拟网卡）
    if (a === 192 && b === 168) return d === 1 ? 2 : 5;
    if (a === 10) return d === 1 ? 2 : 4;
    if (a === 172 && b >= 16 && b <= 31) return d === 1 ? 2 : 4;
    return 3;
  }
  const lower = clean.toLowerCase();
  if (lower.startsWith('fe80')) return 0; // IPv6 link-local
  if (lower.startsWith('fd') || lower.startsWith('fc')) return 1; // IPv6 ULA
  return 1;
}

/** 从 dev server 给的候选里挑「最适合扫码」的那个（最高分，平手取先出现者）。
 *  只认 RFC1918 真实局域网（≥ LAN_MIN_SCORE）：若候选全是虚拟网卡 / link-local，
 *  换过去照样扫不开，不如不换。 */
function pickBestLanUrl(): string | null {
  let best: string | null = null;
  let bestScore = LAN_MIN_SCORE - 1;
  for (const raw of lanUrls()) {
    try {
      const score = hostScore(new URL(raw).hostname);
      if (score > bestScore) {
        bestScore = score;
        best = raw;
      }
    } catch {
      /* 跳过不合法地址 */
    }
  }
  return best;
}

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
 *   1. 当前已是真实局域网地址（RFC1918 私网）→ 原样返回（保留 path + query + hash）
 *   2. 回环地址 或 当前是虚拟网卡 / link-local 等不可扫地址，
 *      且候选里有真实局域网地址 → 换过去（保留 path + query + hash）
 *   3. 回环地址且没有真实局域网候选 → 仍返回原地址，但 note 说明扫不了
 *
 * 为什么不能直接取 `resolvedUrls.network[0]`：该数组按网卡枚举顺序排列，
 * Tailscale / ZeroTier 等虚拟网卡（100.64.0.0/10）可能排在真实 Wi-Fi 前面，
 * 取 [0] 会把虚拟网卡地址做进二维码，手机连不上（见 hostScore 的分档说明）。
 */
export function shareTarget(): ShareTarget {
  const { href, hostname, pathname, search, hash } = location;
  const tail = `${pathname}${search}${hash}`;

  const isLoopback = LOOPBACK_HOSTS.has(hostname);
  const currentScore = hostScore(hostname);

  // 当前已经是真实局域网地址 → 原样返回，不做无谓改写
  if (!isLoopback && currentScore >= LAN_MIN_SCORE) {
    return { url: href, viaLan: false, note: '' };
  }

  // 需要换：回环地址，或当前是虚拟网卡 / link-local 等手机扫不开的地址
  const best = pickBestLanUrl();
  if (best) {
    try {
      const origin = new URL(best).origin;
      return {
        url: `${origin}${tail}`,
        viaLan: true,
        note: '已换成局域网地址：手机需与本机连同一个 Wi-Fi，且本机防火墙放行该端口。',
      };
    } catch {
      /* 地址不合法就走下面的兜底 */
    }
  }

  // 回环且没有可用候选 → 明确提示扫不了
  if (isLoopback) {
    return {
      url: href,
      viaLan: false,
      note: '当前是本机地址（localhost），手机扫了打不开。用 start.bat 启动时 dev server 会同时监听局域网，刷新本页即可扫码。',
    };
  }

  // 非回环但候选里没有真实局域网（只剩虚拟网卡地址等）→ 原样返回
  return { url: href, viaLan: false, note: '' };
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
