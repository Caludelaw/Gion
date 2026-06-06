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
 */

import { createStore as createCoreStore, createHookSystem } from '../../core/src/index.js';

let _store = null;
let _storePromise = null;
let _hooks = null;

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
    actor: null
  };
}

export function getStore() { return _store; }
export function getHooks() { return _hooks; }
