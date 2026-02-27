/**
 * nanobot init - 初始化配置与工作区
 */

import path from 'path';
import fs from 'fs/promises';
import { Command } from 'commander';
import { saveConfig, createDefaultConfig } from '@/config/loader';
import { saveMCPConfig, createDefaultMCPConfig } from '@/mcp/loader';
import { expandHome, ensureDir } from '@/utils/helpers';
import { success, info } from '../ui';
import { NANOBOT_HOME, getPackageRoot, getTemplatesWorkspace } from '../constants';

const packageRoot = getPackageRoot(import.meta.url);
const templatesWorkspace = getTemplatesWorkspace(packageRoot);

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize config and workspace at ~/.nanobot')
    .option('-f, --force', 'Force reinitialize even if config exists')
    .action(async (opts: { force?: boolean }) => {
      await runInit(opts.force);
    });
}

async function runInit(force?: boolean): Promise<void> {
  await ensureDir(NANOBOT_HOME);
  const workspacePath = expandHome('~/.nanobot/workspace');
  await ensureDir(workspacePath);
  await ensureDir(path.join(workspacePath, 'memory'));
  await ensureDir(path.join(workspacePath, 'sessions'));
  await ensureDir(path.join(workspacePath, 'skills'));

  const mcpConfigPath = path.join(workspacePath, 'mcp.json');
  try {
    await fs.access(mcpConfigPath);
  } catch {
    await saveMCPConfig(createDefaultMCPConfig(), workspacePath);
    info(`Created ${mcpConfigPath}`);
  }

  const configPath = path.join(NANOBOT_HOME, 'config.json');

  if (!force) {
    try {
      await fs.access(configPath);
      info(`Config already exists: ${configPath}`);
      info('Use --force to overwrite.');
      return;
    } catch {
      // 配置不存在，继续创建
    }
  }

  const config = createDefaultConfig();
  await saveConfig(config, configPath);
  success(`Created ${configPath}`);

  try {
    const stat = await fs.stat(templatesWorkspace);
    if (!stat.isDirectory()) throw new Error('Not a directory');
  } catch {
    info('No templates/workspace found, skipping template copy');
    success('Init done.');
    return;
  }

  const templateFiles = await fs.readdir(templatesWorkspace);
  for (const name of templateFiles) {
    const src = path.join(templatesWorkspace, name);
    const dest = path.join(workspacePath, name);
    try {
      await fs.access(dest);
    } catch {
      const stat = await fs.stat(src);
      if (stat.isDirectory()) {
        await fs.cp(src, dest, { recursive: true });
      } else {
        await fs.copyFile(src, dest);
      }
      info(`Created ${path.relative(workspacePath, dest)}`);
    }
  }

  const memoryDir = path.join(templatesWorkspace, 'memory');
  try {
    const entries = await fs.readdir(memoryDir);
    const destMemory = path.join(workspacePath, 'memory');
    for (const name of entries) {
      const dest = path.join(destMemory, name);
      try {
        await fs.access(dest);
      } catch {
        await fs.copyFile(path.join(memoryDir, name), dest);
        info(`Created memory/${name}`);
      }
    }
  } catch {
    // no memory template
  }

  success('Init done. Edit ~/.nanobot/config.json and run "nanobot gateway".');
}
