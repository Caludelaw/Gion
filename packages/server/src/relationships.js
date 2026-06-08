/**
 * Content Relationships — 内容关系图谱
 *
 * 管理文档间的引用关系，支持：
 *   - related_to / parent_of / child_of / references / translated_from
 *   - 双向索引（反向查找）
 *   - 子图遍历（BFS，可配深度）
 *
 * 关系存储在文档 data._relationships 数组中。
 */

import { createLogger } from './logger.js';

const log = createLogger('relationships');

const VALID_TYPES = [
  'related_to',      // 通用关联
  'parent_of',       // 父子层级
  'child_of',        // 反向父子（自动维护）
  'references',      // 引用
  'translated_from'  // 翻译源
];

/**
 * @typedef {object} Relationship
 * @property {string} type     — 关系类型
 * @property {string} targetId — 目标文档 ID
 * @property {object} [meta]   — 附加元数据
 * @property {string} createdAt — ISO 8601
 */

/**
 * Add a relationship between two documents.
 * @param {object} store        — content store
 * @param {string} sourceId     — 源文档 ID
 * @param {string} targetId     — 目标文档 ID
 * @param {string} type         — 关系类型
 * @param {object} [meta]       — 元数据
 */
export async function addRelationship(store, sourceId, targetId, type, meta = {}) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid relationship type: ${type}. Must be one of: ${VALID_TYPES.join(', ')}`);
  }

  const sourceDoc = await store.get(sourceId);
  const targetDoc = await store.get(targetId);
  if (!sourceDoc) throw new Error(`Source document not found: ${sourceId}`);
  if (!targetDoc) throw new Error(`Target document not found: ${targetId}`);
  if (sourceId === targetId) throw new Error('Cannot create self-referencing relationship');

  // Check for duplicate
  const existing = sourceDoc.data._relationships || [];
  if (existing.some(r => r.targetId === targetId && r.type === type)) {
    return { alreadyExists: true };
  }

  const rel = { type, targetId, meta, createdAt: new Date().toISOString() };
  existing.push(rel);

  await store.update(sourceId, {
    data: { _relationships: existing }
  });

  // Auto-maintain reverse relationship for parent_of
  if (type === 'parent_of') {
    const targetRels = targetDoc.data._relationships || [];
    if (!targetRels.some(r => r.targetId === sourceId && r.type === 'child_of')) {
      targetRels.push({ type: 'child_of', targetId: sourceId, autoCreated: true, createdAt: new Date().toISOString() });
      await store.update(targetId, { data: { _relationships: targetRels } });
    }
  }

  log.debug(`Relationship created: ${sourceId} --[${type}]--> ${targetId}`);
  return { created: true, relationship: rel };
}

/**
 * Remove a relationship.
 */
export async function removeRelationship(store, sourceId, targetId, type) {
  const sourceDoc = await store.get(sourceId);
  if (!sourceDoc) throw new Error(`Document not found: ${sourceId}`);

  const rels = (sourceDoc.data._relationships || []).filter(
    r => !(r.targetId === targetId && (!type || r.type === type))
  );

  if (rels.length === (sourceDoc.data._relationships || []).length) {
    return { notFound: true };
  }

  await store.update(sourceId, {
    data: { _relationships: rels.length ? rels : undefined }
  });

  // Clean up reverse child_of if parent_of was removed
  if (type === 'parent_of' || !type) {
    try {
      const targetDoc = await store.get(targetId);
      if (targetDoc) {
        const targetRels = (targetDoc.data._relationships || []).filter(
          r => !(r.type === 'child_of' && r.targetId === sourceId && r.autoCreated)
        );
        if (targetRels.length !== (targetDoc.data._relationships || []).length) {
          await store.update(targetId, { data: { _relationships: targetRels.length ? targetRels : undefined } });
        }
      }
    } catch (_) {}
  }

  log.debug(`Relationship removed: ${sourceId} --[${type}]--> ${targetId}`);
  return { removed: true };
}

/**
 * Get all relationships for a document (outgoing).
 * @returns {Promise<Relationship[]>}
 */
export async function getRelationships(store, sourceId) {
  const doc = await store.get(sourceId);
  if (!doc) return [];
  return (doc.data._relationships || []).map(r => ({
    ...r,
    sourceId,
    sourceType: doc.type,
    sourceTitle: doc.data?.title || doc.data?.name || ''
  }));
}

/**
 * Find documents that reference a target (incoming relationships).
 */
export async function getBacklinks(store, targetId) {
  // Scan all documents — for larger datasets, this should use a dedicated index
  const allDocs = await store.list({ limit: 10000 });
  const backlinks = [];
  for (const doc of allDocs) {
    const rels = doc.data._relationships || [];
    for (const r of rels) {
      if (r.targetId === targetId) {
        backlinks.push({
          ...r,
          sourceId: doc.id,
          sourceType: doc.type,
          sourceTitle: doc.data?.title || doc.data?.name || ''
        });
      }
    }
  }
  return backlinks;
}

/**
 * Get full relationship context (outgoing + incoming).
 */
export async function getAllRelationships(store, docId) {
  const [outgoing, incoming] = await Promise.all([
    getRelationships(store, docId),
    getBacklinks(store, docId)
  ]);
  return { outgoing, incoming, total: outgoing.length + incoming.length };
}

/**
 * Traverse relationship subgraph via BFS.
 * @param {object} store
 * @param {string} startId
 * @param {object} opts
 * @param {number} [opts.depth=2]       — max traversal depth
 * @param {string[]} [opts.types]       — filter to specific relationship types
 * @returns {Promise<{nodes: object[], edges: object[]}>}
 */
export async function traverseGraph(store, startId, opts = {}) {
  const depth = opts.depth || 2;
  const typeFilter = opts.types || null;

  const visited = new Set();
  const nodes = [];
  const edges = [];
  const queue = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth: currentDepth } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);

    const doc = await store.get(id);
    if (!doc) continue;

    nodes.push({
      id: doc.id,
      type: doc.type,
      title: doc.data?.title || doc.data?.name || '',
      status: doc.status,
      depth: currentDepth
    });

    if (currentDepth >= depth) continue;

    const rels = doc.data._relationships || [];
    for (const r of rels) {
      if (typeFilter && !typeFilter.includes(r.type)) continue;
      if (visited.has(r.targetId)) continue;

      edges.push({
        from: doc.id,
        to: r.targetId,
        type: r.type,
        meta: r.meta || {}
      });

      queue.push({ id: r.targetId, depth: currentDepth + 1 });
    }
  }

  return { nodes, edges };
}
