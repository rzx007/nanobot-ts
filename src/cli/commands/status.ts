/**
 * nanobot status - 显示配置与状态（TUI）
 */

import { Command } from 'commander';
import { runTui } from '../tui';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show config and status')
    .action(async () => {
      await runTui('status');
    });
}
