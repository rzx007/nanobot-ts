/**
 * nanobot chat - 单次或交互式对话
 */

import { Command } from 'commander';
import { error, info } from '../ui';
import { requireConfig, buildAgentRuntime } from '../setup';
import { logger } from '../../../logger/src';

export function registerChatCommand(program: Command): void {
  program
    .command('chat [prompt]')
    .description('Send a prompt and get a response')
    .option('-i, --interactive', 'Interactive REPL')
    .action(async (prompt: string | undefined, opts: { interactive?: boolean }) => {
      await runChat(prompt, opts.interactive);
    });
}

async function runChat(promptArg: string | undefined, interactive?: boolean): Promise<void> {
  const config = await requireConfig();
  const runtime = await buildAgentRuntime(config);
  const { agent, bus } = runtime;

  if (interactive) {
    info('Interactive chat. Type /exit to quit.');
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    // 注册进程退出钩子
    const onExit = async (signal?: string): Promise<void> => {
      logger.info({ signal }, 'Process exit hook triggered');
      await runtime.subagentManager?.shutdown();
      logger.info('Chat shutdown complete');
    };

    process.on('exit', (code: number) => {
      void onExit(`exit(${code})`);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received');
      await onExit('SIGINT');
      rl.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received');
      await onExit('SIGTERM');
      rl.close();
      process.exit(0);
    });

    // 订阅流式文本和工具提示事件
    bus.on('stream-text', event => {
      if (event.channel === 'cli') {
        process.stdout.write(event.chunk);
      }
    });
    bus.on('tool-hint', event => {
      if (event.channel === 'cli') {
        process.stdout.write(`\n  [tools: ${event.content}]\n`);
      }
    });

    const ask = (): void => {
      rl.question('You> ', async line => {
        const content = line?.trim();
        if (!content) {
          ask();
          return;
        }
        if (content === '/exit' || content === '/quit') {
          await onExit('/exit');
          rl.close();
          process.exit(0);
        }

        const msg = {
          channel: 'cli' as const,
          senderId: 'user',
          chatId: 'direct',
          content,
          timestamp: new Date(),
        };

        // 流式输出
        process.stdout.write('\nBot> ');
        const out = await agent.process(msg);

        // 完成后换行（out未使用，仅用于触发agent.process）
        void out;
        process.stdout.write('\n');

        ask();
      });
    };
    ask();
    return;
  }

  if (!promptArg?.trim()) {
    error('Provide a prompt: nanobot chat "your question"');
    process.exit(1);
  }

  const msg = {
    channel: 'cli' as const,
    senderId: 'user',
    chatId: 'direct',
    content: promptArg.trim(),
    timestamp: new Date(),
  };

  // 订阅流式文本事件
  bus.on('stream-text', event => {
    if (event.channel === 'cli') {
      process.stdout.write(event.chunk);
    }
  });

  // 流式输出
  process.stdout.write('\nBot> ');
  const out = await agent.process(msg);

  // 完成后换行
  void out;
  process.stdout.write('\n');
}
