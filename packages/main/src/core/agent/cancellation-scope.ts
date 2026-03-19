import { taskCancellation } from '../task-cancellation';

export interface CancellationTaskContext {
  channel: string;
  chatId: string;
  sessionKey: string;
  origin: 'user' | 'subagent' | 'system';
}

/**
 * 取消作用域
 *
 * 负责管理任务的取消和清理
 */
export class CancellationScope {
  /**
   * 创建任务
   *
   * @param channel - 渠道
   * @param chatId - 聊天 ID
   * @returns 任务 ID
   */
  createTask(channel: string, chatId: string): string {
    return `${channel}:${chatId}:${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /**
   * 注册任务
   *
   * @param taskId - 任务 ID
   * @param context - 任务上下文
   * @returns 取消信号
   */
  register(taskId: string, context: CancellationTaskContext): AbortSignal {
    return taskCancellation.register(taskId, {
      ...context,
      startedAt: new Date(),
    });
  }

  /**
   * 清理任务
   *
   * @param taskId - 任务 ID
   */
  cleanup(taskId: string): void {
    taskCancellation.cleanup(taskId);
  }
}
