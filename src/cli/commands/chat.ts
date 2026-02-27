/**
 * nanobot chat - 单次或交互式对话
 */

import { Command } from 'commander';
import { error, info } from '../ui';
import { requireConfig, buildAgentRuntime } from '../setup';

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
  const { agent } = runtime;

  if (interactive) {
    info('Interactive chat. Type /exit to quit.');
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (): void => {
      rl.question('You> ', async line => {
        const content = line?.trim();
        if (!content) {
          ask();
          return;
        }
        if (content === '/exit' || content === '/quit') {
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
        const out = await agent.process(msg, async (text, opts) => {
          if (opts?.toolHint) process.stdout.write(`  [tools: ${text}]\n`);
        });
        if (out) console.log('Bot>', out.content);
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
  const out = await agent.process(msg);
  if (out) console.log(out.content);
}
