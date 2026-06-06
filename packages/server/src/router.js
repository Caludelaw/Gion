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

  // Content API routes
  if (pathname.startsWith('/api')) {
    return apiRoutes(ctx);
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
