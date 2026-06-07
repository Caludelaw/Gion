/**
 * Webhook Routes
 *
 * POST   /api/webhooks       — Register webhook
 * GET    /api/webhooks        — List webhooks
 * DELETE /api/webhooks/:id    — Delete webhook
 * GET    /api/webhooks/log    — Delivery log
 */

import { requireAuth } from '../middleware/auth.js';
import { getWebhookManager } from '../webhook.js';
import { getStore } from '../context.js';

export async function webhookRoutes(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  const wm = getWebhookManager(getStore());

  // POST /api/webhooks — register
  if (pathname === '/api/webhooks' && method === 'POST') {
    const authResult = await requireAuth(ctx);
    if (!authResult.authenticated) {
      ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
      return;
    }

    const { url, events, types, secret, label } = ctx.body || {};
    if (!url) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'url is required' }));
      return;
    }

    try {
      const wh = await wm.register({ url, events, types, secret, label });
      ctx.res.writeHead(201, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ webhook: wh, secret: wh.secret, note: 'Save this secret — it will not be shown again' }));
    } catch (err) {
      ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'INTERNAL_ERROR', message: err.message }));
    }
    return;
  }

  // GET /api/webhooks — list
  if (pathname === '/api/webhooks' && method === 'GET') {
    const authResult = await requireAuth(ctx);
    if (!authResult.authenticated) {
      ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
      return;
    }

    const hooks = await wm.list();
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ webhooks: hooks.map(h => ({ id: h.id, url: h.url, label: h.label, events: h.events, types: h.types, active: h.active, stats: h.stats, createdAt: h.createdAt })) }));
    return;
  }

  // GET /api/webhooks/log — delivery log
  if (pathname === '/api/webhooks/log' && method === 'GET') {
    const authResult = await requireAuth(ctx);
    if (!authResult.authenticated) {
      ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
      return;
    }

    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ log: wm.getLog(), stats: wm.getStats() }));
    return;
  }

  // DELETE /api/webhooks/:id
  const delMatch = pathname.match(/^\/api\/webhooks\/([\w-]+)$/);
  if (delMatch && method === 'DELETE') {
    const authResult = await requireAuth(ctx);
    if (!authResult.authenticated) {
      ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
      return;
    }

    await wm.remove(delMatch[1]);
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ success: true }));
    return;
  }

  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}
