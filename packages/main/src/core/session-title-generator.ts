/**
 * 会话标题生成器
 *
 * 使用 LLM 自动生成会话标题，提供更好的会话管理体验
 */

import type { LLMProvider } from '@nanobot/providers';
import { logger } from '@nanobot/logger';

/**
 * 标题生成配置
 */
export interface TitleGeneratorOptions {
  /** LLM 提供商 */
  provider: LLMProvider;

  /** 模型名称 */
  model?: string;
}

/**
 * 会话标题生成器
 */
export class SessionTitleGenerator {
  private readonly provider: LLMProvider;
  private readonly model: string;

  /**
   * 构造函数
   *
   * @param options - 配置选项
   */
  constructor(options: TitleGeneratorOptions) {
    this.provider = options.provider;
    this.model = options.model || 'openai:gpt-4o-mini';
  }

  /**
   * 生成会话标题
   *
   * @param firstMessage - 第一条用户消息
   * @returns 生成的标题
   */
  async generateTitle(firstMessage: string): Promise<string> {
    try {
      logger.debug({ messageLength: firstMessage.length }, 'Generating session title');

      const prompt = `Generate a short, concise title (max 50 characters) for this conversation starter:\n\n"${firstMessage}"\n\nReturn only the title, no quotes or extra text. Use the same language as the message.`;

      const result = await this.provider.streamChat({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        maxTokens: 100,
        tools: {} as any,
      });

      // 等待完整的响应
      let title = '';
      for await (const chunk of result.textStream) {
        title += chunk;
      }

      // 清理标题
      title = title.trim().replace(/^["']|["']$/g, '').substring(0, 50);

      logger.info({ generatedTitle: title }, 'Session title generated');

      return title;
    } catch (error) {
      logger.error({ error }, 'Failed to generate session title');

      // 返回基于消息的简单标题
      return this.generateFallbackTitle(firstMessage);
    }
  }

  /**
   * 生成回退标题
   *
   * @param message - 原始消息
   * @returns 简单标题
   */
  private generateFallbackTitle(message: string): string {
    // 移除换行和多余空格
    const cleaned = message.replace(/\s+/g, ' ').trim();

    // 截取前 50 个字符
    const title = cleaned.substring(0, 50);

    // 如果被截断，添加省略号
    return title.length === cleaned.length ? title : `${title}...`;
  }

  /**
   * 从对话历史生成标题
   *
   * @param messages - 对话消息列表
   * @returns 生成的标题
   */
  async generateTitleFromHistory(messages: Array<{ role: string; content: string }>): Promise<string> {
    // 找到第一条用户消息
    const firstUserMessage = messages.find((msg) => msg.role === 'user');

    if (firstUserMessage) {
      return this.generateTitle(firstUserMessage.content);
    }

    // 如果没有用户消息，使用助手消息
    const firstAssistantMessage = messages.find((msg) => msg.role === 'assistant');

    if (firstAssistantMessage) {
      return this.generateTitle(firstAssistantMessage.content);
    }

    // 默认标题
    const timestamp = new Date().toISOString().split('T')[0];
    return `New Session - ${timestamp}`;
  }
}
