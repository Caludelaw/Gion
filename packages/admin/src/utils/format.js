/**
 * Shared utility functions for admin views.
 * @file browser context — alert, console, etc. are global
 */
/* global alert */

/**
 * Format an ISO date string for display.
 * @param {string|Date|null} d
 * @param {'full'|'date'} [mode='full'] — 'full' = datetime, 'date' = date only
 * @returns {string}
 */
export function fmtDate(d, mode = 'full') {
  if (!d) return '-'
  if (mode === 'date') {
    return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  }
  return new Date(d).toLocaleString('zh-CN')
}

/**
 * Map a content status code to a human-readable Chinese label.
 */
const STATUS_MAP = {
  published: '已发布', draft: '草稿', scheduled: '定时', archived: '已归档',
  active: '启用', revoked: '已撤销', pending: '待审核', rejected: '已驳回'
}
export function statusLabel(s) {
  return STATUS_MAP[s] || s || '-'
}

/**
 * Show a user-facing error notification.
 * Uses alert() for now; can be upgraded to toast/notification later.
 * @param {string} action — the action that failed (e.g. '保存', '删除')
 * @param {Error|string} err
 */
export function notifyError(action, err) {
  const msg = err?.message || String(err || '')
  alert(`${action}失败: ${msg}`)
}

/**
 * Truncate a string to maxLen with ellipsis.
 */
export function truncate(s, maxLen = 80) {
  const str = String(s || '')
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str
}
