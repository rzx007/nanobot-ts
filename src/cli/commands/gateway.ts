/**
 * nanobot gateway - 启动消息总线与 Agent，CLI 交互
 */

import { Command } from 'commander';
import { ChannelManager, CLIChannel } from '@/channels';
import { logger } from '@/utils/logger';
import { info } from '../ui';
import { requireConfig, buildAgentRuntime } from '../setup';

export function registerGatewayCommand(program: Command): void {
  program
    .command('gateway')
    .description('Start message bus and agent (no channels yet)')
    .option('--port <number>', 'Port for future HTTP server', '18790')
    .action(async (_opts: { port: string }) => {
      await runGateway();
    });
}

async function runGateway(): Promise<void> {
  const config = await requireConfig();
  const runtime = await buildAgentRuntime(config);

  const { bus, agent, config: cfg } = runtime;
  const channelManager = new ChannelManager(cfg, bus);
  channelManager.registerChannel('cli', new CLIChannel({}, bus));
  await channelManager.loadChannelsFromConfig(bus);
  await channelManager.startAll();
  // 启动出站循环
  channelManager.runOutboundLoop();

  agent.run().catch(err => {
    logger.error({ err }, 'Agent loop error');
  });

  info('Gateway started (agent running). Type a message and press Enter. Ctrl+C to exit.');

  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = (): void => {
    rl.question('\nYou> ', async line => {
      const content = line?.trim() ?? '';
      if (!content) {
        logger.info('Gateway: skipped empty input (type a message then Enter)');
        prompt();
        return;
      }
      if (content === '/exit' || content === '/quit') {
        channelManager.stop();
        rl.close();
        process.exit(0);
      }
      await bus.publishInbound({
        channel: 'cli',
        senderId: 'user',
        chatId: 'direct',
        content,
        timestamp: new Date(),
      });
      prompt();
    });
  };
  prompt();
}
