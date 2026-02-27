/**
 * nanobot status - 显示配置与状态
 */

import { Command } from 'commander';
import { expandHome } from '../../utils/helpers';
import { SessionManager } from '../../storage';
import { info } from '../ui';
import { DEFAULT_CONFIG_PATH } from '../constants';
import { requireConfig } from '../setup';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show config and status')
    .action(async () => {
      await runStatus();
    });
}

async function runStatus(): Promise<void> {
  const config = await requireConfig();
  const workspace = expandHome(config.agents.defaults.workspace);
  const sessions = new SessionManager(workspace);
  await sessions.init();

  const list = await sessions.listSessions();
  info(`Config: ${DEFAULT_CONFIG_PATH}`);
  info(`Workspace: ${workspace}`);
  info(`Sessions: ${list.length}`);
  if (list.length > 0) {
    list.slice(0, 5).forEach(s => console.log(`  - ${s.key} (${s.messageCount} messages)`));
  }
}
