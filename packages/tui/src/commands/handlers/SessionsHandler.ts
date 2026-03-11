import type { SlashCommandHandler, SlashCommandContext } from '../types';

/**
 * /sessions 命令处理器
 * 跳转到状态页面查看会话列表
 */
export class SessionsHandler implements SlashCommandHandler {
  id = 'sessions';
  label = '/sessions';
  description = 'Switch session';
  category = 'navigation' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { navigateTo } = context;
    navigateTo('status');
  }
}
