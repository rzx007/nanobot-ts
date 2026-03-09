/**
 * nanobot config - 查看或设置配置项
 */

import { Command } from 'commander';
import { info } from '../ui';
import { requireConfig } from '../setup';

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Get or set config values')
    .argument('[key]', 'Config key (e.g. agents.defaults.model)')
    .argument('[value]', 'Value to set')
    .action(async (key?: string, value?: string) => {
      await runConfig(key, value);
    });
}

async function runConfig(key?: string, value?: string): Promise<void> {
  const config = await requireConfig();

  if (!key) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }
  if (value === undefined) {
    const parts = key.split('.');
    let cur: unknown = config;
    for (const p of parts) {
      cur = (cur as Record<string, unknown>)?.[p];
    }
    console.log(cur);
    return;
  }
  info('Config set not fully implemented. Edit ~/.nanobot/config.json directly.');
}
