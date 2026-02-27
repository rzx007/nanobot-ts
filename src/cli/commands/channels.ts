/**
 * nanobot channels - 渠道管理
 */

import { Command } from 'commander';
import { MessageBus } from '../../bus/queue';
import { ChannelManager } from '../../channels';
import { error, info } from '../ui';
import { requireConfig } from '../setup';

export function registerChannelsCommand(program: Command): void {
  program
    .command('channels')
    .description('Manage channels')
    .argument('[action]', 'Action: status')
    .action(async (action?: string) => {
      await runChannels(action);
    });
}

async function runChannels(action?: string): Promise<void> {
  if (action !== 'status') {
    error('Unknown action. Use "nanobot channels status".');
    process.exit(1);
  }

  const config = await requireConfig();
  const bus = new MessageBus();
  const channelManager = new ChannelManager(config, bus);
  const statuses = channelManager.getStatus();

  info('Channel Status:');
  console.log('');
  statuses.forEach(status => {
    const registered = status.registered ? '✓' : '✗';
    const enabled = status.enabled ? 'enabled' : 'disabled';
    const running = status.registered ? 'running' : 'not running';
    console.log(`  ${status.name.padEnd(10)}  [${registered}]  ${enabled.padEnd(10)}  ${running}`);
  });
  console.log('');
  console.log('  Legend: [✓] Registered, [✗] Not registered');
}
