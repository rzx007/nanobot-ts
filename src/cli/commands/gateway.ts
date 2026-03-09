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
    .option('--port <number>', 'Port for HTTP server', '18790')
    .option('--http', 'Enable HTTP server', 'true')
    .option('--static-dir <path>', 'Directory for static files (e.g., React build output)', 'frontend/dist')
    .action(async (opts: { port: string; http: boolean; staticDir?: string }) => {
      await runGateway(parseInt(opts.port, 10), opts.http, opts.staticDir);
    });
}

async function runGateway(port: number, http: boolean, staticDir?: string): Promise<void> {
  const config = await requireConfig();

  const runtime = await buildAgentRuntime(config);
  const { bus, agent, config: cfg } = runtime;
  const channelManager = new ChannelManager(cfg, bus);
  channelManager.registerChannel('cli', new CLIChannel({}, bus));
  await channelManager.loadChannelsFromConfig(bus);
  await channelManager.startAll();
  channelManager.runOutboundLoop();



  agent.run().catch(err => {
    logger.error({ err }, 'Agent loop error');
  });

  let httpServer: Awaited<ReturnType<typeof import('@/server').createServer>> | null = null;

  if (http) {
    const { createServer } = await import('@/server');
    config.server.port = port;
    config.server.enabled = true;

    const serverOptions: Parameters<typeof createServer>[0] = {
      runtime,
      bus,
      channelManager,
      config,
      startTime: new Date(),
    };

    if (staticDir) {
      serverOptions.staticDir = staticDir;
      info(`HTTP server enabled on port ${port} with static files from: ${staticDir}`);
    } else {
      info(`HTTP server enabled on port ${port}`);
    }

    httpServer = createServer(serverOptions);
  } else {
    info('HTTP server disabled');
  }
  const onExit = async (signal?: string): Promise<void> => {
    logger.info({ signal }, 'Process exit hook triggered');
    if (httpServer) {
      await httpServer.close();
    }
    await channelManager.stop();
    await runtime.subagentManager?.shutdown();
    logger.info('Gateway shutdown complete');
  };

  process.on('exit', (code: number) => {
    void onExit(`exit(${code})`);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received');
    await onExit('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received');
    await onExit('SIGTERM');
    process.exit(0);
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
        await onExit('/exit');
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
