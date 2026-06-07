/**
 * Hook System — 插件/扩展的生命周期钩子
 *
 * Taichu 的插件系统基于生命周期钩子（Lifecycle Hooks）。
 * 与 WordPress 的 add_action / add_filter 精神一致，但：
 *   - 纯函数式，无全局状态
 *   - 支持异步钩子
 *   - 支持优先级排序
 *   - 钩子返回值可传递（类似 filter）或纯副作用（类似 action）
 *
 * 内置钩子：
 *   - beforeCreate / afterCreate
 *   - beforeUpdate / afterUpdate
 *   - beforeDelete / afterDelete
 *   - beforePublish / afterPublish
 *   - beforeRender / afterRender
 *   - agent:onRequest  — Agent 请求拦截
 *   - agent:onResponse — Agent 响应拦截
 */

export function createHookSystem() {
  /** @type {Map<string, Array<{id: string, fn: Function, priority: number}>>} */
  const hooks = new Map();

  /**
   * Register a hook handler.
   * @param {string} name — hook name
   * @param {Function} fn — handler function
   * @param {number} [priority=10] — lower runs first (like WordPress)
   * @returns {Function} — deregister function
   */
  function on(name, fn, priority = 10) {
    if (!hooks.has(name)) {
      hooks.set(name, []);
    }
    const id = `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = { id, fn, priority };
    hooks.get(name).push(entry);

    // Sort by priority (ascending)
    hooks.get(name).sort((a, b) => a.priority - b.priority);

    // Return deregister function
    return () => {
      const list = hooks.get(name);
      if (list) {
        const idx = list.findIndex(e => e.id === id);
        if (idx !== -1) list.splice(idx, 1);
      }
    };
  }

  /**
   * Run all handlers for a hook.
   *
   * @param {string} name — hook name
   * @param {*} payload — initial payload (passed through handlers)
   * @param {object} [context] — extra context (store, agent identity, etc.)
   * @returns {Promise<*>} — final payload after all handlers
   */
  async function run(name, payload, context = {}) {
    const handlers = hooks.get(name);
    if (!handlers || handlers.length === 0) return payload;

    let result = payload;
    for (const entry of handlers) {
      try {
        const returned = await entry.fn(result, context);
        // If a handler returns null explicitly, stop the chain
        if (returned === null) {
          context._stoppedAt = name;
          break;
        }
        // Only update if handler returned a value (allows pass-through for side-effect handlers)
        if (returned !== undefined) {
          result = returned;
        }
      } catch (err) {
        // Re-throw with hook context
        throw new Error(`Hook "${name}" handler error: ${err.message}`, { cause: err });
      }
    }
    return result;
  }

  /**
   * List registered hook names.
   * @returns {string[]}
   */
  function list() {
    return Array.from(hooks.keys());
  }

  /**
   * Get handler count for a hook.
   * @param {string} name
   * @returns {number}
   */
  function count(name) {
    return (hooks.get(name) || []).length;
  }

  return Object.freeze({ on, run, list, count });
}
