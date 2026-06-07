/**
 * Router — Gion 路由分发
 *
 * 基于 URL 模式匹配的轻量路由。
 * 支持：
 *   - 静态路由：/api/health
 *   - 参数路由：/api/content/:type/:id
 *   - HTTP 方法区分
 */

import { apiRoutes } from './routes/api.js';
import { authRoutes } from './routes/auth.js';
import { graphqlRoutes } from './routes/graphql.js';
import { mediaRoutes } from './routes/media.js';
import { collabRoutes } from './routes/collab.js';
import { serveStatic } from './static.js';
import { createMediaStore } from './media-store.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

/**
 * @param {import('./context.js').Context} ctx
 */
export async function router(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  // Auth routes
  if (pathname.startsWith('/api/auth')) {
    return authRoutes(ctx);
  }

  // GraphQL API
  if (pathname === '/api/graphql') {
    return graphqlRoutes(ctx);
  }

  // Collaboration & WebSocket
  if (pathname.startsWith('/api/collab') || pathname === '/api/ws') {
    return collabRoutes(ctx);
  }

  // Media routes (upload/list/delete)
  if (pathname.startsWith('/api/media')) {
    return mediaRoutes(ctx);
  }

  // Content API routes
  if (pathname.startsWith('/api')) {
    return apiRoutes(ctx);
  }

  // Admin SPA static files
  if (pathname.startsWith('/admin')) {
    const served = await serveStatic(ctx, PUBLIC_DIR, pathname);
    if (served) return;
  }

  // Uploaded media files
  if (pathname.startsWith('/uploads/')) {
    const mediaStore = createMediaStore();
    const relativePath = pathname.slice('/uploads/'.length);
    const served = await serveStatic(ctx, mediaStore.uploadDir, relativePath);
    if (served) return;
  }

  // Public static files (ws-test.html, etc.)
  {
    const served = await serveStatic(ctx, PUBLIC_DIR, pathname);
    if (served) return;
  }

  // Health check
  if (pathname === '/health') {
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      status: 'ok',
      name: 'gion',
      version: ctx.config.version || '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 404
  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({
    error: 'NOT_FOUND',
    message: `Route not found: ${method} ${pathname}`
  }));
}
