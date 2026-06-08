/**
 * Relationship Routes — 内容关系图谱 API
 *
 * GET    /api/content/:type/:id/relationships           — list all relationships
 * POST   /api/content/:type/:id/relationships           — create relationship
 * GET    /api/content/:type/:id/relationships/backlinks — incoming references
 * DELETE /api/content/:type/:id/relationships/:targetId — remove relationship
 * GET    /api/content/:type/:id/graph?depth=2           — traverse subgraph
 */

import { requireAuth } from '../middleware/auth.js';
import {
  getRelationships,
  getBacklinks,
  getAllRelationships,
  addRelationship,
  removeRelationship,
  traverseGraph
} from './relationships.js';
import { getStore } from '../context.js';

/** @param {import('./context.js').Context} ctx */
export async function relationshipRoutes(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  // Auth required
  const authResult = await requireAuth(ctx);
  if (!authResult.authenticated) {
    ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
    return;
  }
  ctx.actor = authResult.actor;

  const store = getStore();
  const match = pathname.match(/^\/api\/content\/([a-z][a-z0-9_]*)\/([\w-]+)\/(relationships(?:\/backlinks)?|graph)$/);
  if (!match) {
    ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'NOT_FOUND' }));
    return;
  }

  const [, type, id, action] = match;
  const doc = await store.get(id);
  if (!doc || doc.type !== type) {
    ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'NOT_FOUND', message: 'Document not found' }));
    return;
  }

  // GET /relationships — list all (outgoing + incoming)
  if (action === 'relationships' && method === 'GET') {
    const result = await getAllRelationships(store, id);
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify(result));
    return;
  }

  // GET /relationships/backlinks
  if (action === 'relationships/backlinks' && method === 'GET') {
    const result = await getBacklinks(store, id);
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify(result));
    return;
  }

  // POST /relationships — create
  if (action === 'relationships' && method === 'POST') {
    const { targetId, type, meta } = ctx.body || {};
    if (!targetId || !type) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'targetId and type are required' }));
      return;
    }

    try {
      const result = await addRelationship(store, id, targetId, type, meta);
      if (result.alreadyExists) {
        ctx.res.writeHead(409, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'ALREADY_EXISTS', message: 'Relationship already exists' }));
        return;
      }
      ctx.res.writeHead(201, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 400;
      ctx.res.writeHead(status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'RELATIONSHIP_ERROR', message: err.message }));
    }
    return;
  }

  // DELETE /relationships/:targetId
  const delMatch = pathname.match(/\/relationships\/([\w-]+)$/);
  if (delMatch && method === 'DELETE') {
    const targetId = delMatch[1];
    const relType = ctx.url.searchParams.get('type') || undefined;
    try {
      const result = await removeRelationship(store, id, targetId, relType);
      if (result.notFound) {
        ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'NOT_FOUND', message: 'Relationship not found' }));
        return;
      }
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
    } catch (err) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'RELATIONSHIP_ERROR', message: err.message }));
    }
    return;
  }

  // GET /graph?depth=2&types=related_to,parent_of
  if (action === 'graph' && method === 'GET') {
    const depth = parseInt(ctx.url.searchParams.get('depth')) || 2;
    const types = ctx.url.searchParams.get('types')?.split(',').filter(Boolean) || null;

    try {
      const result = await traverseGraph(store, id, { depth, types });
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ startId: id, depth, types, ...result }));
    } catch (err) {
      ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'GRAPH_ERROR', message: err.message }));
    }
    return;
  }

  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}
