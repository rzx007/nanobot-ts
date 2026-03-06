/**
 * 共享的初始化逻辑
 * 供命令行 init 和 TUI 首次运行使用
 */

import path from 'path';
import fs from 'fs/promises';
import { saveConfig, createDefaultConfig } from '@/config/loader';
import { saveMCPConfig, createDefaultMCPConfig, getMCPConfigPath } from '@/mcp/loader';
import { expandHome, ensureDir } from '@/utils/helpers';
import {
  NANOBOT_HOME,
  DEFAULT_CONFIG_PATH,
  DEFAULT_WORKSPACE_PATH,
  getPackageRoot,
  getTemplatesWorkspace,
  WORKSPACE_SUBDIRS,
  MEMORY_DIR,
} from '../constants';

/**
 * 初始化进度接口（用于 TUI）
 */
export interface InitProgress {
  setStep(name: string, status: 'running' | 'done', message?: string): void;
  setError(message: string): void;
  setDone(): void;
}

/**
 * 日志接口（用于 CLI）
 */
export interface InitLogger {
  info(message: string): void;
  success(message: string): void;
  error(message: string): void;
}

/**
 * 初始化选项
 */
export interface InitOptions {
  force?: boolean;
  progress?: InitProgress;
  logger?: InitLogger;
}

/**
 * 创建工作区目录结构
 */
async function createDirectories(workspacePath: string, options: InitOptions): Promise<void> {
  const { progress, logger } = options;

  if (progress) {
    progress.setStep('Directories', 'running');
  }

  await ensureDir(NANOBOT_HOME);
  await ensureDir(workspacePath);
  for (const sub of WORKSPACE_SUBDIRS) {
    await ensureDir(path.join(workspacePath, sub));
  }

  if (progress) {
    progress.setStep('Directories', 'done');
  }
  if (logger) {
    logger.success('🎉 Created workspace directories');
  }
}

/**
 * 创建 MCP 配置文件
 */
async function setupMCPConfig(workspacePath: string, options: InitOptions): Promise<void> {
  const { progress, logger } = options;
  const mcpConfigPath = getMCPConfigPath(workspacePath);

  if (progress) {
    progress.setStep('MCP config', 'running');
  }

  try {
    await fs.access(mcpConfigPath);
    if (progress) {
      progress.setStep('MCP config', 'done', 'already exists');
    }
    if (logger) {
      logger.info(`MCP config already exists: ${mcpConfigPath}`);
    }
  } catch {
    await saveMCPConfig(createDefaultMCPConfig(), workspacePath);
    if (progress) {
      progress.setStep('MCP config', 'done', 'created');
    }
    if (logger) {
      logger.info(`🎉 Created ${mcpConfigPath}`);
    }
  }
}

/**
 * 创建配置文件
 */
async function setupConfig(force: boolean, options: InitOptions): Promise<boolean> {
  const { progress, logger } = options;
  const configPath = expandHome(DEFAULT_CONFIG_PATH);

  if (progress) {
    progress.setStep('Config', 'running');
  }

  if (!force) {
    try {
      await fs.access(configPath);
      if (progress) {
        progress.setStep('Config', 'done', 'already exists (use --force to overwrite)');
        progress.setDone();
      }
      if (logger) {
        logger.info(`Config already exists: ${configPath}`);
        logger.info('Use --force to overwrite.');
      }
      return false;
    } catch {
      // 配置不存在，继续创建
    }
  }

  const config = createDefaultConfig();
  await saveConfig(config, configPath);

  if (progress) {
    progress.setStep('Config', 'done', 'created');
  }
  if (logger) {
    logger.success(`🚀 Created ${configPath}`);
  }

  return true;
}

/**
 * 验证并获取模板目录路径
 */
async function validateTemplates(options: InitOptions): Promise<string | null> {
  const { progress, logger } = options;
  const packageRoot = getPackageRoot(import.meta.url);
  const templatesWorkspace = getTemplatesWorkspace(packageRoot);
  if (progress) {
    progress.setStep('Templates', 'running');
  }

  try {
    const stat = await fs.stat(templatesWorkspace);
    if (!stat.isDirectory()) {
      throw new Error('Not a directory');
    }
    return templatesWorkspace;
  } catch {
    if (progress) {
      progress.setStep('Templates', 'done', 'no templates found');
      progress.setDone();
    }
    if (logger) {
      logger.info('No templates/workspace found, skipping template copy');
    }
    return null;
  }
}

/**
 * 复制工作区模板（包括 skills, memory, *.md, mcp.json）
 */
async function copyWorkspaceTemplates(
  workspacePath: string,
  templatesWorkspace: string,
  options: InitOptions,
): Promise<void> {
  const { progress, logger } = options;

  const templateFiles = await fs.readdir(templatesWorkspace);
  for (const name of templateFiles) {
    const src = path.join(templatesWorkspace, name);
    const dest = path.join(workspacePath, name);
    try {
      await fs.access(dest);
      // 文件已存在，跳过
    } catch {
      const stat = await fs.stat(src);
      if (stat.isDirectory()) {
        await fs.cp(src, dest, { recursive: true });
      } else {
        await fs.copyFile(src, dest);
      }
      if (logger) {
        logger.info(`🎉 Created ${path.relative(workspacePath, dest)}`);
      }
    }
  }

  if (progress) {
    progress.setStep('Templates', 'done');
  }
  if (logger) {
    logger.info('Copied workspace templates');
  }
}

/**
 * 复制 memory 模板
 */
async function copyMemoryTemplates(
  workspacePath: string,
  templatesWorkspace: string,
  options: InitOptions,
): Promise<void> {
  const { progress, logger } = options;
  const memoryDir = path.join(templatesWorkspace, MEMORY_DIR);
  const destMemory = path.join(workspacePath, MEMORY_DIR);

  if (progress) {
    progress.setStep('Memory templates', 'running');
  }

  try {
    const entries = await fs.readdir(memoryDir);
    for (const name of entries) {
      const dest = path.join(destMemory, name);
      try {
        await fs.access(dest);
        // 文件已存在，跳过
      } catch {
        await fs.copyFile(path.join(memoryDir, name), dest);
        if (logger) {
          logger.info(`🎉 Created ${MEMORY_DIR}/${name}`);
        }
      }
    }
    if (progress) {
      progress.setStep('Memory templates', 'done');
    }
  } catch {
    // no memory template
    if (progress) {
      progress.setStep('Memory templates', 'done', 'none');
    }
    if (logger) {
      logger.info('No memory templates found');
    }
  }
}

/**
 * 主初始化函数
 *
 * @param options - 初始化选项
 * @returns Promise<void>
 */
export async function initializeWorkspace(options: InitOptions = {}): Promise<void> {
  const { force, progress, logger } = options;
  const workspacePath = expandHome(DEFAULT_WORKSPACE_PATH);

  try {
    // 1. 创建目录结构
    await createDirectories(workspacePath, options);

    // 2. 创建 MCP config
    await setupMCPConfig(workspacePath, options);

    // 3. 创建配置文件
    const configCreated = await setupConfig(force ?? false, options);
    if (!configCreated && !force) {
      // 配置已存在且不强制覆盖，提前返回
      return;
    }

    // 4. 验证模板目录
    const templatesWorkspace = await validateTemplates(options);
    if (!templatesWorkspace) {
      if (progress) {
        progress.setDone();
      }
      return;
    }

    // 5. 复制工作区模板（包括 skills/, memory/, *.md, mcp.json）
    await copyWorkspaceTemplates(workspacePath, templatesWorkspace, options);

    // 6. 复制 memory 模板
    await copyMemoryTemplates(workspacePath, templatesWorkspace, options);

    if (progress) {
      progress.setDone();
    }
    logger?.success(`🎉🎉🎉 Init done. Edit ~/.nanobot/config.json and run "nanobot-ts gateway" or run "nanobot-ts" for TUI.`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (progress) {
      progress.setError(errorMessage);
    }
    logger?.error(`🚧 Error: ${errorMessage}`);
    throw error;
  }
}
