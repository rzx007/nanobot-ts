/**
 * 日志工具
 * 
 * 使用 Pino 实现高性能日志系统
 */

import pino from 'pino';

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * 创建 Logger 实例
 * 
 * @param name - Logger 名称 (可选)
 * @returns Logger 实例
 */
export function createLogger(name?: string): pino.Logger {
  // 根据环境变量决定日志级别
  const level = process.env.LOG_LEVEL ?? LogLevel.INFO;

  // 判断是否为开发环境
  const isDev = process.env.NODE_ENV !== 'production';

  // 创建 Pino Logger (开发环境用 transport，生产环境用默认)
  const baseOptions: pino.LoggerOptions = { name: name ?? '', level };
  const baseLogger = isDev
    ? pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    })
    : pino({
      ...baseOptions,
      serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
      },
    });

  return baseLogger;
}

/**
 * 默认 Logger
 */
export const logger = createLogger('nanobot');

/**
 * 创建子 Logger (带有额外上下文)
 * 
 * @param context - 额外的上下文信息
 * @returns 子 Logger 实例
 */
export function createChildLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}
