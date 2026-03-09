import type { SlashCommandHandler, SlashCommandContext } from '../types';

/**
 * /review 命令处理器（未实现）
 */
export class ReviewHandler implements SlashCommandHandler {
  id = 'review';
  label = '/review';
  description = 'review changes [commit|branch|pr]';
  category = 'chat' as const;

  async execute(_context: SlashCommandContext): Promise<void> {
    // 未实现，什么都不做
  }
}
