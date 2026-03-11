/**
 * nanobot init - 初始化配置与工作区
 */

import { Command } from 'commander';
import { success, info } from '../ui';
import { initializeWorkspace, type InitLogger } from '@/core';

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
  const cliLogger: InitLogger = {
    info: (msg: string) => info(msg),
    success: (msg: string) => success(msg),
    error: (msg: string) => info(msg),
  };

  try {
    await initializeWorkspace({
      force: force ?? false,
      logger: cliLogger,
    });
    process.exit(0);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    info(`Initialization failed: ${errorMessage}`);
    process.exit(1);
  }
}
