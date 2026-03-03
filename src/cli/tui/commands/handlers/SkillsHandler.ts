import type { SlashCommandHandler, SlashCommandContext } from '../types';

/**
 * /skills 命令处理器（未实现）
 */
export class SkillsHandler implements SlashCommandHandler {
  id = 'skills';
  label = '/skills';
  description = 'Skills';
  category = 'system' as const;

  async execute(_context: SlashCommandContext): Promise<void> {
    // 未实现，什么都不做
  }
}
