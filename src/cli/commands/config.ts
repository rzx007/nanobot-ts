/**
 * nanobot config - 查看或设置配置项（TUI）
 */

import { Command } from 'commander';
import { runTui } from '../tui';

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Get or set config values')
    .argument('[key]', 'Config key (e.g. agents.defaults.model)')
    .argument('[value]', 'Value to set')
    .action(async (key?: string, value?: string) => {
      await runTui('config', { key, value });
    });
}
