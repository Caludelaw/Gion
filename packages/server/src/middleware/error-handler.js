/**
 * Error Handler — 统一错误响应
 */

import { GionError } from '../../../core/src/errors.js';

export function errorHandler(res, err) {
  // Already sent headers?
  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }

  if (err instanceof GionError) {
    res.writeHead(err.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(err.toJSON()));
    return;
  }

  // Unknown error — log and return 500
  console.error('[Gion] Unhandled error:', err);
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    status: 500
  }));
}
