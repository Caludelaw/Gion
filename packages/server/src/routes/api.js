/**
 * API Routes
 *
 * 所有 /api/* 的路由处理。
 *
 * 端点设计：
 *   GET    /api/content/:type          — 列出某类型的所有文档
 *   GET    /api/content/:type/:id      — 获取单个文档
 *   POST   /api/content/:type          — 创建文档
 *   PUT    /api/content/:type/:id      — 更新文档
 *   DELETE /api/content/:type/:id      — 删除文档
 *   GET    /api/content-types          — 列出所有已注册的内容类型
 *   GET    /api/content-types/:name    — 获取内容类型 Schema
 *   GET    /api/health                 — 健康检查
 */

import { NotFoundError, ValidationError } from '../../../core/src/errors.js';

// Built-in content type registry
// Plugins/extensions can register additional types via hooks
const _contentTypes = new Map();

/**
 * Register a content type for API exposure.
 */
export function registerContentType(ct) {
  _contentTypes.set(ct.name, ct);
}

/**
 * @param {import('../context.js').Context} ctx
 */
export async function apiRoutes(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  // /api/health
  if (pathname === '/api/health') {
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      status: 'ok',
      name: 'gion',
      version: '0.1.0',
      uptime: process.uptime()
    }));
    return;
  }

  // /api/content-types
  if (pathname === '/api/content-types' && method === 'GET') {
    const types = Array.from(_contentTypes.values()).map(ct => ({
      name: ct.name,
      label: ct.label,
      description: ct.description,
      schemaOrg: ct.schemaOrg,
      fieldCount: Object.keys(ct.fields).length
    }));
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ types }));
    return;
  }

  // /api/content-types/:name
  const ctMatch = pathname.match(/^\/api\/content-types\/([a-z][a-z0-9_]*)$/);
  if (ctMatch && method === 'GET') {
    const ct = _contentTypes.get(ctMatch[1]);
    if (!ct) {
      ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'NOT_FOUND', message: `Content type "${ctMatch[1]}" not found` }));
      return;
    }
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify(ct.toJSONSchema()));
    return;
  }

  // /api/content/:type
  const listMatch = pathname.match(/^\/api\/content\/([a-z][a-z0-9_]*)$/);
  if (listMatch && method === 'GET') {
    const type = listMatch[1];
    const docs = await ctx.store.list({ type, ...Object.fromEntries(ctx.url.searchParams) });
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ docs, total: docs.length }));
    return;
  }

  if (listMatch && method === 'POST') {
    const type = listMatch[1];
    const ct = _contentTypes.get(type);
    if (!ct) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: `Unknown content type: "${type}"` }));
      return;
    }

    // Validate
    const validation = ct.validate(ctx.body?.data || {});
    if (!validation.valid) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'VALIDATION_ERROR', errors: validation.errors }));
      return;
    }

    // Run beforeCreate hooks
    let payload = { type, data: ctx.body.data, status: ctx.body.status };
    payload = await ctx.hooks.run('beforeCreate', payload, ctx);

    const doc = await ctx.store.create(payload);

    // Run afterCreate hooks
    await ctx.hooks.run('afterCreate', doc, ctx);

    ctx.res.writeHead(201, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify(doc));
    return;
  }

  // /api/content/:type/:id
  const itemMatch = pathname.match(/^\/api\/content\/([a-z][a-z0-9_]*)\/([\w-]+)$/);
  if (itemMatch) {
    const [, type, id] = itemMatch;

    if (method === 'GET') {
      const doc = await ctx.store.get(id);
      if (!doc) {
        ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'NOT_FOUND', message: `Document "${id}" not found` }));
        return;
      }
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(doc));
      return;
    }

    if (method === 'PUT') {
      let payload = { id, type, data: ctx.body.data, status: ctx.body.status };
      payload = await ctx.hooks.run('beforeUpdate', payload, ctx);

      const doc = await ctx.store.update(id, payload);
      if (!doc) {
        ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'NOT_FOUND', message: `Document "${id}" not found` }));
        return;
      }

      await ctx.hooks.run('afterUpdate', doc, ctx);
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(doc));
      return;
    }

    if (method === 'DELETE') {
      let payload = { id, type };
      payload = await ctx.hooks.run('beforeDelete', payload, ctx);

      const deleted = await ctx.store.delete(id);
      if (!deleted) {
        ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'NOT_FOUND', message: `Document "${id}" not found` }));
        return;
      }

      await ctx.hooks.run('afterDelete', { id, type }, ctx);
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ success: true }));
      return;
    }
  }

  // 404 for API
  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({
    error: 'NOT_FOUND',
    message: `API route not found: ${method} ${pathname}`
  }));
}
