/**
 * Logger — 结构化日志系统
 *
 * JSON 格式输出，支持分级和请求追踪。
 *
 * 级别（数值越小越详细）：
 *   debug: 0 — 开发调试
 *   info:  1 — 常规信息
 *   warn:  2 — 警告
 *   error: 3 — 错误
 *
 * 环境变量：
 *   GION_LOG_LEVEL  — 最小输出级别（默认 info）
 *   GION_LOG_FORMAT — "json" | "pretty"（默认 pretty）
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL_LABELS = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

// ANSI 颜色（pretty 模式）
const COLORS = {
  debug: '\x1b[90m',  // gray
  info:  '\x1b[36m',  // cyan
  warn:  '\x1b[33m',  // yellow
  error: '\x1b[31m',  // red
  reset: '\x1b[0m',
  dim:   '\x1b[2m',
  bold:  '\x1b[1m'
};

const minLevel = LEVELS[process.env.GION_LOG_LEVEL || 'info'] ?? 1;
const format = process.env.GION_LOG_FORMAT || 'pretty';

/**
 * @param {string} level
 * @param {string} message
 * @param {object} [context]
 */
function log(level, message, context = {}) {
  if (LEVELS[level] < minLevel) return;

  const ts = new Date().toISOString();

  if (format === 'json') {
    const entry = { ts, level, message, ...context };
    console.log(JSON.stringify(entry));
    return;
  }

  // Pretty format
  const color = COLORS[level] || '';
  const label = level.toUpperCase().padEnd(5);
  const extra = Object.keys(context).length
    ? COLORS.dim + ' ' + JSON.stringify(context) + COLORS.reset
    : '';

  console.log(`${COLORS.dim}${ts}${COLORS.reset} ${color}${COLORS.bold}${label}${COLORS.reset} ${message}${extra}`);
}

export const logger = {
  debug: (msg, ctx) => log('debug', msg, ctx),
  info:  (msg, ctx) => log('info', msg, ctx),
  warn:  (msg, ctx) => log('warn', msg, ctx),
  error: (msg, ctx) => log('error', msg, ctx)
};

/**
 * Create a child logger with a fixed namespace.
 * Usage: const log = logger.child('store'); log.info('connected');
 */
export function createLogger(namespace) {
  return {
    debug: (msg, ctx) => logger.debug(`[${namespace}] ${msg}`, ctx),
    info:  (msg, ctx) => logger.info(`[${namespace}] ${msg}`, ctx),
    warn:  (msg, ctx) => logger.warn(`[${namespace}] ${msg}`, ctx),
    error: (msg, ctx) => logger.error(`[${namespace}] ${msg}`, ctx)
  };
}
