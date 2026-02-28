/**
 * nanobot chat - 单次或交互式对话（TUI）
 */

import { Command } from 'commander';
import { runTui } from '../tui';

export function registerChatCommand(program: Command): void {
  program
    .command('chat [prompt]')
    .description('Send a prompt and get a response')
    .option('-i, --interactive', 'Interactive REPL')
    .action(async (prompt: string | undefined, opts: { interactive?: boolean }) => {
      await runTui('chat', {
        prompt: prompt?.trim(),
        interactive: opts.interactive ?? false,
      });
    });
}
