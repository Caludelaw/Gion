/**
 * Error Handler — 统一错误响应
 */

import { TaichuError } from '../../../core/src/errors.js';

export function errorHandler(res, err) {
  // Already sent headers?
  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }

  // Body parser errors
  if (err.code === 'PAYLOAD_TOO_LARGE') {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'PAYLOAD_TOO_LARGE',
      message: `Request body exceeds limit of ${(err.maxSize / 1024 / 1024).toFixed(1)}MB`,
      status: 413
    }));
    return;
  }

  if (err.code === 'INVALID_JSON') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'INVALID_JSON',
      message: 'Request body must be valid JSON',
      status: 400
    }));
    return;
  }

  if (err instanceof TaichuError) {
    res.writeHead(err.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(err.toJSON()));
    return;
  }

  // Unknown error — log and return 500
  console.error('[Taichu] Unhandled error:', err);
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    status: 500
  }));
}
