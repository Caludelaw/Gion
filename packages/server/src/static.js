/**
 * Static file server — 提供管理后台和公共前端静态文件
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

export async function serveStatic(ctx, publicDir, urlPath) {
  try {
    // Normalize path: /admin => /admin/index.html
    let filePath = urlPath;
    if (filePath === '/' || filePath.endsWith('/')) {
      filePath += 'index.html';
    }

    const fullPath = join(publicDir, filePath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(publicDir)) {
      ctx.res.writeHead(403);
      ctx.res.end('Forbidden');
      return true;
    }

    if (!existsSync(fullPath)) {
      return false;
    }

    const ext = extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const content = await readFile(fullPath);
    ctx.res.writeHead(200, { 'Content-Type': contentType });
    ctx.res.end(content);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    ctx.res.writeHead(500);
    ctx.res.end('Internal Server Error');
    return true;
  }
}
