/**
 * RSS + Sitemap Route Handler
 *
 * GET /rss.xml    — RSS 2.0 feed of published articles
 * GET /sitemap.xml — XML sitemap for search engines
 */

import { getStore } from './context.js';

export async function rssSitemapRoutes(ctx) {
  const { pathname } = ctx.url;
  const store = getStore();

  if (pathname === '/rss.xml') {
    try {
      const docs = await store.list({ type: 'article', status: 'published', limit: 20 });
      const settingsDocs = await store.list({ type: 'site_settings', limit: 1 });
      const site = settingsDocs[0]?.data || {};

      const items = (docs || []).map(d => {
        const title = d.data?.title || 'Untitled';
        const desc = excerpt(d.data?.body) || title;
        const link = `${ctx.url.protocol}//${ctx.url.host}/post/${d.data?.slug || d.id}`;
        const date = new Date(d.updatedAt).toUTCString();
        return `<item><title>${esc(title)}</title><link>${esc(link)}</link><description>${esc(desc)}</description><pubDate>${date}</pubDate><guid>${esc(link)}</guid></item>`;
      }).join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(site.siteName || 'Gion CMS')}</title>
<link>${ctx.url.protocol}//${ctx.url.host}</link>
<description>${esc(site.siteDescription || '')}</description>
<language>${site.language || 'zh-CN'}</language>
<atom:link href="${ctx.url.protocol}//${ctx.url.host}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>`;

      ctx.res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      ctx.res.end(xml);
      return;
    } catch (err) {
      ctx.res.writeHead(500, { 'Content-Type': 'text/plain' });
      ctx.res.end('RSS Error: ' + err.message);
      return;
    }
  }

  if (pathname === '/sitemap.xml') {
    try {
      const articles = await store.list({ type: 'article', status: 'published', limit: 1000 });
      const pages = await store.list({ type: 'page', status: 'published', limit: 100 });

      const host = `${ctx.url.protocol}//${ctx.url.host}`;
      let urls = `<url><loc>${esc(host)}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;

      for (const a of (articles || [])) {
        const slug = a.data?.slug || a.id;
        urls += `<url><loc>${esc(host)}/post/${esc(slug)}</loc><lastmod>${new Date(a.updatedAt).toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
      }
      for (const p of (pages || [])) {
        const slug = p.data?.slug || p.id;
        urls += `<url><loc>${esc(host)}/page/${esc(slug)}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;

      ctx.res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      ctx.res.end(xml);
      return;
    } catch (err) {
      ctx.res.writeHead(500, { 'Content-Type': 'text/plain' });
      ctx.res.end('Sitemap Error: ' + err.message);
      return;
    }
  }

  ctx.res.writeHead(404, { 'Content-Type': 'text/plain' });
  ctx.res.end('Not Found');
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function excerpt(body) {
  if (!body) return '';
  if (typeof body === 'string') return body.substring(0, 300);
  if (body.text) return body.text.substring(0, 300);
  if (body.content) return body.content.map(n => n.text||'').join(' ').substring(0, 300);
  return '';
}
