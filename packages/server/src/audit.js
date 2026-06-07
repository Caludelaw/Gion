/**
 * AuditLog — 操作审计日志
 *
 * 满足等保要求：操作日志 ≥ 6 个月留存，append-only。
 * 记录人/Agent 的所有内容操作。
 */

import { getStore } from './context.js';
import { createLogger } from './logger.js';

const log = createLogger('audit');

const RETENTION_DAYS = parseInt(process.env.TAICHU_AUDIT_RETENTION_DAYS) || 180;

/**
 * @param {object} entry
 * @param {string} entry.actorId — who (human id or agent key prefix)
 * @param {string} entry.actorType — "human" | "agent"
 * @param {string} entry.action — "create" | "update" | "delete" | "publish" | "archive" | "login" | "review"
 * @param {string} entry.resourceType — content type name
 * @param {string} entry.resourceId — document id
 * @param {object} [entry.detail] — additional info
 * @param {string} [entry.ip] — request IP
 */
export async function record(entry) {
  try {
    const store = getStore();
    await store.create({
      type: 'audit_log',
      data: {
        actorId: entry.actorId || 'system',
        actorType: entry.actorType || 'system',
        action: entry.action,
        resourceType: entry.resourceType || '',
        resourceId: entry.resourceId || '',
        detail: entry.detail || {},
        ip: entry.ip || ''
      },
      status: 'active'
    });
  } catch (err) {
    log.error(`Failed to record audit log: ${err.message}`);
  }
}

/**
 * Clean up logs older than retention period.
 * Called periodically (daily).
 */
export async function cleanupOldLogs() {
  const store = getStore();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const docs = await store.list({ type: 'audit_log', limit: 1000 });
    let deleted = 0;
    for (const doc of docs) {
      if (doc.createdAt < cutoff) {
        await store.delete(doc.id);
        deleted++;
      }
    }
    if (deleted > 0) log.info(`Audit log cleanup: removed ${deleted} entries older than ${RETENTION_DAYS} days`);
  } catch (err) {
    log.error(`Audit log cleanup failed: ${err.message}`);
  }
}

/**
 * Query audit logs.
 * @param {object} filters — { actorId, action, resourceType, resourceId, limit, offset }
 */
export async function query(filters = {}) {
  const store = getStore();
  const docs = await store.list({
    type: 'audit_log',
    limit: filters.limit || 50,
    offset: filters.offset || 0,
    orderBy: 'created_at',
    order: 'desc'
  });

  return docs
    .filter(d => {
      if (filters.actorId && d.data.actorId !== filters.actorId) return false;
      if (filters.action && d.data.action !== filters.action) return false;
      if (filters.resourceType && d.data.resourceType !== filters.resourceType) return false;
      return true;
    })
    .map(d => ({
      id: d.id,
      actorId: d.data.actorId,
      actorType: d.data.actorType,
      action: d.data.action,
      resourceType: d.data.resourceType,
      resourceId: d.data.resourceId,
      detail: d.data.detail,
      ip: d.data.ip,
      createdAt: d.createdAt
    }));
}

/** Run daily cleanup */
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000).unref();
