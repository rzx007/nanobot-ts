/**
 * HTTP 服务器类型定义
 */

import type { Runtime } from '@nanobot/main';
import type { Config } from '@nanobot/shared';
import type { MessageBus } from '@nanobot/main';
import type { QuestionManager } from '@nanobot/shared';

/**
 * 服务器上下文
 */
export interface ServerContext {
  /** Agent 运行时 */
  runtime: Runtime;

  /** 消息总线 */
  bus: MessageBus;

  /** 问题管理器 */
  questionManager: QuestionManager;

  /** 配置 */
  config: Config;

  /** 通道管理器 */
  channelManager: import('@nanobot/channels').ChannelManager;

  /** 服务器启动时间 */
  startTime: Date;
}

/**
 * 扩展 Hono Context 类型
 */
export type AppContext = {
  Variables: ServerContext;
};

/**
 * API 错误响应
 */
export interface ApiErrorResponse {
  error: {
    code: number;
    message: string;
    data?: T;
    details?: unknown;
  }
}

/**
 * 健康检查响应
 */
export class ApiError extends Error {
  constructor(
    public code: number,
    public message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(400, message, details);
  }
}

export class InternalError extends ApiError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(500, message, details);
  }
}

/**
 * API 响应格式
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
  details?: unknown;
}

/**
 * 流式响应事件
 */
export interface SSEEvent {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

/**
 * 健康检查响应
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  version: string;
  timestamp: string;
}

export interface DetailedHealthStatus extends HealthStatus {
  bus: {
    inboundQueueLength: number;
    outboundQueueLength: number;
  };
  sessions: {
    count: number;
  };
  channels: Array<{
    name: string;
    registered: boolean;
    enabled: boolean;
  }>;
}
