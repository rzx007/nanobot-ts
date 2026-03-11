/**
 * Task Cancellation Manager
 *
 * 基于 AbortController 的任务取消管理，支持多任务并发场景。
 * 设计目标：在同一进程内管理多个并发会话的取消信号，便于实现 "一起取消" 的需求。
 */
export interface TaskContext {
  channel: string;
  chatId: string;
  sessionKey: string;
  startedAt?: Date;
  origin: 'user' | 'subagent' | 'system';
}

export class TaskCancellationManager {
  private controllers: Map<string, AbortController> = new Map();
  private contexts: Map<string, TaskContext> = new Map();
  private maxConcurrent: number;
  private active: Set<string> = new Set();

  constructor(maxConcurrent: number = 10) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * 注册一个新任务，返回一个 AbortSignal
   */
  register(taskId: string, context: TaskContext): AbortSignal {
    const ac = new AbortController();
    this.controllers.set(taskId, ac);
    this.contexts.set(taskId, { ...context, startedAt: context.startedAt ?? new Date() });
    if (this.active.size < this.maxConcurrent) {
      this.active.add(taskId);
    } else {
      // 超出并发上限，仍然注册但不阻塞，信号仍然可用于已注册的请求
      // 日志仅在需要时记录
      // console.debug(`[TaskCancellation] max concurrency reached (${this.maxConcurrent}) for ${taskId}`);
    }
    return ac.signal;
  }

  /** 取消指定任务 */
  cancel(taskId: string): boolean {
    const ac = this.controllers.get(taskId);
    if (!ac) return false;
    ac.abort();
    this.controllers.delete(taskId);
    this.contexts.delete(taskId);
    this.active.delete(taskId);
    return true;
  }

  /** 取消同一个 sessionKey 的所有任务 */
  cancelSession(channel: string, chatId: string): number {
    const toCancel: string[] = [];
    for (const [taskId, ctx] of this.contexts) {
      if (ctx.channel === channel && ctx.chatId === chatId) toCancel.push(taskId);
    }
    for (const id of toCancel) {
      this.cancel(id);
    }
    return toCancel.length;
  }

  /** 取消当前会话下的“最近一个”活跃任务 */
  cancelCurrentTask(sessionKey: string, origin?: 'user'| 'subagent' | 'system'): boolean {
    let latestId: string | null = null;
    let latestTime: Date | undefined;
    for (const [id, ctx] of this.contexts) {
      if (ctx.sessionKey === sessionKey && (origin ? ctx.origin === origin : true)) {
        const t = ctx.startedAt ?? new Date();
        if (!latestTime || t > latestTime) {
          latestTime = t;
          latestId = id;
        }
      }
    }
    if (latestId) {
      this.cancel(latestId);
      return true;
    }
    return false;
  }

  /** 清理指定任务的上下文记录（已取消、已完成时调用） */
  cleanup(taskId: string): void {
    this.controllers.delete(taskId);
    this.contexts.delete(taskId);
    this.active.delete(taskId);
  }

  /** 获取所有活跃任务信息，便于 UI 展示 */
  getActiveTasks(): Array<{ taskId: string; channel: string; chatId: string; sessionKey: string; startedAt?: Date }> {
    const list: any[] = [];
    for (const [tid, ctx] of this.contexts) {
      list.push({ taskId: tid, channel: ctx.channel, chatId: ctx.chatId, sessionKey: ctx.sessionKey, startedAt: ctx.startedAt });
    }
    return list;
  }
}

// 导出单例，供应用各处引用
export const taskCancellation = new TaskCancellationManager(10);
