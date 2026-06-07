/**
 * Theme Engine — 前端主题渲染
 *
 * Gion 的 Headless CMS → 前端主题桥接层。
 *
 * 架构：
 *   /           → 渲染默认主题（index.html with injected config）
 *   /post/slug  → 渲染文章详情
 *   /page/slug  → 渲染页面
 *   /category/slug → 渲染分类列表
 *   /api/*      → 透传 CMS API（同源，无 CORS 问题）
 *
 * 主题文件：
 *   默认主题：packages/server/public/theme/index.html
 *   自定义主题：.gion/themes/{theme-name}/index.html
 *
 * 主题配置：
 *   GET /api/site-settings → { theme: { primaryColor, fontFamily, ... } }
 *   主题 HTML 通过内嵌 <script>window.__GION__ = {...}</script> 获取配置
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getStore } from './context.js';

const THEME_DIR = join(process.cwd(), '.gion', 'themes');
const DEFAULT_THEME = join(import.meta.dirname || join(process.cwd(), 'packages', 'server', 'src'), '..', 'public', 'theme', 'index.html');

/**
 * Render the frontend theme for a given path.
 * @param {import('./context.js').Context} ctx
 */
export async function renderTheme(ctx) {
  const { pathname } = ctx.url;

  // Get site config
  let siteConfig = {};
  try {
    const store = getStore();
    const docs = await store.list({ type: 'site_settings', limit: 1 });
    if (docs[0]) siteConfig = docs[0].data;
  } catch {}

  // Determine which theme to use
  const themeName = siteConfig.theme?.activeTheme || 'default';
  const themeFile = themeName === 'default'
    ? DEFAULT_THEME
    : join(THEME_DIR, themeName, 'index.html');

  // Config to inject into the theme
  const config = {
    apiBase: '/api',
    site: {
      name: siteConfig.siteName || 'Gion CMS',
      description: siteConfig.siteDescription || '',
      icp: siteConfig.icpNumber || '',
      gongan: siteConfig.gonganNumber || '',
      analytics: siteConfig.analyticsId || '',
      language: siteConfig.language || 'zh-CN',
      timezone: siteConfig.timezone || 'Asia/Shanghai'
    },
    theme: siteConfig.theme || {},
    seo: {
      title: siteConfig.seoTitle || siteConfig.siteName || '',
      description: siteConfig.seoDescription || siteConfig.siteDescription || '',
      keywords: siteConfig.seoKeywords || []
    }
  };

  try {
    let html = readFileSync(themeFile, 'utf-8');

    // Inject config before </head>
    const configScript = `<script>window.__GION__ = ${JSON.stringify(config)};</script>`;
    html = html.replace('</head>', `${configScript}\n</head>`);

    ctx.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    ctx.res.end(html);
  } catch (err) {
    // Theme not found → fallback to default
    if (themeName !== 'default') {
      try {
        let html = readFileSync(DEFAULT_THEME, 'utf-8');
        const configScript = `<script>window.__GION__ = ${JSON.stringify(config)};</script>`;
        html = html.replace('</head>', `${configScript}\n</head>`);
        ctx.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        ctx.res.end(html);
        return;
      } catch {}
    }
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'Theme not found' }));
  }
}

/**
 * Serve a static theme asset (CSS, JS, images).
 */
export function serveThemeAsset(ctx, filePath) {
  const themeName = 'default'; // Can be extended for custom themes
  const base = themeName === 'default'
    ? join(import.meta.dirname || join(process.cwd(), 'packages', 'server', 'src'), '..', 'public', 'theme')
    : join(THEME_DIR, themeName);

  const fullPath = join(base, filePath);
  try {
    const content = readFileSync(fullPath);
    const ext = filePath.split('.').pop();
    const mime = {
      css: 'text/css', js: 'application/javascript', png: 'image/png',
      jpg: 'image/jpeg', svg: 'image/svg+xml', woff2: 'font/woff2', json: 'application/json'
    }[ext] || 'application/octet-stream';
    ctx.res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' });
    ctx.res.end(content);
    return true;
  } catch {
    return false;
  }
}
