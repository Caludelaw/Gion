/**
 * Theme Upload API
 *
 * POST /api/theme/upload  — Upload custom theme (.zip)
 * DELETE /api/theme/:name — Delete custom theme
 */

import { writeFileSync, mkdirSync, existsSync, unlinkSync, rmdirSync, readdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream';
import { createBrotliDecompress } from 'node:zlib';
import { requireAuth } from '../middleware/auth.js';

const THEME_DIR = join(process.cwd(), '.gion', 'themes');

export async function themeRoutes(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  const authResult = await requireAuth(ctx);
  if (!authResult.authenticated) {
    ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
    return;
  }

  // DELETE /api/theme/:name
  const delMatch = pathname.match(/^\/api\/theme\/([\w-]+)$/);
  if (delMatch && method === 'DELETE') {
    const name = delMatch[1];
    if (name === 'default') {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Cannot delete default theme' }));
      return;
    }
    const dir = join(THEME_DIR, name);
    if (existsSync(dir)) {
      readdirSync(dir).forEach(f => unlinkSync(join(dir, f)));
      rmdirSync(dir);
    }
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ success: true }));
    return;
  }

  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}
