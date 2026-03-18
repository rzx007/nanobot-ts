/**
 * Question Tool
 *
 * 允许 Agent 向用户提问的工具
 */

import { Tool } from './base';
import { jsonSchema, JSONSchema7, tool } from 'ai';
import type { QuestionManager } from '../core/question';
import type { Question } from '@nanobot/shared';

export class QuestionTool extends Tool {
  name = 'question';

  description =
    '向用户提问以获取更多信息或确认操作。支持批量提问多个问题。';

  parameters = {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: '问题列表',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: '完整问题文本',
            },
            header: {
              type: 'string',
              description: '简短标签（≤30字符）',
            },
            options: {
              type: 'array',
              description: '选项列表',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description: '选项标签（1-5词）',
                  },
                  description: {
                    type: 'string',
                    description: '选项说明',
                  },
                },
                required: ['label', 'description'],
              },
            },
          },
          required: ['question', 'header', 'options'],
        },
      },
    },
    required: ['questions'],
  };

  constructor(
    private questionManager: QuestionManager,
    private context: { channel: string; chatId: string } | null = null
  ) {
    super();
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { questions } = params as { questions: Question[] };

    const channel = this.context?.channel ?? 'cli';
    const chatId = this.context?.chatId ?? 'direct';

    try {
      const answers = await this.questionManager.ask(
        questions,
        channel,
        chatId
      );

      const result = questions.map((q, i) => ({
        question: q.question,
        answer: answers[i]?.join(', ') || '未回答',
      }));

      return JSON.stringify({
        title: `Asked ${questions.length} question(s)`,
        output: `User answered: ${result.map(r => r.answer).join('; ')}`,
        metadata: { answers: result },
      });
    } catch (error) {
      if (error instanceof Error) {
        return `Error: ${error.message}`;
      }
      return 'Unknown error occurred';
    }
  }

  setContext(channel: string, chatId: string): void {
    this.context = { channel, chatId };
  }

  toSchema() {
    return tool({
      description: this.description,
      inputSchema: jsonSchema(this.parameters as JSONSchema7),
    });
  }
}
