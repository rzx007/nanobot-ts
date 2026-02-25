/**
 * 自定义错误类
 * 
 * 定义 nanobot 项目中使用的所有错误类型
 */

/**
 * nanobot 基础错误
 */
export class NanobotError extends Error {
  /** 错误代码 */
  readonly code: string;

  /** 错误上下文 */
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    context?: Record<string, unknown>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'NanobotError';
    this.code = code;
    if (context !== undefined) this.context = context;
  }
}

/**
 * 配置错误
 */
export class ConfigError extends NanobotError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONFIG_ERROR', context);
    this.name = 'ConfigError';
  }
}

/**
 * Provider 错误
 */
export class ProviderError extends NanobotError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'PROVIDER_ERROR', context);
    this.name = 'ProviderError';
  }
}

/**
 * 工具错误
 */
export class ToolError extends NanobotError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'TOOL_ERROR', context);
    this.name = 'ToolError';
  }
}

/**
 * 渠道错误
 */
export class ChannelError extends NanobotError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CHANNEL_ERROR', context);
    this.name = 'ChannelError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends NanobotError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends NanobotError {
  constructor(
    message: string,
    timeout: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'TIMEOUT_ERROR', { ...context, timeout });
    this.name = 'TimeoutError';
  }
}

/**
 * 文件系统错误
 */
export class FileSystemError extends NanobotError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'FILESYSTEM_ERROR', context);
    this.name = 'FileSystemError';
  }
}

/**
 * 判断是否为 nanobot 错误
 * 
 * @param error - 错误对象
 * @returns 是否为 nanobot 错误
 */
export function isNanobotError(error: unknown): error is NanobotError {
  return error instanceof NanobotError;
}
