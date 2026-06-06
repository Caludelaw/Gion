/**
 * Media Routes — 文件上传和管理 API
 *
 * POST   /api/media/upload       — 上传文件（multipart）
 * GET    /api/media               — 列出媒体
 * GET    /api/media/:id           — 获取媒体元数据
 * DELETE /api/media/:id           — 删除媒体
 * GET    /uploads/*              — 静态文件服务（由 router 转发到 static.js）
 */

import { parseMultipart } from '../multipart.js';
import { createMediaStore } from '../media-store.js';
import { requireAuth } from '../middleware/auth.js';
import { getStore } from '../context.js';

// Lazy-init media store singleton
let _mediaStore = null;
function getMediaStore() {
  if (!_mediaStore) _mediaStore = createMediaStore();
  return _mediaStore;
}

/**
 * @param {import('../context.js').Context} ctx
 */
export async function mediaRoutes(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  // POST /api/media/upload
  if (pathname === '/api/media/upload' && method === 'POST') {
    const authResult = await requireAuth(ctx);
    if (!authResult.authenticated) {
      ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
      return;
    }
    ctx.actor = authResult.actor;

    try {
      const { files, fields } = await parseMultipart(ctx.req);
      if (!files || files.length === 0) {
        ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'No file uploaded' }));
        return;
      }

      const mediaStore = getMediaStore();
      const store = getStore();
      const results = [];

      for (const file of files) {
        const saved = await mediaStore.save(file.buffer, file.filename, file.mimetype);

        // Store metadata in Gion's content system
        const doc = await store.create({
          type: 'media',
          data: {
            filename: saved.filename,
            mimeType: saved.mimetype,
            size: saved.size,
            url: saved.url,
            width: saved.width || null,
            height: saved.height || null,
            altText: fields.alt || '',
            caption: fields.caption || '',
            uploadedBy: ctx.actor.id
          },
          status: 'active'
        });

        results.push({
          id: doc.id,
          ...saved,
          altText: fields.alt || '',
          caption: fields.caption || ''
        });
      }

      ctx.res.writeHead(201, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(results.length === 1 ? results[0] : { files: results }));
    } catch (err) {
      if (err.code === 'FILE_TOO_LARGE' || err.code === 'PAYLOAD_TOO_LARGE') {
        ctx.res.writeHead(413, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: err.code, message: err.message }));
        return;
      }
      throw err;
    }
    return;
  }

  // GET /api/media — list media
  if (pathname === '/api/media' && method === 'GET') {
    const authResult = await requireAuth(ctx);
    if (!authResult.authenticated) {
      ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
      return;
    }

    const store = getStore();
    const docs = await store.list({ type: 'media', limit: 50, ...Object.fromEntries(ctx.url.searchParams) });

    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ docs, total: docs.length }));
    return;
  }

  // GET /api/media/:id
  const mediaMatch = pathname.match(/^\/api\/media\/([\w-]+)$/);
  if (mediaMatch && method === 'GET') {
    const authResult = await requireAuth(ctx);
    if (!authResult.authenticated) {
      ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
      return;
    }

    const store = getStore();
    const doc = await store.get(mediaMatch[1]);
    if (!doc || doc.type !== 'media') {
      ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'NOT_FOUND', message: 'Media not found' }));
      return;
    }

    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify(doc));
    return;
  }

  // DELETE /api/media/:id
  if (mediaMatch && method === 'DELETE') {
    const authResult = await requireAuth(ctx);
    if (!authResult.authenticated) {
      ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
      return;
    }

    const store = getStore();
    const mediaStore = getMediaStore();
    const doc = await store.get(mediaMatch[1]);

    if (!doc || doc.type !== 'media') {
      ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'NOT_FOUND', message: 'Media not found' }));
      return;
    }

    // Delete file from disk
    await mediaStore.remove(doc.data.filename);
    // Delete metadata
    await store.delete(mediaMatch[1]);

    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ success: true }));
    return;
  }

  // 404
  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ error: 'NOT_FOUND', message: `Media route not found: ${method} ${pathname}` }));
}
