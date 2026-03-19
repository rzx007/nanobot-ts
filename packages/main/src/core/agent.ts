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
    logger.info('Agent main loop started');

    void (async () => {
      try {
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
      } catch (err) {
        logger.error({ err }, 'Agent main loop error');
      } finally {
        this.running = false;
        logger.info('Agent main loop stopped');
      }
    })();
  }

  /**
   * 停止主循环
   */
  stop(): void {
    this.running = false;
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
    const { channel, chatId, content } = msg;
    const sessionKey = this.sessionOrchestrator.getSessionKey(msg);

    // 处理 subagent 结果消息
    if (msg.senderId === 'subagent') {
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
      await this.sessionOrchestrator.appendUserMessage(sessionKey, content);
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
      const { assistantContent: rawAssistantContent } = await this.streamBridge.streamAndEmit({
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
      });

      const finalAssistantContent = AgentLoop._stripThink(rawAssistantContent);
      // 保存助手消息到会话
      await this.sessionOrchestrator.appendAssistantMessage(sessionKey, finalAssistantContent);
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
