/**
 * Subagent Manager
 *
 * 管理子代理任务队列和执行，支持 embedded 和 isolated 两种模式
 */

import { Queue, Worker } from 'bunqueue/client';
import type { SubagentTask, SubagentResult, SubagentManagerConfig, SubagentMode } from './types';
import { SubagentWorker } from './worker';
import { logger } from '../../utils/logger';
import { existsSync, mkdirSync } from 'fs';

function generateTaskId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export class SubagentManager {
  private config: SubagentManagerConfig;
  private mode: SubagentMode;
  private taskQueue: Queue<SubagentTask> | null = null;
  private taskWorker: Worker<SubagentTask, SubagentResult> | null = null;
  private resultWorker: Worker<SubagentResult, void> | null = null;
  private runningTasks: Map<string, Promise<void>> = new Map();
  private workerProcesses: Array<{ pid: number; onExit: () => void }> = [];

  constructor(managerConfig: SubagentManagerConfig) {
    this.config = managerConfig;
    this.mode = managerConfig.config.subagent.mode;
  }

  /**
   * 初始化子代理管理器
   * 根据配置决定是否启用子代理，并根据运行模式进行相应的初始化操作
   * @returns Promise<void> 无返回值的Promise
   */
  async initialize(): Promise<void> {
    if (!this.config.config.subagent.enabled) {
      logger.info('Subagent is disabled, skipping initialization');
      return;
    }

    logger.info({ mode: this.mode }, 'Initializing subagent manager');

    const dataPath = this.config.config.subagent.dataPath;

    // 提取数据目录路径并创建目录
    const dataDir = dataPath.substring(0, dataPath.lastIndexOf('/'));
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
      logger.info(`Created data directory: ${dataDir}`);
    }

    this.taskQueue = new Queue<SubagentTask>('subagent-tasks', {
      embedded: true,
    });

    process.env.DATA_PATH = dataPath;

    // 根据不同模式进行初始化
    if (this.mode === 'embedded') {
      await this.initializeEmbeddedMode();
    } else {
      await this.initializeIsolatedMode();
      // 只有 isolated 模式才需要结果队列监听器
      await this.initializeResultListener();
    }

    logger.info('Subagent manager initialized successfully');
  }

  /**
   * 初始化嵌入模式下的子代理
   * 设置并启动子代理工作器，配置任务处理队列以在嵌入模式下运行子代理任务
   * @returns Promise<void> 无返回值的Promise
   */
  private async initializeEmbeddedMode(): Promise<void> {
    logger.info('Initializing subagent in embedded mode');

    // 创建子代理工作器实例，用于执行具体的子代理任务
    const subagentWorker = new SubagentWorker({
      config: this.config.config,
      provider: this.config.provider,
      tools: this.config.tools,
      workspace: this.config.workspace,
      maxIterations: this.config.config.subagent.maxIterations,
      timeout: this.config.config.subagent.timeout,
    });

    // 创建任务工作器，用于处理子代理任务队列
    this.taskWorker = new Worker<SubagentTask, SubagentResult>(
      'subagent-tasks',
      async job => {
        logger.info({ jobId: job.id, taskId: job.data.taskId }, '🤖 Processing subagent job');
        const result = await subagentWorker.execute(job.data);
        return result;
      },
      {
        embedded: true,
        concurrency: this.config.config.subagent.concurrency,
      },
    );

    // 监听任务完成事件，直接处理结果（无需额外的结果队列）
    this.taskWorker.on('completed', async (job, result) => {
      logger.info({ jobId: job.id, status: result.status }, '🤖 Job completed');
      await this.handleResult(result);
    });

    // 监听任务失败事件
    this.taskWorker.on('failed', async (_job, error) => {
      const errorResult: SubagentResult = {
        taskId: (_job.data as SubagentTask).taskId,
        result: '',
        status: 'failed',
        error: error.message,
        completedAt: new Date(),
      };
      await this.handleResult(errorResult);
    });

    logger.info('Embedded mode worker started');
  }

  /**
   * 初始化隔离模式下的子代理
   * 该方法负责启动指定数量的工作进程来处理隔离模式下的任务
   * @returns Promise<void> 无返回值的Promise
   */
  private async initializeIsolatedMode(): Promise<void> {
    logger.info('Initializing subagent in isolated mode');

    const workerCount = this.config.config.subagent.concurrency;
    logger.info({ workerCount }, 'Starting worker processes');

    // 启动指定数量的工作进程
    for (let i = 0; i < workerCount; i++) {
      await this.startWorkerProcess(i);
    }

    logger.info(`Isolated mode: started ${workerCount} worker processes`);
  }

  /**
   * 启动工作进程
   * 该方法会创建一个子进程来运行worker，并在子进程退出时自动重启
   *
   * @param workerId - 工作进程的唯一标识符
   * @returns Promise<void> - 异步操作完成的Promise
   */
  private async startWorkerProcess(workerId: number): Promise<void> {
    try {
      const { fork } = await import('child_process');
      const { fileURLToPath } = await import('url');
      const workerPath = fileURLToPath(
        new URL('../../cli/commands/subagent/start-worker.ts', import.meta.url),
      );

      // 创建子进程并传递workerId参数
      const child = fork(workerPath, [String(workerId)], {
        stdio: ['ignore', 'inherit', 'inherit'],
        env: {
          ...process.env,
          DATA_PATH: this.config.config.subagent.dataPath,
          SUBAGENT_MODE: 'isolated',
          NANOBOT_CONFIG_PATH: '~/.nanobot/config.json',
        },
      });

      const pid = child.pid;
      if (pid === undefined) {
        throw new Error('Failed to get worker process ID');
      }

      logger.info({ workerId, pid }, 'Worker process started');

      // 定义子进程退出时的处理逻辑
      const onExit = () => {
        logger.warn({ workerId, pid }, 'Worker process exited');
        setTimeout(() => {
          logger.info({ workerId }, 'Restarting worker process');
          void this.startWorkerProcess(workerId);
        }, 5000);
      };

      this.workerProcesses.push({ pid, onExit });

      child.on('exit', onExit);
    } catch (error) {
      logger.error({ workerId, error }, 'Failed to start worker process');
    }
  }

  private async initializeResultListener(): Promise<void> {
    this.resultWorker = new Worker<SubagentResult, void>(
      'subagent-results',
      async job => {
        await this.handleResult(job.data);
      },
      { embedded: true },
    );

    logger.info('Result listener initialized');
  }

  /**
   * 异步创建并启动一个子代理任务
   * @param task - 要执行的任务描述字符串
   * @param options - 可选的任务配置参数
   *   @param options.label - 任务标签，用于标识任务（可选）
   *   @param options.originChannel - 任务来源渠道，默认为'cli'（可选）
   *   @param options.originChatId - 任务来源聊天ID，默认为'direct'（可选）
   *   @param options.sessionKey - 会话密钥，默认为'cli:direct'（可选）
   * @returns 返回表示任务启动状态的消息字符串
   */
  async spawn(
    task: string,
    options?: {
      label?: string;
      originChannel?: string;
      originChatId?: string;
      sessionKey?: string;
    },
  ): Promise<string> {
    // 检查子代理是否已启用
    if (!this.config.config.subagent.enabled) {
      return 'Subagent is disabled. Please enable it in the configuration.';
    }

    // 生成任务ID并设置标签
    const taskId = generateTaskId();
    const label = options?.label ?? task.substring(0, 30) + (task.length > 30 ? '...' : '');

    // 创建任务数据对象
    const taskData: SubagentTask = {
      taskId,
      task,
      label,
      originChannel: options?.originChannel ?? 'cli',
      originChatId: options?.originChatId ?? 'direct',
      sessionKey: options?.sessionKey ?? 'cli:direct',
      status: 'pending',
      createdAt: new Date(),
    };

    // 将任务添加到队列中
    await this.taskQueue!.add(taskId, taskData);

    // 记录运行中的任务
    this.runningTasks.set(taskId, Promise.resolve());

    logger.info({ taskId, label, task }, 'Subagent task spawned');

    return `Subagent task "${label}" started (id: ${taskId}). I'll notify you when it completes.`;
  }

  /**
   * 取消指定ID的任务
   * @param taskId - 要取消的任务ID
   * @returns Promise<string> - 返回操作结果的描述信息
   */
  async cancel(taskId: string): Promise<string> {
    // 检查任务是否在运行中
    const taskPromise = this.runningTasks.get(taskId);

    if (!taskPromise) {
      return `No running task found with ID: ${taskId}`;
    }

    // 从运行任务列表中删除该任务
    this.runningTasks.delete(taskId);

    // 尝试从任务队列中找到并取消对应任务
    if (this.taskQueue) {
      try {
        const jobs = await this.taskQueue!.getJobs();
        const job = jobs.find((j: any) => j.data?.taskId === taskId);

        if (job) {
          await job.discard();
          logger.info({ taskId }, 'Subagent task cancelled');
          return `Subagent task ${taskId} cancelled successfully.`;
        }
      } catch (error) {
        logger.error({ taskId, error }, 'Failed to cancel task');
        return `Failed to cancel task: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    return `Task not found in queue`;
  }

  /**
   * 处理子代理执行结果
   * 从运行任务中删除已完成的任务，查找对应的任务队列作业，
   * 根据执行结果生成摘要内容并发布到系统频道
   * @param result - 子代理执行结果对象，包含任务ID、状态和结果内容
   * @returns Promise<void>
   */
  private async handleResult(result: SubagentResult): Promise<void> {
    this.runningTasks.delete(result.taskId);

    const jobs = await this.taskQueue!.getJobs();
    const job = jobs.find((j: any) => j.data?.taskId === result.taskId);

    if (!job) {
      logger.warn({ taskId: result.taskId }, 'Task not found for result');
      return;
    }

    const task = (job as any).data;
    const label = task.label ?? result.taskId;
    const statusText = result.status === 'completed' ? 'completed successfully' : 'failed';

    const content = `[Subagent '${label}' ${statusText}]

Task: ${task.task}

Result:
${result.result}

Summarize this naturally for the user. Keep it brief (1-2 sentences). Do not mention technical details like "subagent" or task IDs.`;

    await this.config.bus.publishInbound({
      channel: task.originChannel, // 返回到原始 channel
      senderId: 'subagent',
      chatId: task.originChatId,
      content,
      timestamp: new Date(),
    });

    logger.info({ taskId: result.taskId, status: result.status }, '🤖 Result handled');
  }

  async getRunningCount(): Promise<number> {
    return this.runningTasks.size;
  }

  getMode(): SubagentMode {
    return this.mode;
  }

  /**
   * 关闭子代理管理器，清理所有相关的工作者进程和任务
   * @returns Promise<void> 返回一个Promise，当关闭操作完成时解析
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down subagent manager');

    // 关闭任务工作者
    if (this.taskWorker) {
      await this.taskWorker.close();
      logger.info('Task worker closed');
    }

    // 关闭结果工作者
    if (this.resultWorker) {
      await this.resultWorker.close();
      logger.info('Result worker closed');
    }

    // 终止所有工作进程
    if (this.workerProcesses.length > 0) {
      for (const wp of this.workerProcesses) {
        if (wp.pid) {
          try {
            process.kill(wp.pid, 'SIGTERM');
            logger.info({ pid: wp.pid }, 'Worker process terminated');
          } catch (error) {
            logger.error({ pid: wp.pid, error }, 'Failed to terminate worker');
          }
        }
      }
      this.workerProcesses = [];
    }

    this.runningTasks.clear();

    logger.info('Subagent manager shut down');
  }
}
