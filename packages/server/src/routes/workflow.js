/**
 * Workflow Engine — 内容审核工作流
 *
 * 状态机驱动的审核流程。
 * 内置流程：draft → review → approved → published
 * 自定义流程通过 WorkflowTemplate 内容类型定义。
 *
 * API:
 *   POST /api/workflow/request — 提交审核
 *   POST /api/workflow/approve/:id — 通过审核
 *   POST /api/workflow/reject/:id — 驳回
 *   GET  /api/workflow/status/:id — 查看状态
 */

import { getStore } from './context.js';
import { requireAuth } from './middleware/auth.js';
import { record as auditRecord } from './audit.js';
import { notify } from './notify.js';
import { createLogger } from './logger.js';

const log = createLogger('workflow');

const DEFAULT_STATES = ['draft', 'pending_review', 'approved', 'published', 'rejected', 'archived'];
const VALID_TRANSITIONS = {
  'draft':          ['pending_review', 'published', 'archived'],
  'pending_review': ['approved', 'rejected'],
  'approved':       ['published', 'rejected'],
  'published':      ['archived'],
  'rejected':       ['draft', 'pending_review'],
  'archived':       ['draft']
};

/**
 * Request a review.
 */
export async function requestReview(docId, ctx) {
  const store = getStore();
  const doc = await store.get(docId);
  if (!doc) throw { status: 404, message: 'Document not found' };

  const current = doc.data?.workflowState || doc.status;
  if (!VALID_TRANSITIONS[current]?.includes('pending_review')) {
    throw { status: 400, message: `Cannot review from "${current}" state` };
  }

  await store.update(docId, { data: { ...doc.data, workflowState: 'pending_review', reviewRequestedBy: ctx.actor?.id, reviewRequestedAt: new Date().toISOString() } });
  auditRecord({ actorId: ctx.actor?.id, actorType: ctx.actor?.type || 'human', action: 'review_requested', resourceType: doc.type, resourceId: doc.id }).catch(() => {});
  notify('review_requested', { doc, actor: ctx.actor?.username || 'User' }).catch(() => {});

  return { success: true, state: 'pending_review' };
}

/**
 * Approve a review.
 */
export async function approve(docId, ctx, comment = '') {
  const store = getStore();
  const doc = await store.get(docId);
  if (!doc) throw { status: 404, message: 'Document not found' };

  const current = doc.data?.workflowState || doc.status;
  if (current !== 'pending_review' && current !== 'approved') {
    throw { status: 400, message: `Cannot approve from "${current}" state` };
  }

  const newState = 'approved';
  await store.update(docId, {
    data: { ...doc.data, workflowState: newState, reviewApprovedBy: ctx.actor?.id, reviewApprovedAt: new Date().toISOString(), reviewComment: comment },
    status: 'published'
  });
  auditRecord({ actorId: ctx.actor?.id, actorType: ctx.actor?.type || 'human', action: 'approved', resourceType: doc.type, resourceId: doc.id }).catch(() => {});
  notify('content_published', { doc, actor: ctx.actor?.username || 'User' }).catch(() => {});

  return { success: true, state: newState };
}

/**
 * Reject a review.
 */
export async function reject(docId, ctx, reason = '') {
  const store = getStore();
  const doc = await store.get(docId);
  if (!doc) throw { status: 404, message: 'Document not found' };

  await store.update(docId, { data: { ...doc.data, workflowState: 'rejected', reviewRejectedBy: ctx.actor?.id, reviewRejectedAt: new Date().toISOString(), reviewRejectReason: reason } });
  auditRecord({ actorId: ctx.actor?.id, actorType: ctx.actor?.type || 'human', action: 'rejected', resourceType: doc.type, resourceId: doc.id }).catch(() => {});

  return { success: true, state: 'rejected' };
}

// ── Routes ─────────────────────────────────────────────────

export async function workflowRoutes(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  const authResult = await requireAuth(ctx);
  if (!authResult.authenticated) {
    ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
    return;
  }
  ctx.actor = authResult.actor;

  try {
    // POST /api/workflow/request/:docId
    const reqMatch = pathname.match(/^\/api\/workflow\/request\/([\w-]+)$/);
    if (reqMatch && method === 'POST') {
      const result = await requestReview(reqMatch[1], ctx);
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
      return;
    }

    // POST /api/workflow/approve/:docId
    const approveMatch = pathname.match(/^\/api\/workflow\/approve\/([\w-]+)$/);
    if (approveMatch && method === 'POST') {
      const result = await approve(approveMatch[1], ctx, (ctx.body || {}).comment || '');
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
      return;
    }

    // POST /api/workflow/reject/:docId
    const rejectMatch = pathname.match(/^\/api\/workflow\/reject\/([\w-]+)$/);
    if (rejectMatch && method === 'POST') {
      const result = await reject(rejectMatch[1], ctx, (ctx.body || {}).reason || '');
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
      return;
    }

    // GET /api/workflow/status/:docId
    const statusMatch = pathname.match(/^\/api\/workflow\/status\/([\w-]+)$/);
    if (statusMatch && method === 'GET') {
      const store = getStore();
      const doc = await store.get(statusMatch[1]);
      if (!doc) { ctx.res.writeHead(404, { 'Content-Type': 'application/json' }); ctx.res.end(JSON.stringify({ error: 'NOT_FOUND' })); return; }
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({
        state: doc.data?.workflowState || doc.status,
        transitions: VALID_TRANSITIONS[doc.data?.workflowState || doc.status] || [],
        reviewRequestedBy: doc.data?.reviewRequestedBy,
        reviewRequestedAt: doc.data?.reviewRequestedAt
      }));
      return;
    }
  } catch (err) {
    ctx.res.writeHead(err.status || 500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: err.message || 'Internal error' }));
    return;
  }

  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}
