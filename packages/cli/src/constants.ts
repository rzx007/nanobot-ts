/**
 * CLI 常量与路径
 */

import path from 'path';
import { fileURLToPath } from 'url';

export const NANOBOT_HOME =
  process.env.NANOBOT_HOME ??
  path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.nanobot');

export const DEFAULT_CONFIG_PATH = path.join(NANOBOT_HOME, 'config.json');

/** 默认工作区路径（与 NANOBOT_HOME 一致，便于 env 覆盖） */
export const DEFAULT_WORKSPACE_PATH = path.join(NANOBOT_HOME, 'workspace');

export const DEFAULT_MCP_CONFIG_PATH = path.join(DEFAULT_WORKSPACE_PATH, 'mcp.json');

/** 工作区子目录名，用于创建目录结构 */
export const WORKSPACE_SUBDIRS = ['memory', 'sessions', 'logs'] as const;

/** memory 子目录名（与 WORKSPACE_SUBDIRS 一致，便于单独引用） */
export const MEMORY_DIR = 'memory';

/**
 * 从当前模块所在目录计算包根目录 (src 或 dist 的上一级)
 * @param metaUrl - import.meta.url
 */
export function getPackageRoot(metaUrl: string): string {
  const filePath = fileURLToPath(metaUrl);
  const dir = path.dirname(filePath);
  // 判断一下路劲包含src(大概率是开发环境)
  if (dir.includes('src')) {
    return path.resolve(dir, '..', '..', '..');
  }
  
  return path.resolve(dir, '..', '..');
}

export function getTemplatesWorkspace(packageRoot: string): string {
  return path.join(packageRoot, 'templates', 'workspace');
}
