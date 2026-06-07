/**
 * Rate Limiter — Token Bucket 算法，零依赖
 *
 * 三种监控维度（按优先级）：
 *   1. API Key   → 按 Agent 限制
 *   2. JWT User  → 按人类用户限制
 *   3. IP        → 匿名请求兜底
 *
 * 环境变量：
 *   TAICHU_RATE_LIMIT_WINDOW_MS  — 时间窗口（默认 60000ms = 1分钟）
 *   TAICHU_RATE_LIMIT_MAX         — 窗口内最大请求数（默认 100）
 *   TAICHU_RATE_LIMIT_AUTH_MAX    — 认证用户窗口内最大请求数（默认 300）
 *   TAICHU_RATE_LIMIT_LOGIN_MAX   — 登录端点窗口内最大请求数（默认 10）
 *
 * 响应：429 Too Many Requests + Retry-After 头
 */

const DEFAULT_WINDOW = parseInt(process.env.TAICHU_RATE_LIMIT_WINDOW_MS) || 60000;
const DEFAULT_MAX = parseInt(process.env.TAICHU_RATE_LIMIT_MAX) || 100;
const AUTH_MAX = parseInt(process.env.TAICHU_RATE_LIMIT_AUTH_MAX) || 300;
const LOGIN_MAX = parseInt(process.env.TAICHU_RATE_LIMIT_LOGIN_MAX) || 10;

/** @type {Map<string, { tokens: number, lastRefill: number }>} */
const buckets = new Map();

// Periodic cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (now - b.lastRefill > DEFAULT_WINDOW * 2) {
      buckets.delete(key);
    }
  }
}, 300000).unref();

/**
 * Get client identifier for rate limiting.
 * Priority: API Key → JWT User → IP
 */
function getClientId(ctx) {
  // API Key header
  const agentKey = ctx.req.headers['x-taichu-agent-key'];
  if (agentKey) return `ak:${agentKey}`;

  // JWT (via actor if already authenticated)
  if (ctx.actor?.id) return `user:${ctx.actor.id}`;

  // IP fallback
  const ip = ctx.req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || ctx.req.socket?.remoteAddress
    || 'unknown';
  return `ip:${ip}`;
}

/**
 * Determine the max tokens for a given request.
 */
function getMaxTokens(ctx, clientId) {
  // Login/register endpoints — strict limit
  const path = ctx.url?.pathname || '';
  if (path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register')) {
    return LOGIN_MAX;
  }
  // Authenticated users — higher limit
  if (clientId.startsWith('ak:') || clientId.startsWith('user:')) {
    return AUTH_MAX;
  }
  return DEFAULT_MAX;
}

/**
 * Rate limit middleware. Returns true if allowed, false if blocked.
 * If blocked, it will have already written the 429 response.
 *
 * @param {object} ctx — request context
 * @returns {boolean} — true = allowed, false = blocked
 */
export function rateLimit(ctx) {
  const clientId = getClientId(ctx);
  const maxTokens = getMaxTokens(ctx, clientId);
  const now = Date.now();

  let bucket = buckets.get(clientId);
  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now };
    buckets.set(clientId, bucket);
  }

  // Refill tokens
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor((elapsed / DEFAULT_WINDOW) * maxTokens);
  if (refill > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  // Consume a token
  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true;
  }

  // Rate limited — write 429 response
  const retryAfter = Math.ceil((DEFAULT_WINDOW - elapsed) / 1000);
  ctx.res.writeHead(429, {
    'Content-Type': 'application/json',
    'Retry-After': String(retryAfter),
    'X-RateLimit-Limit': String(maxTokens),
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': String(Math.ceil((bucket.lastRefill + DEFAULT_WINDOW) / 1000))
  });
  ctx.res.end(JSON.stringify({
    error: 'RATE_LIMITED',
    message: `Too many requests. Try again in ${retryAfter} seconds.`,
    retryAfter
  }));
  return false;
}
