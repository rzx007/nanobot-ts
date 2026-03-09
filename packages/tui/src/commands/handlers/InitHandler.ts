import type { SlashCommandHandler, SlashCommandContext } from '../types';

/**
 * /init 命令处理器（未实现）
 */
export class InitHandler implements SlashCommandHandler {
  id = 'init';
  label = '/init';
  description = 'create/update AGENTS.md';
  category = 'system' as const;

  async execute(_context: SlashCommandContext): Promise<void> {
    // 未实现，什么都不做
  }
}
