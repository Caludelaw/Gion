/**
 * Auth Middleware — 认证中间件
 *
 * 两种认证方式：
 *   Bearer <JWT>        → 解析 JWT，识别人类用户
 *   X-Gion-Agent-Key    → 匹配 API Key，识别 AI Agent
 *
 * 使用：
 *   const result = await requireAuth(ctx);
 *   if (!result.authenticated) return error;
 *   ctx.actor = result.actor; // { id, type: 'human'|'agent', username, role }
 */

import { verifyJWT, verifyAPIKey } from '../../../core/src/auth.js';
import { getStore } from '../context.js';
import { randomBytes } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Cached JWT secret for the process lifetime */
let _jwtSecret = null;

/**
 * Get or auto-generate a JWT secret.
 *
 * Priority:
 *   1. GION_JWT_SECRET environment variable
 *   2. Auto-generated secret persisted to .gion/data/.jwt_secret
 *
 * The hardcoded default 'gion-dev-secret' is explicitly rejected.
 *
 * @returns {string}
 */
export function getJwtSecret() {
  if (_jwtSecret) return _jwtSecret;

  // 1. Environment variable
  const envSecret = process.env.GION_JWT_SECRET;
  if (envSecret && envSecret !== 'gion-dev-secret' && envSecret !== 'change-me') {
    _jwtSecret = envSecret;
    return _jwtSecret;
  }

  // 2. Auto-generate and persist
  const dataDir = process.env.GION_DATA_DIR || join(process.cwd(), '.gion', 'data');
  const secretFile = join(dataDir, '.jwt_secret');

  if (existsSync(secretFile)) {
    _jwtSecret = readFileSync(secretFile, 'utf-8').trim();
    if (_jwtSecret) return _jwtSecret;
  }

  // Generate new secret
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  _jwtSecret = randomBytes(32).toString('hex');
  writeFileSync(secretFile, _jwtSecret, 'utf-8');

  console.log(`  Auth: Auto-generated JWT secret saved to ${secretFile}`);
  return _jwtSecret;
}

/**
 * Require authentication — returns auth result or 401.
 *
 * @param {Context} ctx
 * @returns {Promise<{ authenticated: boolean, status?: number, error?: string, message?: string, actor?: object }>}
 */
export async function requireAuth(ctx) {
  const authHeader = ctx.req.headers['authorization'];
  const agentKey = ctx.req.headers['x-gion-agent-key'];

  // ── JWT Auth (Human) ──
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const secret = getJwtSecret();
    const result = verifyJWT(token, secret);

    if (!result.valid) {
      return { authenticated: false, status: 401, error: 'UNAUTHORIZED', message: result.error };
    }

    return {
      authenticated: true,
      actor: {
        id: result.payload.sub,
        type: 'human',
        username: result.payload.username,
        role: result.payload.role || 'author'
      }
    };
  }

  // ── API Key Auth (Agent) ──
  if (agentKey) {
    const store = getStore();
    const keys = await store.list({ type: 'api_key', status: 'active' });

    for (const keyDoc of keys) {
      if (verifyAPIKey(agentKey, keyDoc.data.hash)) {
        const scopes = keyDoc.data.scopes || ['*:*']; // default: full access for legacy keys
        return {
          authenticated: true,
          actor: {
            id: keyDoc.data.ownerId || `agent_${keyDoc.data.prefix}`,
            type: 'agent',
            role: 'agent',
            keyPrefix: keyDoc.data.prefix,
            label: keyDoc.data.label,
            scopes
          }
        };
      }
    }

    return { authenticated: false, status: 401, error: 'UNAUTHORIZED', message: 'Invalid API key' };
  }

  // ── No credentials ──
  return { authenticated: false, status: 401, error: 'UNAUTHORIZED', message: 'Authentication required' };
}

/**
 * Check if the actor has the required scope.
 *
 * Scope format: "<type>:<action>" where:
 *   - type: content type name (e.g. "article") or "*" for all
 *   - action: "read" | "write" | "delete" | "*" for all
 *
 * Examples:
 *   checkScope(actor, 'article:read')  → true if actor can read articles
 *   checkScope(actor, '*:*')           → true if actor is admin
 *   checkScope(actor, 'media:write')   → true if actor can write media
 *
 * Humans (JWT) always have full access (*:*).
 *
 * @param {object} actor
 * @param {string} required — scope string like "article:read"
 * @returns {boolean}
 */
export function checkScope(actor, required) {
  // Humans always pass
  if (actor.type === 'human') return true;

  const scopes = actor.scopes || [];
  if (scopes.includes('*:*')) return true;

  const [reqType, reqAction] = required.split(':');

  for (const scope of scopes) {
    const [sType, sAction] = scope.split(':');
    const typeMatch = sType === '*' || sType === reqType;
    const actionMatch = sAction === '*' || sAction === reqAction;
    if (typeMatch && actionMatch) return true;
  }

  return false;
}

/**
 * Convenience: require auth + scope check in one call.
 * Returns 403 if authenticated but lacking scope.
 */
export async function requireScopedAuth(ctx, scope) {
  const result = await requireAuth(ctx);
  if (!result.authenticated) return result;

  if (!checkScope(result.actor, scope)) {
    return {
      authenticated: false,
      status: 403,
      error: 'FORBIDDEN',
      message: `Insufficient permissions: "${scope}" scope required`
    };
  }

  return result;
}

/**
 * Optional auth — attaches actor if authenticated, but doesn't block.
 */
export async function optionalAuth(ctx) {
  const result = await requireAuth(ctx);
  if (result.authenticated) {
    ctx.actor = result.actor;
  }
}
