/**
 * Content Export — 内容导出（JSON / Markdown / CSV）
 *
 * GET /api/export/:type?format=json|md|csv
 */

import { requireAuth } from '../middleware/auth.js';
import { getStore } from '../context.js';

export async function exportRoutes(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  const match = pathname.match(/^\/api\/export\/([a-z][a-z0-9_]*)$/);
  if (!match || method !== 'GET') return false;

  const authResult = await requireAuth(ctx);
  if (!authResult.authenticated) {
    ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: authResult.error }));
    return true;
  }

  const type = match[1];
  const format = ctx.url.searchParams.get('format') || 'json';
  const status = ctx.url.searchParams.get('status') || 'published';

  const store = getStore();
  const docs = await store.list({ type, status, limit: 10000 });

  switch (format) {
    case 'json':
      ctx.res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${type}-export.json"` });
      ctx.res.end(JSON.stringify({ exported: new Date().toISOString(), type, total: docs.length, docs }, null, 2));
      break;

    case 'md':
    case 'markdown': {
      const md = docs.map(d => {
        const title = d.data?.title || 'Untitled';
        const body = typeof d.data?.body === 'string' ? d.data.body : JSON.stringify(d.data?.body || {});
        return `# ${title}\n\n${body}\n\n---\n`;
      }).join('\n');
      ctx.res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}-export.md"` });
      ctx.res.end(md);
      break;
    }

    case 'csv': {
      const headers = ['id', 'title', 'status', 'createdAt', 'updatedAt'];
      const rows = [headers.join(',')];
      for (const d of docs) {
        rows.push([
          csvEscape(d.id),
          csvEscape(d.data?.title || ''),
          csvEscape(d.status),
          csvEscape(d.createdAt),
          csvEscape(d.updatedAt)
        ].join(','));
      }
      ctx.res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}-export.csv"` });
      ctx.res.end('\uFEFF' + rows.join('\n'));
      break;
    }

    default:
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Invalid format. Use: json, md, csv' }));
  }

  return true;
}

function csvEscape(s) {
  const str = String(s || '').replace(/"/g, '""');
  return `"${str}"`;
}
