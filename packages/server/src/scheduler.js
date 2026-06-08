/**
 * Scheduler — 定时发布调度器
 *
 * 轮询数据库中 status='scheduled' 且 published_at <= now 的文档，
 * 自动将状态更新为 'published'。
 *
 * 配置：
 *   TAICHU_SCHEDULE_INTERVAL_MS  — 轮询间隔，默认 30000 (30s)
 *   TAICHU_SCHEDULE_BATCH_SIZE   — 单次最多处理条数，默认 50
 */

import { getStore } from './context.js';
import { createLogger } from './logger.js';
import { notify } from './notify.js';

const log = createLogger('scheduler');

let timer = null;

/**
 * Start the scheduled publishing loop.
 * @param {object} [hooks] — hook system instance for firing afterUpdate
 */
export function startScheduler(hooks) {
  const interval = parseInt(process.env.TAICHU_SCHEDULE_INTERVAL_MS) || 30000;
  const batchSize = parseInt(process.env.TAICHU_SCHEDULE_BATCH_SIZE) || 50;

  log.info(`Scheduler started — interval: ${interval}ms, batch: ${batchSize}`);

  // Run immediately on start
  tick(hooks, batchSize);

  timer = setInterval(() => tick(hooks, batchSize), interval);

  // Don't prevent process exit
  if (timer.unref) timer.unref();
}

/**
 * Stop the scheduler (for graceful shutdown).
 */
export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log.info('Scheduler stopped');
  }
}

/**
 * Single tick — find and publish due documents.
 */
async function tick(hooks, batchSize) {
  try {
    const store = getStore();
    if (!store) return;

    // Query documents with status='scheduled'
    const scheduled = await store.list({ status: 'scheduled', limit: batchSize });
    if (!scheduled.length) return;

    const now = new Date();
    const due = scheduled.filter(doc => {
      const pubAt = doc.publishedAt || doc.data?.publishedAt;
      if (!pubAt) return false; // no publish time set — skip
      return new Date(pubAt) <= now;
    });

    if (!due.length) return;

    log.info(`Publishing ${due.length} scheduled document(s)`);

    for (const doc of due) {
      try {
        const updated = await store.update(doc.id, {
          status: 'published',
          publishedAt: doc.publishedAt || doc.data?.publishedAt || new Date().toISOString(),
          data: { ...doc.data, publishedAt: doc.publishedAt || doc.data?.publishedAt || new Date().toISOString() }
        });

        // Fire afterUpdate hook (same as normal publish flow)
        if (hooks && updated) {
          await hooks.run('afterUpdate', updated, { actor: { id: 'scheduler', type: 'system' } }).catch(() => {});
        }

        notify('content_published', { doc: updated, actor: 'scheduler' }).catch(() => {});

        log.info(`Published: ${doc.id} (${doc.type})`);
      } catch (err) {
        log.error(`Failed to publish ${doc.id}: ${err.message}`);
      }
    }
  } catch (err) {
    log.error(`Scheduler tick error: ${err.message}`);
  }
}
