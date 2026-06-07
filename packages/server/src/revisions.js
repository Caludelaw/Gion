/**
 * Version History — 内容版本管理与 Diff
 *
 * 每次 create/update 自动创建版本快照。
 * API: GET /api/content/:type/:id/revisions
 */

import { getStore } from './context.js';
import { createLogger } from './logger.js';
import { randomUUID } from 'node:crypto';

const log = createLogger('revision');
const MAX_REVISIONS = parseInt(process.env.GION_MAX_REVISIONS) || 100;

/**
 * Snapshot a document revision.
 * Called after create or update.
 */
export async function snapshotRevision(doc, actor = {}) {
  try {
    const store = getStore();

    // Get current revision count for this document
    const existing = await store.list({ type: 'revision', limit: MAX_REVISIONS });
    const docRevisions = existing.filter(r => r.data.docId === doc.id);

    // Delete oldest if over limit
    if (docRevisions.length >= MAX_REVISIONS) {
      const oldest = docRevisions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
      if (oldest) await store.delete(oldest.id);
    }

    await store.create({
      type: 'revision',
      data: {
        docId: doc.id,
        docType: doc.type,
        data: doc.data,
        status: doc.status,
        meta: doc.meta || {},
        author: actor.id || 'system',
        authorType: actor.type || 'system',
        timestamp: doc.updatedAt || new Date().toISOString()
      },
      status: 'active'
    });
  } catch (err) {
    log.error(`Failed to snapshot revision for ${doc.id}: ${err.message}`);
  }
}

/**
 * Get revision history for a document.
 */
export async function getRevisions(docId, limit = 20) {
  const store = getStore();
  const docs = await store.list({ type: 'revision', limit: 200 });
  return docs
    .filter(r => r.data.docId === docId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map(r => ({
      id: r.id,
      timestamp: r.data.timestamp || r.createdAt,
      status: r.data.status,
      author: r.data.author,
      authorType: r.data.authorType,
      docType: r.data.docType,
      data: r.data.data,
      meta: r.data.meta
    }));
}

/**
 * Restore a document to a specific revision.
 */
export async function restoreRevision(docId, revisionId) {
  const store = getStore();
  const revisions = await getRevisions(docId, 200);
  const rev = await store.get(revisionId);

  if (!rev || rev.type !== 'revision') return null;

  const doc = await store.get(docId);
  if (!doc) return null;

  return store.update(docId, {
    data: rev.data.data,
    status: rev.data.status,
    meta: rev.data.meta
  });
}

/**
 * Simple field-level diff between two objects.
 */
export function diffObjects(oldData, newData) {
  const changes = [];
  const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);

  for (const key of allKeys) {
    const oldVal = JSON.stringify(oldData?.[key]);
    const newVal = JSON.stringify(newData?.[key]);
    if (oldVal !== newVal) {
      changes.push({
        field: key,
        from: oldData?.[key],
        to: newData?.[key]
      });
    }
  }

  return changes;
}
