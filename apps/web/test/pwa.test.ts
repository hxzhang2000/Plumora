/* ============================================================
 * PWA 注册地址测试
 *
 * 钉住一个真实踩过的坑：SW 注册地址若写成绝对路径 '/sw.js'，
 * 在子目录部署（GitHub Pages 项目页 https://<user>.github.io/<repo>/）
 * 下会 404，Service Worker 静默注册失败、离线与可安装全部失效且无任何报错。
 * ============================================================ */

import { describe, expect, it } from 'vitest';
import { serviceWorkerUrl } from '@/platform/pwa';

describe('serviceWorkerUrl', () => {
  it('子目录部署：解析到仓库子目录下，而不是站点根', () => {
    const url = serviceWorkerUrl('https://hxzhang2000.github.io/Plumora/', '0.6.0');
    expect(url).toBe('https://hxzhang2000.github.io/Plumora/sw.js?v=0.6.0');
    expect(url.startsWith('https://hxzhang2000.github.io/sw.js')).toBe(false);
  });

  it('根部署（base 为 /）：解析到站点根', () => {
    expect(serviceWorkerUrl('https://example.com/', '1.2.3')).toBe(
      'https://example.com/sw.js?v=1.2.3',
    );
  });

  it('页面为 index.html 时，兄弟目录而非其下', () => {
    expect(serviceWorkerUrl('https://example.com/app/index.html', '0.6.0')).toBe(
      'https://example.com/app/sw.js?v=0.6.0',
    );
  });

  it('版本号进入 query，使每次发版被识别为新脚本', () => {
    expect(serviceWorkerUrl('https://example.com/', '0.6.1')).toContain('v=0.6.1');
  });
});
