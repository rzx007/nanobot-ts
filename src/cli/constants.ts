/**
 * CLI 常量与路径
 */

import path from 'path';

export const NANOBOT_HOME =
  process.env.NANOBOT_HOME ??
  path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.nanobot');

export const DEFAULT_CONFIG_PATH = path.join(NANOBOT_HOME, 'config.json');

/**
 * 从当前模块所在目录计算包根目录 (src 或 dist 的上一级)
 * @param metaUrl - import.meta.url
 */
export function getPackageRoot(metaUrl: string): string {
  const dir = path.dirname(new URL(metaUrl).pathname);
  return path.resolve(dir, '..', '..');
}

export function getTemplatesWorkspace(packageRoot: string): string {
  return path.join(packageRoot, 'templates', 'workspace');
}
