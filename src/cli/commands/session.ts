/**
 * nanobot session - 列出会话
 */

import { Command } from 'commander';
import { expandHome } from '../../utils/helpers';
import { SessionManager } from '../../storage';
import { info } from '../ui';
import { requireConfig } from '../setup';

export function registerSessionCommand(program: Command): void {
  program
    .command('session')
    .description('List sessions')
    .action(async () => {
      await runSession();
    });
}

async function runSession(): Promise<void> {
  const config = await requireConfig();
  const workspace = expandHome(config.agents.defaults.workspace);
  const sessions = new SessionManager(workspace);
  await sessions.init();

  const list = await sessions.listSessions();
  if (list.length === 0) {
    info('No sessions.');
    return;
  }
  list.forEach(s => console.log(`  ${s.key}  ${s.messageCount} msgs  ${s.updatedAt}`));
}
