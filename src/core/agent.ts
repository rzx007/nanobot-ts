/**
 * Agent 主循环
 *
 * AI 对话的核心处理引擎
 */

import type { InboundMessage, OutboundMessage, ProgressOptions } from '../bus/events';
import { getSessionKey } from '../bus/events';
import type { ToolRegistry } from '../tools';
import type { LLMProvider } from '../providers';
import type { Config } from '../config/schema';
import type { SessionManager } from '../storage';
import { logger } from '../utils/logger';
import { ContextBuilder } from './context';

/**
 * Agent 配置选项
 */
export interface AgentOptions {
  /** 消息总线 */
  bus: any;

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
  skills?: import('./skills').SkillLoader;

  /** 确认管理器 (可选，用于消息渠道的确认) */
  approvalManager?: import('./approval').ApprovalManager;
}

/**
 * Agent 主循环
 *
 * 负责处理消息、调用 LLM、执行工具的主逻辑
 */
export class AgentLoop {
  /** 配置 */
  private config: Config;

  /** 消息总线 */
  private bus: any;

  /** LLM 提供商 */
  private provider: LLMProvider;

  /** 工具注册表 */
  private tools: ToolRegistry;

  /** 会话管理器 */
  private sessions: SessionManager;

  /** 内存整合器 (可选) */
  private memory: import('./memory').MemoryConsolidator | null = null;

  /** 技能加载器 (可选) */
  private skills: import('./skills').SkillLoader | null = null;

  /** 确认管理器 (可选) */
  private approvalManager: import('./approval').ApprovalManager | null = null;

  /** 是否正在运行 */
  private running = false;

  /** 最大迭代次数 */
  private readonly maxIterations: number;

  /** 内存窗口 */
  private readonly memoryWindow: number;

  /** 工具结果最大字符数 (截断长输出) */
  private static readonly TOOL_RESULT_MAX_CHARS = 500;

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
    this.approvalManager = options.approvalManager ?? null;
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

    try {
      // 持续处理入站消息
      while (this.running) {
        try {
          // 消费入站消息 (超时 1 秒以允许检查 running 状态)
          const msg = await this.bus.consumeInbound();

          // 检查是否是确认回复（用于消息渠道）
          if (this.approvalManager) {
            const inboundMsg = msg as InboundMessage;
            const isApprovalResponse = this.approvalManager.handleUserMessage(
              inboundMsg.channel,
              inboundMsg.chatId,
              inboundMsg.content,
            );
            // 如果是确认回复，跳过处理（已由 ApprovalManager 处理）
            if (isApprovalResponse) {
              logger.debug(
                { channel: inboundMsg.channel, chatId: inboundMsg.chatId },
                'Message handled as approval response',
              );
              continue;
            }
          }

          logger.info(
            { channel: (msg as InboundMessage).channel, chatId: (msg as InboundMessage).chatId },
            'Processing inbound message',
          );

          const response = await this._processMessage(msg);

          if (response) await this.bus.publishOutbound(response);
        } catch (rawErr) {
          const err =
            rawErr ??
            new Error(
              'Rejected with undefined/null (unhandled from SDK or bus.publishOutbound). Run with LOG_LEVEL=debug and check stack.',
            );
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? err.stack : (err as { stack?: string })?.stack;
          logger.error({ err, message, stack }, 'Error processing message');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Agent main loop error');
    } finally {
      this.running = false;
      logger.info('Agent main loop stopped');
    }
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
   *
   * @param msg - 入站消息
   * @param onProgress - 进度回调
   * @returns 出站消息或 null
   */
  async process(
    msg: InboundMessage,
    onProgress?: (content: string, options?: ProgressOptions) => Promise<void>,
  ): Promise<OutboundMessage | null> {
    logger.info(`Processing message: ${msg.channel}:${msg.chatId}`);

    // CLI 单次调用时未走 run()，this.running 一直为 false，会导致 _processMessage 内 while 不执行
    const wasRunning = this.running;
    this.running = true;
    try {
      // 执行消息处理流程
      const response = await this._processMessage(msg, onProgress);
      // 发布到出站队列
      if (response) {
        await this.bus.publishOutbound(response);
      }

      return response;
    } catch (err) {
      logger.error({ err }, 'Failed to process message');
      return null;
    } finally {
      this.running = wasRunning;
    }
  }

  /**
   * 去除 <think>...</think> 块 (部分模型会在 content 中嵌入思考)
   */
  private static _stripThink(text: string | null | undefined): string {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || '';
  }

  /**
   * 处理消息的核心逻辑
   *
   * @param msg - 入站消息
   * @param onProgress - 进度回调
   * @returns 出站消息
   */
  private async _processMessage(
    msg: InboundMessage,
    onProgress?: (content: string, options?: ProgressOptions) => Promise<void>,
  ): Promise<OutboundMessage> {
    const { channel, chatId, content } = msg;
    const sessionKey = getSessionKey(msg);

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

    const chatParams: Parameters<LLMProvider['chat']>[0] = {
      messages,
      tools,
      model: this.config.agents.defaults.model,
      temperature: this.config.agents.defaults.temperature,
      maxTokens: this.config.agents.defaults.maxTokens,
      maxSteps: this.maxIterations,
      executeTool: async (name, args) => {
        // 传递上下文信息给工具注册表（用于确认机制）
        let result = await this.tools.execute(name, args, {
          channel,
          chatId,
        });
        if (result.length > AgentLoop.TOOL_RESULT_MAX_CHARS) {
          result = result.slice(0, AgentLoop.TOOL_RESULT_MAX_CHARS) + '\n... (truncated)';
        }
        return `Tool "${name}" returned:\n${result}`;
      },
    };
    if (onProgress) {
      chatParams.onStepFinish = step => {
        if (step?.text != null && step.text !== '') {
          onProgress(step.text, { toolHint: true }).catch(() => { });
        }
      };
    }
    const llmResponse = await this.provider.chat(chatParams);

    const assistantContent = AgentLoop._stripThink(llmResponse.content ?? '');

    if (assistantContent) {
      await this.sessions.addMessage(sessionKey, {
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
      });
    }

    // 内存整合 (超过阈值时): 增量归档，更新 lastConsolidated
    if (this.memory) {
      const session = await this.sessions.getOrCreate(sessionKey);
      if (this.memory.needsConsolidation(session)) {
        await this.memory.consolidate(session);
        await this.sessions.saveSession(session);
      }
    }

    // 发送最终响应
    if (onProgress) {
      await onProgress(assistantContent);
    }

    return {
      channel,
      chatId,
      content: typeof assistantContent === 'string' ? assistantContent : '',
    };
  }
}
