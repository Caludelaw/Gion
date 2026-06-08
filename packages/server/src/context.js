/**
 * Context — 请求上下文
 *
 * 贯穿整个请求生命周期的上下文对象。
 * 包含：
 *   - req/res — 原始 Node.js 请求/响应对象
 *   - url — 解析后的 URL 对象
 *   - body — 解析后的请求体
 *   - config — 全局配置
 *   - state — 中间件/路由之间传递数据
 *   - tenantId — 租户 ID（默认 'default'，可通过 API Key 或 X-Taichu-Tenant 头覆盖）
 *   - multiTenant — 是否启用多租户模式
 */

import { createStore as createCoreStore, createHookSystem } from '../../core/src/index.js';

let _store = null;
let _storePromise = null;
let _hooks = null;

/** Check if multi-tenant mode is enabled */
const MULTI_TENANT = process.env.TAICHU_MULTI_TENANT === '1';

/**
 * Ensure the store singleton is initialized (async-safe).
 * @param {object} config
 */
async function ensureStore(config) {
  if (_store) return _store;
  if (_storePromise) return _storePromise;

  _storePromise = createCoreStore({ engine: config.storage || 'memory', dataDir: config.dataDir });
  _store = await _storePromise;
  return _store;
}

/**
 * Extract tenant ID from request context.
 * Priority: API Key scope > X-Taichu-Tenant header > default
 */
function extractTenantId(req, url) {
  if (!MULTI_TENANT) return 'default';

  // Check X-Taichu-Tenant header (admin override)
  const header = req.headers['x-taichu-tenant'];
  if (header && typeof header === 'string') return header;

  // Default tenant
  return 'default';
}

/**
 * @param {object} params
 * @returns {Promise<Context>}
 */
export async function createContext({ req, res, url, body, config = {} }) {
  if (!_store) {
    await ensureStore(config);
  }
  if (!_hooks) {
    _hooks = createHookSystem();
  }

  const tenantId = extractTenantId(req, url);

  return {
    req,
    res,
    url,
    body,
    config,
    store: _store,
    hooks: _hooks,
    state: {},
    /** @type {object|null} authenticated actor (human user or agent) */
    actor: null,
    /** Tenant ID for multi-tenant isolation */
    tenantId,
    /** Whether multi-tenant mode is active */
    multiTenant: MULTI_TENANT
  };
}

export function getStore() { return _store; }
export function getHooks() { return _hooks; }
export function isMultiTenant() { return MULTI_TENANT; }
