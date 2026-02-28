/**
 * nanobot init - 初始化配置与工作区（TUI）
 */

import { Command } from 'commander';
import { runTui } from '../tui';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize config and workspace at ~/.nanobot')
    .option('-f, --force', 'Force reinitialize even if config exists')
    .action(async (opts: { force?: boolean }) => {
      await runTui('init', { force: opts.force ?? false });
    });
}
