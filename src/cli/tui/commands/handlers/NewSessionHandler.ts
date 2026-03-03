import type { SlashCommandHandler, SlashCommandContext } from '../types';
import { getSessionKey } from '@/bus/types';

/**
 * /new 命令处理器
 * 开启新会话：归档当前会话历史（如果有 memory）并清空
 */
export class NewSessionHandler implements SlashCommandHandler {
  id = 'new';
  label = '/new';
  description = 'New session';
  category = 'chat' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { runtime, clearMessages, addSystemMessage } = context;

    if (!runtime) {
      addSystemMessage('Runtime 未初始化，无法开启新会话。');
      return;
    }

    try {
      const sessionKey = getSessionKey({
        channel: 'cli',
        chatId: 'direct',
      });

      // 获取当前会话
      const session = await runtime.sessions.getOrCreate(sessionKey);

      // 如果有 memory 且有消息，先归档
      if (runtime.memory && session.messages.length > 0) {
        await runtime.memory.consolidate(session, true);
      }

      // 清空会话
      await runtime.sessions.clear(sessionKey);

      // 清空 UI 消息列表
      clearMessages();

      // 显示系统提示
      addSystemMessage('已开启新会话。');
    } catch (error) {
      console.error('Error creating new session:', error);
      addSystemMessage(`开启新会话失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
