/**
 * 重试与速率限制工具
 */

import { logger } from './logger';

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;

  /** 初始重试延迟（毫秒） */
  retryDelay: number;

  /** 请求间隔（毫秒）- 用于防止达到速率限制 */
  requestInterval: number;
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  requestInterval: 100,
};

/**
 * 重试状态
 */
export interface RetryState {
  /** 上次请求时间 */
  lastRequestTime: number;

  /** 当前重试次数 */
  attempt: number;
}

/**
 * 创建重试状态
 */
export function createRetryState(): RetryState {
  return {
    lastRequestTime: 0,
    attempt: 0,
  };
}

/**
 * 检查错误是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();

  // 网络错误
  if (
    errorMessage.includes('econnreset') ||
    errorMessage.includes('etimedout') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('network') ||
    errorMessage.includes('fetch failed')
  ) {
    return true;
  }

  // 5xx 服务器错误
  if (
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503') ||
    errorMessage.includes('504')
  ) {
    return true;
  }

  // Rate limit 错误 (429)
  if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
    return true;
  }

  return false;
}

/**
 * 应用速率限制
 *
 * @param state - 重试状态
 * @param config - 重试配置
 */
export async function applyRateLimit(
  state: RetryState,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - state.lastRequestTime;

  if (timeSinceLastRequest < config.requestInterval) {
    const delay = config.requestInterval - timeSinceLastRequest;
    logger.debug(`Rate limit: waiting ${delay}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  state.lastRequestTime = Date.now();
}

/**
 * 带重试的异步执行
 *
 * @param fn - 要执行的异步函数
 * @param context - 执行上下文（用于日志）
 * @param state - 重试状态
 * @param config - 重试配置
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  state: RetryState = createRetryState(),
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error | undefined;

  for (state.attempt = 0; state.attempt <= config.maxRetries; state.attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (state.attempt < config.maxRetries && isRetryableError(error)) {
        const delay = config.retryDelay * Math.pow(2, state.attempt);
        logger.warn(
          `${context} failed (attempt ${state.attempt + 1}/${config.maxRetries + 1}), retrying in ${delay}ms... Error: ${lastError.message}`,
        );

        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error(`${context} failed after ${state.attempt + 1} attempts`);
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error(`${context} failed`);
}

/**
 * 带重试和速率限制的异步执行
 *
 * @param fn - 要执行的异步函数
 * @param context - 执行上下文
 * @param state - 重试状态
 * @param config - 重试配置
 */
export async function withRetryAndRateLimit<T>(
  fn: () => Promise<T>,
  context: string,
  state: RetryState = createRetryState(),
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  await applyRateLimit(state, config);
  return withRetry(fn, context, state, config);
}
