/**
 * 会话处理器
 *
 * 每个会话对应一个 SessionProcessor 实例
 * 负责处理单个会话的所有消息，包括 LLM 调用、工具执行等
 */

import type { Config, InboundMessage, OutboundMessage, SessionMessage } from '@nanobot/shared';
import { logger } from '@nanobot/logger';
import type { SessionOrchestrator } from './agent/session-orchestrator';
import type { StreamBridge } from './agent/stream-bridge';
import type { ToolRuntime } from './agent/tool-runtime';
import { getSessionStatusManager } from './session-status';

/**
 * 会话处理器配置
 */
export interface SessionProcessorOptions {
  /** 会话键 */
  sessionKey: string;

  /** 渠道 */
  channel: string;

  /** 会话 ID */
  chatId: string;

  /** 会话协调器 */
  sessionOrchestrator: SessionOrchestrator;

  /** 流式桥接器 */
  streamBridge: StreamBridge;

  /** 工具运行时 */
  toolRuntime: ToolRuntime;

  /** 配置 */
  config: Config;
}

/**
 * 会话处理器
 *
 * 负责处理单个会话的消息
 */
export class SessionProcessor {
  private readonly sessionKey: string;
  private readonly channel: string;
  private readonly chatId: string;
  private readonly sessionOrchestrator: SessionOrchestrator;
  private readonly streamBridge: StreamBridge;
  private readonly toolRuntime: ToolRuntime;
  private readonly config: Config;

  /** 取消控制器 */
  private readonly abortController: AbortController;

  /**
   * 构造函数
   *
   * @param options - 配置选项
   */
  constructor(options: SessionProcessorOptions) {
    this.sessionKey = options.sessionKey;
    this.channel = options.channel;
    this.chatId = options.chatId;
    this.sessionOrchestrator = options.sessionOrchestrator;
    this.streamBridge = options.streamBridge;
    this.toolRuntime = options.toolRuntime;
    this.config = options.config;
    this.abortController = new AbortController();

    logger.debug(
      { sessionKey: this.sessionKey, channel: this.channel, chatId: this.chatId },
      'SessionProcessor created',
    );
  }

  /**
   * 获取取消信号
   *
   * @returns AbortSignal
   */
  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * 处理单个消息
   *
   * @param message - 入站消息
   * @returns 出站消息或 null
   */
  async processMessage(message: InboundMessage): Promise<OutboundMessage | null> {
    const sessionStatus = getSessionStatusManager();

    // 更新状态为 busy
    sessionStatus.set(this.sessionKey, { type: 'busy' });

    try {
      logger.info(
        {
          sessionKey: this.sessionKey,
          channel: this.channel,
          chatId: this.chatId,
          contentLength: message.content.length,
        },
        'Processing message',
      );

      // 1. 应用聊天上下文
      this.toolRuntime.applyChatContext(this.channel, this.chatId);

      // 2. 追加用户消息到会话
      const userMessage: SessionMessage = {
        role: message.senderId === 'cron' ? 'system' : 'user',
        content: message.content,
        timestamp: new Date().toISOString(),
      };
      await this.sessionOrchestrator.appendUserMessage(this.sessionKey, userMessage);

      // 3. 构建提示消息
      const messages = await this.sessionOrchestrator.buildPromptMessages(
        this.channel,
        this.chatId,
        message.content,
        this.sessionKey,
      );

      // 4. 获取工具定义
      const tools = this.toolRuntime.getDefinitions();

      // 5. 获取模型配置
      const model = this.config.agents.defaults.model;
      const temperature = this.config.agents.defaults.temperature;
      const maxTokens = this.config.agents.defaults.maxTokens;
      const maxSteps = this.config.agents.defaults.maxIterations;

      // 6. 流式处理 LLM 响应
      const { assistantContent, finalUIMessage } = await this.streamBridge.streamAndEmit({
        channel: this.channel,
        chatId: this.chatId,
        messages,
        tools,
        model,
        temperature,
        maxTokens,
        maxSteps,
        abortSignal: this.signal,
        executeTool: async (name, args) =>
          this.toolRuntime.executeTool(name, args, {
            channel: this.channel,
            chatId: this.chatId,
          }),
      });

      // 7. 追加助手消息到会话
      const finalContent = finalUIMessage ? JSON.stringify(finalUIMessage) : assistantContent;
      const assistantMessage: SessionMessage = {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        id: finalUIMessage?.id,
        parts: finalUIMessage?.parts as any,
        model,
      };
      await this.sessionOrchestrator.appendAssistantMessage(this.sessionKey, assistantMessage);

      // 8. 可选：合并记忆
      await this.sessionOrchestrator.maybeConsolidate(this.sessionKey);

      // 9. 更新状态为 idle
      sessionStatus.set(this.sessionKey, { type: 'idle' });

      logger.info(
        { sessionKey: this.sessionKey, outputLength: assistantContent.length },
        'Message processed successfully',
      );

      // 10. 返回出站消息
      return {
        channel: this.channel,
        chatId: this.chatId,
        content: finalContent,
      };
    } catch (error) {
      // 更新状态为 error
      const errorMsg = error instanceof Error ? error.message : String(error);
      sessionStatus.set(this.sessionKey, { type: 'error', error: errorMsg });

      logger.error(
        { sessionKey: this.sessionKey, error },
        'Failed to process message',
      );

      throw error;
    }
  }

  /**
   * 取消当前处理
   *
   * 取消正在进行中的 LLM 调用和工具执行
   */
  abort(): void {
    logger.info({ sessionKey: this.sessionKey }, 'Aborting session processor');
    this.abortController.abort();
  }

  /**
   * 检查是否已取消
   *
   * @returns 是否已取消
   */
  isAborted(): boolean {
    return this.abortController.signal.aborted;
  }
}
