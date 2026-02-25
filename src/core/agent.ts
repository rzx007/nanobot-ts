/**
 * Agent 主循环
 * 
 * AI 对话的核心处理引擎
 */

import type {
  InboundMessage,
  OutboundMessage,
  ToolCall,
  ProgressOptions,
} from '../bus/events';
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
    this.maxIterations = this.config.agents.defaults.maxIterations;
    this.memoryWindow = this.config.agents.defaults.memoryWindow;
  }

  /**
   * 启动主循环 (持续运行)
   */
  async run(): Promise<void> {
    if (this.running) {
      logger.warn('Agent 已在运行中');
      return;
    }

    this.running = true;
    logger.info('Agent 主循环已启动');

    try {
      // 持续处理入站消息
      while (this.running) {
        try {
          // 消费入站消息 (超时 1 秒以允许检查 running 状态)
          const msg = await Promise.race([
            this.bus.consumeInbound(),
            new Promise((_, resolve) => setTimeout(resolve, 1000)),
          ]);

          // 如果超时且未运行，退出循环
          if (!msg || msg instanceof Error) {
            continue;
          }

          // 处理消息
          await this._processMessage(msg);
        } catch (err) {
          logger.error({ err }, '处理消息时出错');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Agent 主循环出错');
    } finally {
      this.running = false;
      logger.info('Agent 主循环已停止');
    }
  }

  /**
   * 停止主循环
   */
  stop(): void {
    this.running = false;
    logger.info('Agent 正在停止...');
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
    onProgress?: (content: string, options?: ProgressOptions) => Promise<void>
  ): Promise<OutboundMessage | null> {
    logger.info(`处理消息: ${msg.channel}:${msg.chatId}`);

    try {
      // 执行消息处理流程
      const response = await this._processMessage(msg, onProgress);

      // 发布到出站队列
      if (response) {
        await this.bus.publishOutbound(response);
      }

      return response;
    } catch (err) {
      logger.error({ err }, '处理消息失败');
      return null;
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
    onProgress?: (content: string, options?: ProgressOptions) => Promise<void>
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
      const help = `**Nanobot 命令**
- \`/new\` - 开启新会话，归档后清空当前对话历史
- \`/help\` - 显示此帮助`;
      return { channel, chatId, content: help };
    }

    // 添加用户消息到会话
    await this.sessions.addMessage(sessionKey, {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    });

    // 获取会话历史
    const history = await this.sessions.getHistory(
      sessionKey,
      this.memoryWindow
    );

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
    const messages: Array<{ role: string; content: string | Array<{ type: 'tool-result'; toolCallId: string; toolName: string; output: string }> }> = [
      ...ContextBuilder.buildMessages({
        systemPrompt,
        history,
        currentMessage: content,
        channel,
        chatId,
      }),
    ];

    // 获取工具定义
    const tools = this.tools.getDefinitions();

    // 迭代处理 LLM 响应和工具调用
    let iterations = 0;
    let assistantContent = '';

    while (iterations < this.maxIterations && this.running) {
      iterations++;

      // 调用 LLM
      const llmResponse = await this.provider.chat({
        messages,
        tools,
        model: this.config.agents.defaults.model,
        temperature: this.config.agents.defaults.temperature,
        maxTokens: this.config.agents.defaults.maxTokens,
      });

      // 检查是否有工具调用
      if (!llmResponse.hasToolCalls) {
        assistantContent = AgentLoop._stripThink(llmResponse.content);
        break;
      }

      // 发送进度更新 (工具调用提示)
      if (onProgress) {
        await onProgress(llmResponse.content, { toolHint: true });
      }

      // 执行工具调用
      const toolResults = await this._executeToolCalls(llmResponse.toolCalls);

      // 添加工具结果到消息列表 (AI SDK 格式: ToolResultPart[])
      const toolCallParts = toolResults.map((output, i) => {
        const tc = llmResponse.toolCalls[i]!;
        return { type: 'tool-result' as const, toolCallId: tc.id, toolName: tc.name, output };
      });
      messages.push({ role: 'tool', content: toolCallParts });

      // 保存工具调用到会话
      for (const toolCall of llmResponse.toolCalls) {
        await this.sessions.addMessage(sessionKey, {
          role: 'assistant',
          content: '', // 工具调用没有内容
          timestamp: new Date().toISOString(),
          toolCalls: toolCall,
          toolCallId: toolCall.id,
        });
      }
    }

    // 添加最终响应到会话
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
      content: assistantContent,
    };
  }

  /**
   * 执行工具调用
   * 
   * @param toolCalls - 工具调用列表
   * @returns 工具执行结果列表
   */
  private async _executeToolCalls(toolCalls: ToolCall[]): Promise<string[]> {
    const results: string[] = [];

    for (const toolCall of toolCalls) {
      logger.info(`执行工具: ${toolCall.name}`);

      let result = await this.tools.execute(toolCall.name, toolCall.arguments);
      if (result.length > AgentLoop.TOOL_RESULT_MAX_CHARS) {
        result = result.slice(0, AgentLoop.TOOL_RESULT_MAX_CHARS) + '\n... (truncated)';
      }
      results.push(`工具 "${toolCall.name}" 返回:\n${result}`);
    }

    return results;
  }

}
