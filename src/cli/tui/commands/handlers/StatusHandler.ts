import type { SlashCommandHandler, SlashCommandContext } from '../types';

/**
 * /status 命令处理器
 * 跳转到状态页面，查看 agent 和 gateway 状态
 */
export class StatusHandler implements SlashCommandHandler {
  id = 'status';
  label = '/status';
  description = 'View status';
  category = 'navigation' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { navigateTo } = context;
    navigateTo('status');
  }
}
