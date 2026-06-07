/**
 * Taichu Errors — 结构化错误类型
 *
 * 所有 Taichu 内部错误都使用这些类，方便：
 *   - 前端精确展示错误信息
 *   - Agent 通过错误码做决策
 *   - 日志系统分类处理
 */

export class TaichuError extends Error {
  constructor(message, code = 'TAICHU_ERROR', status = 500) {
    super(message);
    this.name = 'TaichuError';
    this.code = code;
    this.status = status;
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      status: this.status
    };
  }
}

export class ValidationError extends TaichuError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends TaichuError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends TaichuError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends TaichuError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends TaichuError {
  constructor(message) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}
