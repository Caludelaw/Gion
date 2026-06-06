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
    const secret = ctx.config.jwtSecret || process.env.GION_JWT_SECRET || 'gion-dev-secret';
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
        return {
          authenticated: true,
          actor: {
            id: keyDoc.data.ownerId || `agent_${keyDoc.data.prefix}`,
            type: 'agent',
            role: 'agent',
            keyPrefix: keyDoc.data.prefix,
            label: keyDoc.data.label
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
 * Optional auth — attaches actor if authenticated, but doesn't block.
 */
export async function optionalAuth(ctx) {
  const result = await requireAuth(ctx);
  if (result.authenticated) {
    ctx.actor = result.actor;
  }
}
