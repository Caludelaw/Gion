/**
 * Gion Errors — 结构化错误类型
 *
 * 所有 Gion 内部错误都使用这些类，方便：
 *   - 前端精确展示错误信息
 *   - Agent 通过错误码做决策
 *   - 日志系统分类处理
 */

export class GionError extends Error {
  constructor(message, code = 'GION_ERROR', status = 500) {
    super(message);
    this.name = 'GionError';
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

export class ValidationError extends GionError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends GionError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends GionError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends GionError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends GionError {
  constructor(message) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}
