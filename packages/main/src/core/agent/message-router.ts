import type { InboundMessage, OutboundMessage } from '@nanobot/shared';
import type { SessionManager } from '../../storage';

export interface MemoryConsolidatorLike {
  consolidate(session: unknown, force?: boolean): Promise<void>;
}

export interface MessageRouterDeps {
  sessions: SessionManager;
  memory: MemoryConsolidatorLike | null;
}

export class MessageRouter {
  constructor(private readonly deps: MessageRouterDeps) {}

  async handleSubagentResult(msg: InboundMessage): Promise<OutboundMessage> {
    const { channel, chatId, content } = msg;
    const summary = await this.summarizeSubagentResult(content);
    return { channel, chatId, content: summary };
  }

  async handleCommand(
    command: string,
    sessionKey: string,
    channel: string,
    chatId: string,
  ): Promise<OutboundMessage | null> {
    if (command === '/new') {
      if (this.deps.memory) {
        const session = await this.deps.sessions.getOrCreate(sessionKey);
        if (session.messages.length > 0) {
          await this.deps.memory.consolidate(session, true);
        }
      }
      await this.deps.sessions.clear(sessionKey);
      return { channel, chatId, content: '已开启新会话。' };
    }

    if (command === '/help') {
      const help = `**Nanobot-ts 命令**
- \`/new\` - 开启新会话，归档后清空当前对话历史
- \`/help\` - 显示此帮助`;
      return { channel, chatId, content: help };
    }

    return null;
  }

  async summarizeSubagentResult(content: string): Promise<string> {
    const statusMatch = content.match(/\[Subagent '([^\]]+)' (completed successfully|failed)/);
    const taskLabel = statusMatch?.[1] ?? '任务';
    const status = statusMatch?.[2] ?? 'completed';

    const resultMatch = content.match(/Result:\n([\s\S]*?)\n/);
    const result = resultMatch?.[1] ?? '';

    if (status === 'completed successfully') {
      return result ? `${taskLabel} 已完成。 ${result}` : `${taskLabel} 已完成。`;
    }
    return result ? `${taskLabel} 失败。 ${result}` : `${taskLabel} 失败。`;
  }
}
