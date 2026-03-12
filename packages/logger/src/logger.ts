/**
 * 日志工具
 *
 * 使用 winston 实现高性能日志系统
 * 兼容 Pino 风格 API：logger.info(obj, msg) 与 logger.info(msg)，便于打包为单文件二进制（无 worker 线程）
 */
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

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

/** Pino 风格兼容：支持 (msg) 或 (obj, msg)，内部转为 Winston 的 (msg, meta) */
function wrapLog(winstonLogger: winston.Logger, level: 'debug' | 'info' | 'warn' | 'error') {
  return (first?: unknown, second?: unknown) => {
    if (typeof second === 'string' && typeof first === 'object' && first !== null) {
      // Pino 风格：(obj, msg) -> Winston (msg, meta)
      winstonLogger.log(level, second, first as Record<string, unknown>);
    } else if (typeof first === 'string') {
      // 单参数 msg 或 Winston 风格 (msg, meta)
      const meta =
        typeof second === 'object' && second !== null
          ? (second as Record<string, unknown>)
          : undefined;
      winstonLogger.log(level, first, meta);
    } else {
      winstonLogger.log(level, first != null ? String(first) : '', undefined);
    }
  };
}

/** 封装 Winston Logger，暴露 Pino 风格 API，保持现有调用方式不变；兼容 baileys ILogger（level + trace） */
function wrapLogger(winstonLogger: winston.Logger, levelOverride?: string): PinoCompatLogger {
  const level = levelOverride ?? winstonLogger.level ?? 'info';
  return {
    level,
    debug: wrapLog(winstonLogger, 'debug'),
    info: wrapLog(winstonLogger, 'info'),
    warn: wrapLog(winstonLogger, 'warn'),
    error: wrapLog(winstonLogger, 'error'),
    trace: wrapLog(winstonLogger, 'debug'), // Winston 无 trace，映射到 debug
    child(context: Record<string, unknown>) {
      return wrapLogger(winstonLogger.child(context), level);
    },
  };
}

/** 兼容 Pino 的 Logger 接口，使用方式不变：(msg) 或 (obj, msg)；含 level/trace 以兼容 baileys ILogger */
export interface PinoCompatLogger {
  level: string;
  debug: (first?: unknown, second?: unknown) => void;
  info: (first?: unknown, second?: unknown) => void;
  warn: (first?: unknown, second?: unknown) => void;
  error: (first?: unknown, second?: unknown) => void;
  trace: (first?: unknown, second?: unknown) => void;
  child(context: Record<string, unknown>): PinoCompatLogger;
}

/**
 * 创建 Logger 实例
 *
 * @param name - Logger 名称 (可选)
 * @param options - 可选：level 覆盖（如 'silent' 用于 baileys 等库）
 * @returns Logger 实例（兼容 Pino 风格：logger.info(obj, msg) / logger.info(msg)）
 */
export function createLogger(name?: string, options?: { level?: string }): PinoCompatLogger {
  // 根据环境变量或 options 决定日志级别
  const level = options?.level ?? process.env.LOG_LEVEL ?? LogLevel.INFO;

  // 判断是否为开发环境
  const isDev = process.env.NODE_ENV !== 'production';

  // 创建 Winston Logger (开发环境带颜色与时间戳，生产环境 JSON)
  const format = isDev
    ? winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
      winston.format.printf(({ level: lvl, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${lvl}: ${message}${metaStr}`.trim();
      }),
    )
    : winston.format.combine(winston.format.timestamp(), winston.format.json());

  const transports: winston.transport[] = [new winston.transports.Console()];

  // 添加文件日志传输
  const os = require('os');
  const logDir = path.join(os.homedir(), '.nanobot/workspace/logs');
  const logFile = path.join(logDir, 'nanobot.log');

  // 确保日志目录存在
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  transports.push(
    new winston.transports.File({
      filename: logFile,
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.timestamp(),
        winston.format.json(),
      ),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5, // 保留最近5个文件
      tailable: true, // 允许滚动
    }),
  );

  const baseLogger = winston.createLogger({
    level,
    format,
    defaultMeta: name ? { name } : {},
    transports,
  });

  return wrapLogger(baseLogger, level);
}

/**
 * 获取日志文件内容
 *
 * @param name - Logger 名称
 * @param limit - 返回的日志条数限制
 * @returns 日志条目数组
 */
export async function getLogs(name: string = 'nanobot', limit: number = 1000): Promise<any[]> {
  const os = require('os');
  const logDir = path.join(os.homedir(), '.nanobot/workspace/logs');
  const logFile = path.join(logDir, `${name}.log`);

  try {
    if (!fs.existsSync(logFile)) {
      return [];
    }

    const content = await readFile(logFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    // 解析 JSON 行
    const logs = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { message: line, timestamp: new Date().toISOString() };
      }
    });

    // 直接倒序（文件末尾为最新）
    logs.reverse();

    // 限制返回条数
    return logs.slice(0, limit);
  } catch (error) {
    console.error('Failed to read logs:', error);
    return [];
  }
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
export function createChildLogger(context: Record<string, unknown>): PinoCompatLogger {
  return logger.child(context);
}