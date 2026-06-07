/**
 * Collaboration & WebSocket Routes
 *
 * POST /api/collab/sessions/:docId   — Acquire editing session
 * DELETE /api/collab/sessions/:docId  — Release editing session
 * GET  /api/collab/sessions            — List active sessions
 * GET  /api/ws                        — WebSocket connection info
 */

import { requireAuth } from '../middleware/auth.js';
import { getCollab } from '../collab.js';
import { getWSS } from '../websocket.js';

/**
 * @param {import('../context.js').Context} ctx
 */
export async function collabRoutes(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  // WebSocket info + stats
  if (pathname === '/api/ws' && method === 'GET') {
    const wss = getWSS();
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      protocol: 'ws',
      endpoint: `ws://localhost:${ctx.config.port || 3120}`,
      stats: wss.getStats(),
      usage: 'Connect via WebSocket, then send: {"type":"subscribe","channel":"article"}'
    }));
    return;
  }

  // GET /api/collab/sessions — list active sessions
  if (pathname === '/api/collab/sessions' && method === 'GET') {
    const authResult = await requireAuth(ctx);
    if (!authResult.authenticated) {
      ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
      return;
    }
    const collab = getCollab();
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ sessions: collab.listSessions() }));
    return;
  }

  // POST /api/collab/sessions/:docId — acquire
  const acquireMatch = pathname.match(/^\/api\/collab\/sessions\/([\w-]+)$/);
  if (acquireMatch && method === 'POST') {
    const authResult = await requireAuth(ctx);
    if (!authResult.authenticated) {
      ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
      return;
    }
    const docId = acquireMatch[1];
    const collab = getCollab();
    const result = collab.acquire(docId, {
      id: authResult.actor.id,
      type: authResult.actor.type,
      username: authResult.actor.username,
      label: authResult.actor.label
    });

    ctx.res.writeHead(result.acquired ? 200 : 409, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify(result));
    return;
  }

  // DELETE /api/collab/sessions/:docId — release
  if (acquireMatch && method === 'DELETE') {
    const authResult = await requireAuth(ctx);
    if (!authResult.authenticated) {
      ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
      return;
    }
    const docId = acquireMatch[1];
    const collab = getCollab();
    const released = collab.release(docId, authResult.actor.id);

    ctx.res.writeHead(released ? 200 : 404, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ released }));
    return;
  }

  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}
