/**
 * CORS Middleware
 */

const DEFAULT_ORIGIN = '*';
const DEFAULT_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const DEFAULT_HEADERS = 'Content-Type,Authorization,X-Taichu-Agent-Key,X-Taichu-Agent-Id';
const DEFAULT_MAX_AGE = '86400';

export function corsMiddleware(req, res) {
  res.setHeader('Access-Control-Allow-Origin', DEFAULT_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', DEFAULT_METHODS);
  res.setHeader('Access-Control-Allow-Headers', DEFAULT_HEADERS);
  res.setHeader('Access-Control-Max-Age', DEFAULT_MAX_AGE);
}
