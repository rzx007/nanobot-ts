/**
 * 会话与 Gateway 消息列表的转换
 */

import type { MessageItem } from '../components/MessageList';
import type { Session } from '@nanobot/shared';

/**
 * 将 Session 中的消息转为 Chat 使用的 MessageItem[]
 * 仅保留 user / assistant 角色
 */
export function sessionToMessageItems(session: Session): MessageItem[] {
  return session.messages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      model: msg.model ?? '',
      timestamp: msg.timestamp ?? '',
    }));
}
