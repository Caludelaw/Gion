/**
 * Collaboration Engine — 多 Agent 协作控制
 *
 * 提供乐观锁（Optimistic Locking）和内容冲突检测。
 *
 * 乐观锁机制：
 *   - 每个文档有一个 `_version` 字段（单调递增整数）
 *   - 更新时必须传入 `_version`，服务端比对
 *   - 版本不匹配 → 409 Conflict，返回当前版本
 *   - 客户端拿到最新版本后可重试
 *
 * 协作会话：
 *   - Agent 可以声明"I'm editing this"（acquire session）
 *   - 会话有过期时间（默认 5 分钟）
 *   - 其他 Agent 可以看到当前编辑者
 */

const SESSION_TTL = 5 * 60 * 1000; // 5 minutes

class CollaborationEngine {
  constructor() {
    /** @type {Map<string, { actorId: string, actorType: string, label: string, startedAt: number, expiresAt: number }>} */
    this.sessions = new Map();
    this._cleanupTimer = setInterval(() => this._cleanup(), 60000);
  }

  /**
   * Acquire an editing session for a document.
   * @param {string} docId
   * @param {object} actor — { id, type, username/label }
   * @returns {{ acquired: boolean, currentEditor?: object, message?: string }}
   */
  acquire(docId, actor) {
    const existing = this.sessions.get(docId);

    if (existing && existing.expiresAt > Date.now()) {
      // Still active — someone is editing
      if (existing.actorId === actor.id) {
        // Same actor refreshing their session
        existing.expiresAt = Date.now() + SESSION_TTL;
        return { acquired: true };
      }
      return {
        acquired: false,
        currentEditor: {
          id: existing.actorId,
          type: existing.actorType,
          label: existing.label
        },
        message: `Document is being edited by ${existing.label || existing.actorId}`
      };
    }

    this.sessions.set(docId, {
      actorId: actor.id,
      actorType: actor.type || 'agent',
      label: actor.username || actor.label || actor.id,
      startedAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL
    });

    return { acquired: true };
  }

  /**
   * Release an editing session.
   */
  release(docId, actorId) {
    const existing = this.sessions.get(docId);
    if (existing && existing.actorId === actorId) {
      this.sessions.delete(docId);
      return true;
    }
    return false;
  }

  /**
   * Check if a document has an active editing session.
   */
  getSession(docId) {
    const existing = this.sessions.get(docId);
    if (existing && existing.expiresAt > Date.now()) {
      return {
        editorId: existing.actorId,
        editorType: existing.actorType,
        label: existing.label,
        startedAt: new Date(existing.startedAt).toISOString()
      };
    }
    return null;
  }

  /**
   * Optimistic lock check for document updates.
   * @param {object} doc — current document from store
   * @param {number} expectedVersion — version from client
   * @returns {{ ok: boolean, currentVersion?: number, error?: string }}
   */
  checkVersion(doc, expectedVersion) {
    const currentVersion = doc._version || doc.meta?.version || 0;

    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      return {
        ok: false,
        currentVersion,
        error: `Version conflict: expected v${expectedVersion}, current v${currentVersion}. Re-fetch and retry.`
      };
    }

    return { ok: true };
  }

  /**
   * List all active sessions.
   */
  listSessions() {
    const active = [];
    for (const [docId, session] of this.sessions) {
      if (session.expiresAt > Date.now()) {
        active.push({
          docId,
          editorId: session.actorId,
          editorType: session.actorType,
          label: session.label,
          remainingSeconds: Math.floor((session.expiresAt - Date.now()) / 1000)
        });
      }
    }
    return active;
  }

  _cleanup() {
    const now = Date.now();
    for (const [docId, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(docId);
      }
    }
  }

  destroy() {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    this.sessions.clear();
  }
}

// ── Singleton ──────────────────────────────────────────────

let _collab = null;

export function getCollab() {
  if (!_collab) _collab = new CollaborationEngine();
  return _collab;
}
