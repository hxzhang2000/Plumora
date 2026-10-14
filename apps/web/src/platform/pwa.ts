/* ============================================================
 * PWA / Service Worker 注册地址计算 —— 单独抽出以便单测
 *
 * 为什么值得单独一个函数：注册地址写成绝对路径 `/sw.js` 时，
 * 在**子目录部署**（如 GitHub Pages 的 https://<user>.github.io/Plumora/）
 * 下会解析到站点根 `https://<user>.github.io/sw.js` → 404 → SW 静默注册失败，
 * 离线与「添加到主屏幕」全部悄悄失效，且没有任何报错。（真实踩过的坑）
 *
 * 正确做法：以 document.baseURI 为基准解析相对地址，与 vite 的 `base: './'` 一致；
 * 并带上版本 query，使每次发版都被识别为新脚本、缓存名随之更新。
 * ============================================================ */

/**
 * 由页面基准地址与版本号算出 SW 脚本地址。
 * @param baseUri 通常是 document.baseURI（末尾是否带斜杠都可）
 * @param version 应用版本号，如 '0.6.0'
 */
export function serviceWorkerUrl(baseUri: string, version: string): string {
  return new URL(`sw.js?v=${encodeURIComponent(version)}`, baseUri).toString();
}
