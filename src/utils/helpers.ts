/**
 * 辅助工具函数
 * 
 * 通用的工具函数集合
 */

import path from 'path';
import os from 'os';
import fs from 'fs/promises';

/**
 * 展开波浪号路径 (~) 为完整路径
 * 
 * @param filepath - 文件路径
 * @returns 展开后的完整路径
 */
export function expandHome(filepath: string): string {
  if (filepath.startsWith('~')) {
    return filepath.replace('~', os.homedir());
  }
  return filepath;
}

/**
 * 确保目录存在，如果不存在则创建
 * 
 * @param dirPath - 目录路径
 * @returns 目录路径
 */
export async function ensureDir(dirPath: string): Promise<string> {
  const expandedPath = expandHome(dirPath);
  await fs.mkdir(expandedPath, { recursive: true });
  return expandedPath;
}

/**
 * 生成安全的文件名 (移除特殊字符)
 * 
 * @param filename - 原始文件名
 * @returns 安全的文件名
 */
export function safeFilename(filename: string): string {
  // 移除或替换不安全的字符
  return filename
    .replace(/[^a-zA-Z0-9_\-./]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/\/+/g, '/');
}

/**
 * 延迟执行
 * 
 * @param ms - 延迟的毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 超时包装器
 * 
 * @param promise - 要执行 的 Promise
 * @param timeoutMs - 超时时间 (毫秒)
 * @param errorMessage - 超时错误消息
 * @returns Promise
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = '操作超时'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${errorMessage} (超过 ${timeoutMs}ms)`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * 格式化时间戳为可读字符串
 * 
 * @param date - 日期对象
 * @returns 格式化后的时间字符串
 */
export function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
}

/**
 * 解析模型字符串 (例如 "openai:gpt-4o")
 * 
 * @param model - 模型字符串
 * @returns { provider: string; modelName: string }
 */
export function parseModelString(model: string): {
  provider: string;
  modelName: string;
} {
  const [provider, modelName] = model.split(':');
  return {
    provider: provider ?? 'openai',
    modelName: modelName ?? 'gpt-4o',
  };
}

/**
 * 检查路径是否在工作区内
 * 
 * @param targetPath - 目标路径
 * @param workspace - 工作区路径
 * @returns 是否在工作区内
 */
export function isPathInWorkspace(
  targetPath: string,
  workspace: string
): boolean {
  const expandedTarget = expandHome(targetPath);
  const expandedWorkspace = expandHome(workspace);

  const targetResolved = path.resolve(expandedTarget);
  const workspaceResolved = path.resolve(expandedWorkspace);

  return targetResolved.startsWith(workspaceResolved + path.sep);
}

/**
 * 读取 JSON 文件
 * 
 * @param filepath - 文件路径
 * @returns JSON 对象
 */
export async function readJSON<T = unknown>(
  filepath: string
): Promise<T | null> {
  try {
    const content = await fs.readFile(expandHome(filepath), 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * 写入 JSON 文件
 * 
 * @param filepath - 文件路径
 * @param data - JSON 数据
 */
export async function writeJSON<T = unknown>(
  filepath: string,
  data: T
): Promise<void> {
  const expandedPath = expandHome(filepath);
  const dirPath = path.dirname(expandedPath);
  await ensureDir(dirPath);
  await fs.writeFile(
    expandedPath,
    JSON.stringify(data, null, 2),
    'utf-8'
  );
}
