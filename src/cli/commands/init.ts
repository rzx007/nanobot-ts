/**
 * nanobot init - 初始化配置与工作区
 */

import { Command } from 'commander';
import { success, info } from '../ui';
import { initializeWorkspace } from '../lib/init';

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
  const cliLogger = {
    info: (msg: string) => info(msg),
    success: (msg: string) => success(msg),
    error: (msg: string) => console.error(msg),
  };

  await initializeWorkspace({
    force: force ?? false,
    logger: cliLogger,
  });

 
  process.exit(0);
}
