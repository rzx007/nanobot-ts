import type { SlashCommandHandler, SlashCommandContext } from '../types';

/**
 * /mcps 命令处理器（未实现）
 */
export class McpsHandler implements SlashCommandHandler {
  id = 'mcps';
  label = '/mcps';
  description = 'Toggle MCPs';
  category = 'system' as const;

  async execute(_context: SlashCommandContext): Promise<void> {
    // 未实现，什么都不做
  }
}
