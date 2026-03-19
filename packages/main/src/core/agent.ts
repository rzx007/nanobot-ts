/**
 * Agent 主循环
 *
 * AI 对话的核心处理引擎
 */

import { getSessionKey } from '@nanobot/shared';
import type { ToolRegistry } from '../tools/registry';
import type { LLMProvider, OnChunkResult } from '@nanobot/providers';
import { taskCancellation } from './task-cancellation';
import type { Config } from '@nanobot/shared';
import type { SessionManager } from '../storage';
import { logger } from '@nanobot/logger';
import { ContextBuilder } from './context';
import type { MessageBus } from '../bus';

type InboundMessage = {
  channel: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  sessionKeyOverride?: string;
};

type OutboundMessage = {
  channel: string;
  chatId: string;
  content: string;
  replyTo?: string;
  media?: string[];
  metadata?: Record<string, unknown>;
};

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
    this.maxIterations = this.config.agents.defaults.maxIterations;
    this.memoryWindow = this.config.agents.defaults.memoryWindow;
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

            logger.info(
              { channel: (msg as InboundMessage).channel, chatId: (msg as InboundMessage).chatId },
              '🐞 Processing inbound message',
            );

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
   * 处理 subagent 结果消息
   */
  private async handleSubagentResult(msg: InboundMessage): Promise<OutboundMessage> {
    const { channel, chatId, content } = msg;

    logger.info(`Processing subagent result: ${content}`);

    const summary = await this.summarizeSubagentResult(content);

    return {
      channel,
      chatId,
      content: summary,
    };
  }

  /**
   * 总结 subagent 结果
   */
  private async summarizeSubagentResult(content: string): Promise<string> {
    const statusMatch = content.match(/\[Subagent '([^\]]+)' (completed successfully|failed)/);
    const taskLabel = statusMatch?.[1] ?? '任务';
    const status = statusMatch?.[2] ?? 'completed';

    const resultMatch = content.match(/Result:\n([\s\S]*?)\n/);
    const result = resultMatch?.[1] ?? '';

    let summary: string;
    if (status === 'completed successfully') {
      summary = `${taskLabel} 已完成。`;
      if (result) {
        summary += ` ${result}`;
      }
    } else {
      summary = `${taskLabel} 失败。`;
      if (result) {
        summary += ` ${result}`;
      }
    }

    return summary;
  }

  /**
   * 去除思考块 (部分模型会在 content 中嵌入思考)
   */
  private static _stripThink(text: string | null | undefined): string {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim() || '';
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
    const sessionKey = getSessionKey({
      channel: msg.channel,
      chatId: msg.chatId,
      sessionKeyOverride: msg.sessionKeyOverride,
    });

    // 处理 subagent 结果消息
    if (msg.senderId === 'subagent') {
      return await this.handleSubagentResult(msg);
    }

    // 会话命令: /new 归档后清空, /help 显示帮助
    const trimmed = content.trim();
    if (trimmed === '/new') {
      if (this.memory) {
        const session = await this.sessions.getOrCreate(sessionKey);
        if (session.messages.length > 0) {
          await this.memory.consolidate(session, true);
        }
      }
      await this.sessions.clear(sessionKey);
      return { channel, chatId, content: '已开启新会话。' };
    }
    if (trimmed === '/help') {
      const help = `**Nanobot-ts 命令**
- \`/new\` - 开启新会话，归档后清空当前对话历史
- \`/help\` - 显示此帮助`;
      return { channel, chatId, content: help };
    }

    // 为当前 inbound 消息分配一个任务 ID，并注册取消信号
    const taskId = `${channel}:${chatId}:${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      // 为需要上下文的工具设置 channel/chatId（如 spawn、cron）
      for (const name of this.tools.getToolNames()) {
        const t = this.tools.get(name);
        if (
          t &&
          'setContext' in t &&
          typeof (t as { setContext?: (ch: string, cid: string) => void }).setContext === 'function'
        ) {
          (t as { setContext: (ch: string, cid: string) => void }).setContext(channel, chatId);
        }
      }

      // 添加用户消息到会话
      await this.sessions.addMessage(sessionKey, {
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      });

      // 获取会话历史
      const history = await this.sessions.getHistory(sessionKey, this.memoryWindow);

      // 构建系统提示词 (Identity + Bootstrap + Memory + Skills)
      const memoryContext = this.memory ? await this.memory.readLongTerm() : '';
      const buildOpts: import('./context').BuildSystemPromptOptions = {
        workspace: this.config.agents.defaults.workspace,
        alwaysSkills: this.skills?.getAlwaysSkills() ?? [],
      };
      if (this.skills) {
        const summary = this.skills.buildSkillsSummary();
        if (summary) buildOpts.skillsSummary = summary;
      }
      if (memoryContext) buildOpts.memoryContext = memoryContext;
      const systemPrompt = await ContextBuilder.buildSystemPrompt(buildOpts);

      // 构建消息列表 (含运行时上下文注入)
      const messages: Array<{
        role: string;
        content:
        | string
        | Array<{ type: 'tool-result'; toolCallId: string; toolName: string; output: string }>;
      }> = [
          ...ContextBuilder.buildMessages({
            systemPrompt,
            history,
            currentMessage: content,
            channel,
            chatId,
          }),
        ];

      // 获取工具定义，由 SDK 自动执行工具（executeTool + maxSteps）
      const tools = this.tools.getDefinitions();

      const signal = taskCancellation.register(taskId, {
        channel,
        chatId,
        sessionKey,
        startedAt: new Date(),
        origin: 'user',
      });

      let finishEvent: any = null;
      let finalAssistantContent = '';
      let finishEmitted = false;

      const streamResult = await this.provider.streamChat({
        messages,
        tools,
        model: this.config.agents.defaults.model,
        temperature: this.config.agents.defaults.temperature,
        maxTokens: this.config.agents.defaults.maxTokens,
        abortSignal: signal,
        maxSteps: this.maxIterations,
        executeTool: async (name: string, args: Record<string, unknown>) => {
          let result = await this.tools.execute(name, args, {
            channel,
            chatId,
          });
          if (result.length > AgentLoop.TOOL_RESULT_MAX_CHARS) {
            result = result.slice(0, AgentLoop.TOOL_RESULT_MAX_CHARS) + '\n... (truncated)';
          }
          return `Tool "${name}" returned:\n${result}`;
        },
        onChunk: (event: OnChunkResult<any>) => {
          if (event.type === 'chunk') {
            this.bus.emit('stream-part', {
              channel,
              chatId,
              part: event.chunk,
            });
            return;
          }

          if (event.type === 'finish') {
            finishEvent = event.finish;
            this.bus.emit('stream-finish', {
              channel,
              chatId,
              part: {
                type: 'finish',
                finishReason: event.finish.finishReason,
                usage: event.finish.usage,
                totalUsage: event.finish.totalUsage,
                toolCalls: event.finish.toolCalls,
              },
            });
            finishEmitted = true;
            return;
          }

          if (event.type === 'error') {
            this.bus.emit('stream-part', {
              channel,
              chatId,
              part: { type: 'error', error: event.error.message },
            });
            logger.error(`LLM stream error: ${event.error.message}`);
            return;
          }

          if (event.type === 'abort') {
            this.bus.emit('stream-part', {
              channel,
              chatId,
              part: { type: 'abort', steps: event.steps },
            });
          }
        },
        onError: (error: Error) => {
          logger.error(`LLM stream error: ${error.message}`);
        },
      });


      const streamedText = await streamResult.text;
      if (!finalAssistantContent) {
        finalAssistantContent = AgentLoop._stripThink(streamedText ?? '');
      }

      if (!finishEmitted) {
        const fallbackFinishEvent = finishEvent ?? {};
        this.bus.emit('stream-finish', {
          channel,
          chatId,
          assistantContent: finalAssistantContent,
          finishReason: fallbackFinishEvent.finishReason,
          usage: fallbackFinishEvent.usage,
          totalUsage: fallbackFinishEvent.totalUsage,
          toolCalls: fallbackFinishEvent.toolCalls,
        });
      }

      if (finalAssistantContent) {
        await this.sessions.addMessage(sessionKey, {
          role: 'assistant',
          content: finalAssistantContent,
          timestamp: new Date().toISOString(),
          model: this.config.agents.defaults.model,
        } as any);
      }

      // 内存整合 (超过阈值时): 增量归档，更新 lastConsolidated
      if (this.memory) {
        const session = await this.sessions.getOrCreate(sessionKey);
        if (this.memory.needsConsolidation(session)) {
          await this.memory.consolidate(session);
          await this.sessions.saveSession(session);
        }
      }

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
      taskCancellation.cleanup(taskId);
    }
  }
}
