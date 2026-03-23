/**
 * Agent 主循环
 *
 * AI 对话的核心处理引擎
 */

import type { Config, InboundMessage, OutboundMessage } from '@nanobot/shared';
import type { ToolRegistry } from '../tools/registry';
import type { LLMProvider } from '@nanobot/providers';
import type { SessionManager } from '../storage';
import { logger } from '@nanobot/logger';
import type { MessageBus } from '../bus';
import {
  CancellationScope,
  MessageRouter,
  OutputSanitizer,
  SessionOrchestrator,
  StreamBridge,
  ToolRuntime,
} from './agent/index';
import { ConcurrentSessionManager } from './concurrent-session-manager';

/**
 * 并发配置选项
 */
export interface ConcurrentOptions {
  /** 是否启用并发模式 */
  enabled: boolean;

  /** 最大并发数（默认 5） */
  maxConcurrency?: number;
}

/**
 * Agent 配置选项
 */
export interface AgentOptions {
  /** 消息总线 */
  bus: MessageBus;

  /** LLM 提供商 */
  provider: LLMProvider;

  /** 工具注册表 */
  tools: ToolRegistry;

  /** 会话管理器 */
  sessions: SessionManager;

  /** 配置对象 */
  config: Config;

  /** 内存整合器 (可选，超过阈值时整合长期记忆) */
  memory?: import('./memory').MemoryConsolidator;

  /** 技能加载器 (可选，用于系统提示词中的技能) */
  skills?: import('../skills/skills').SkillLoader;

  /** 并发配置选项 */
  concurrent?: ConcurrentOptions;
}

/**
 * Agent 主循环
 *
 * 负责处理消息、调用 LLM、执行工具的主逻辑
 */
export class AgentLoop {
  private static readonly TOOL_RESULT_MAX_CHARS = 12000;
  private static _stripThink(text: string | null | undefined): string {
    return OutputSanitizer.stripThink(text);
  }

  /** 配置 */
  private config: Config;

  /** 消息总线 */
  private bus: MessageBus;

  /** LLM 提供商 */
  private provider: LLMProvider;

  /** 工具注册表 */
  private tools: ToolRegistry;

  /** 会话管理器 */
  private sessions: SessionManager;

  /** 内存整合器 (可选) */
  private memory: import('./memory').MemoryConsolidator | null = null;

  /** 技能加载器 (可选) */
  private skills: import('../skills/skills').SkillLoader | null = null;

  /** 是否正在运行 */
  private running = false;

  /** 最大迭代次数 */
  private readonly maxIterations: number;

  /** 内存窗口 */
  private readonly memoryWindow: number;
  private readonly router: MessageRouter;
  private readonly sessionOrchestrator: SessionOrchestrator;
  private readonly toolRuntime: ToolRuntime;
  private readonly streamBridge: StreamBridge;
  private readonly cancellationScope: CancellationScope;
  private readonly concurrentSessionManager: ConcurrentSessionManager | null;

  /** 并发模式配置 */
  private readonly concurrentEnabled: boolean;
  private readonly maxConcurrency: number;

  /**
   * 构造函数
   *
   * @param options - Agent 配置选项
   */
  constructor(options: AgentOptions) {
    this.config = options.config;
    this.bus = options.bus;
    this.provider = options.provider;
    this.tools = options.tools;
    this.sessions = options.sessions;
    this.memory = options.memory ?? null;
    this.skills = options.skills ?? null;
    // 配置
    this.maxIterations = this.config.agents.defaults.maxIterations;
    this.memoryWindow = this.config.agents.defaults.memoryWindow;
    // 并发配置
    this.concurrentEnabled = options.concurrent?.enabled ?? false;
    this.maxConcurrency = options.concurrent?.maxConcurrency ?? 5;
    // 消息路由器
    this.router = new MessageRouter({
      sessions: this.sessions,
      memory: this.memory,
    });
    // 会话协调器
    this.sessionOrchestrator = new SessionOrchestrator({
      config: this.config,
      sessions: this.sessions,
      memoryWindow: this.memoryWindow,
      memory: this.memory,
      skills: this.skills,
    });
    // 工具运行时
    this.toolRuntime = new ToolRuntime({
      tools: this.tools,
      maxChars: AgentLoop.TOOL_RESULT_MAX_CHARS,
    });
    // 流式输出桥接器
    this.streamBridge = new StreamBridge({
      provider: this.provider,
      bus: this.bus,
    });
    // 取消管理器
    this.cancellationScope = new CancellationScope();

    // 并发会话管理器（仅在启用并发模式时创建）
    this.concurrentSessionManager = this.concurrentEnabled
      ? new ConcurrentSessionManager({
          sessionOrchestrator: this.sessionOrchestrator,
          streamBridge: this.streamBridge,
          toolRuntime: this.toolRuntime,
          config: this.config,
        })
      : null;

    if (this.concurrentEnabled) {
      logger.info(
        { maxConcurrency: this.maxConcurrency },
        'Agent initialized with concurrent mode',
      );
    }
  }

  /**
   * 启动主循环 (持续运行)
   */
  async run(): Promise<void> {
    if (this.running) {
      logger.warn('Agent already running');
      return;
    }

    this.running = true;
    logger.info(
      {
        mode: this.concurrentEnabled ? 'concurrent' : 'sequential',
        maxConcurrency: this.maxConcurrency,
      },
      'Agent main loop started',
    );

    void (async () => {
      try {
        if (this.concurrentEnabled) {
          // 并发模式：启动多个 worker 并发处理消息
          await this.runConcurrent();
        } else {
          // 串行模式：原有的处理逻辑
          await this.runSequential();
        }
      } catch (err) {
        logger.error({ err }, 'Agent main loop error');
      } finally {
        this.running = false;
        logger.info('Agent main loop stopped');
      }
    })();
  }

  /**
   * 串行模式运行（原有逻辑）
   */
  private async runSequential(): Promise<void> {
    while (this.running) {
      try {
        const msg = await this.bus.consumeInbound();

        logger.info({ channel: msg.channel, chatId: msg.chatId }, '🐞 Processing inbound message');

        const response = await this._processMessage(msg);

        if (response) await this.bus.publishOutbound(response);
      } catch (rawErr) {
        logger.error({ rawErr }, 'Agent main loop error');
      }
    }
  }

  /**
   * 并发模式运行
   */
  private async runConcurrent(): Promise<void> {
    if (!this.concurrentSessionManager) {
      throw new Error('ConcurrentSessionManager not initialized');
    }

    // 创建 worker 池
    const workers = Array.from({ length: this.maxConcurrency }, (_, index) => ({
      id: index,
      worker: this.processSingleMessage.bind(this),
    }));

    logger.info(
      {
        workerCount: workers.length,
      },
      'Started concurrent worker pool',
    );

    // 并发处理消息
    const workerPromises = workers.map(async ({ id, worker }) => {
      while (this.running) {
        try {
          await worker();
        } catch (error) {
          logger.error({ workerId: id, error }, 'Worker error');
          // Worker 出错后继续运行
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    });

    await Promise.all(workerPromises);
  }

  /**
   * 处理单条消息（并发模式）
   */
  private async processSingleMessage(): Promise<void> {
    if (!this.concurrentSessionManager) {
      throw new Error('ConcurrentSessionManager not initialized');
    }

    const msg = await this.bus.consumeInbound();
    if (!msg) return;

    const { channel, chatId, content, senderId } = msg;
    const sessionKey = this.sessionOrchestrator.getSessionKey(msg);

    logger.info(
      { channel, chatId, sessionKey },
      'Processing message in concurrent mode',
    );

    // 处理 subagent 结果消息（不通过并发管理器）
    if (senderId === 'subagent') {
      const response = await this.router.handleSubagentResult(msg);
      if (response) await this.bus.publishOutbound(response);
      return;
    }

    // 处理会话命令
    const trimmed = content.trim();
    const commandResult = await this.router.handleCommand(trimmed, sessionKey, channel, chatId);
    if (commandResult) {
      await this.bus.publishOutbound(commandResult);
      return;
    }

    // 通过并发管理器处理消息
    try {
      const response = await this.concurrentSessionManager.process(sessionKey, msg);
      if (response) await this.bus.publishOutbound(response);
    } catch (error) {
      logger.error({ sessionKey, error }, 'Failed to process message in concurrent mode');
      // 发送错误消息
      await this.bus.publishOutbound({
        channel,
        chatId,
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * 停止主循环
   */
  stop(): void {
    this.running = false;

    // 清理并发会话管理器
    if (this.concurrentSessionManager) {
      this.concurrentSessionManager.clearAll();
    }

    logger.info('Agent stopping...');
  }

  /**
   * 处理单条消息 (用于 CLI 模式)
   * 默认使用流式输出，通过消息总线发布事件
   *
   * @param msg - 入站消息
   @returns 出站消息或 null
   */
  async process(msg: InboundMessage): Promise<OutboundMessage | null> {
    logger.info(`Processing message: ${msg.channel}:${msg.chatId}`);

    const wasRunning = this.running;
    this.running = true;
    try {
      const response = await this._processMessage(msg);
      return response;
    } catch (err) {
      logger.error({ err }, 'Failed to process message');
      return null;
    } finally {
      this.running = wasRunning;
    }
  }

  /**
   * 处理消息的核心逻辑
   * 默认使用流式输出，通过消息总线发布事件
   *
   * @param msg - 入站消息
   * @returns 出站消息
   */
  private async _processMessage(msg: InboundMessage): Promise<OutboundMessage> {
    const { channel, chatId, content, senderId } = msg;
    const sessionKey = this.sessionOrchestrator.getSessionKey(msg);

    // 处理 subagent 结果消息
    if (senderId === 'subagent') {
      return await this.router.handleSubagentResult(msg);
    }

    // 会话命令: /new 归档后清空, /help 显示帮助
    const trimmed = content.trim();
    const commandResult = await this.router.handleCommand(trimmed, sessionKey, channel, chatId);
    if (commandResult) {
      return commandResult;
    }

    // 为当前 inbound 消息分配一个任务 ID，并注册取消信号
    const taskId = this.cancellationScope.createTask(channel, chatId);

    try {
      this.toolRuntime.applyChatContext(channel, chatId);

      // 添加用户消息到会话
      await this.sessionOrchestrator.appendUserMessage(sessionKey, {
        role: senderId === 'cron' ? 'system' : 'user',
        content,
        timestamp: new Date().toISOString(),
      });
      const messages = await this.sessionOrchestrator.buildPromptMessages(
        channel,
        chatId,
        content,
        sessionKey,
      );

      // 获取工具定义，由 SDK 自动执行工具（executeTool + maxSteps）
      const tools = this.toolRuntime.getDefinitions();

      // 注册取消信号
      const signal = this.cancellationScope.register(taskId, {
        channel,
        chatId,
        sessionKey,
        origin: 'user',
      });

      // 流式输出助手消息
      const { assistantContent: rawAssistantContent, finalUIMessage } = await this.streamBridge.streamAndEmit({
        channel,
        chatId,
        messages,
        tools,
        model: this.config.agents.defaults.model,
        temperature: this.config.agents.defaults.temperature,
        maxTokens: this.config.agents.defaults.maxTokens,
        abortSignal: signal,
        maxSteps: this.maxIterations,
        executeTool: (name: string, args: Record<string, unknown>) =>
          this.toolRuntime.executeTool(name, args, { channel, chatId }),
        senderId,
      });

      const finalAssistantContent = AgentLoop._stripThink(rawAssistantContent);
      // 保存助手消息到会话（包含完整的 UIMessage parts）
      await this.sessionOrchestrator.appendAssistantMessage(
        sessionKey,
        {
          role: 'assistant',
          content: finalAssistantContent,
          timestamp: new Date().toISOString(),
          id: finalUIMessage?.id,
          parts: finalUIMessage?.parts,
          model: this.config.agents.defaults.model,
          metadata: {messageFrom: senderId}
        }
      );
      // 可能整合长期记忆
      await this.sessionOrchestrator.maybeConsolidate(sessionKey);

      return {
        channel,
        chatId,
        content: finalAssistantContent,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error({ error: err }, 'Failed to process message');
      return {
        channel,
        chatId,
        content: `Error: ${err.message}`,
      };
    } finally {
      // 清理任务资源，防止内存泄漏
      this.cancellationScope.cleanup(taskId);
    }
  }
}
