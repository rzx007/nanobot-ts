/**
 * AI SDK UIMessage 类型定义
 * 定义自定义数据部分，用于类型安全的数据流式传输
 */

import type { UIMessage, UIDataTypes } from 'ai';

/**
 * Nanobot 消息元数据类型
 * 包含 token 使用情况、工具调用等信息
 */
export interface NanobotMessageMetadata {
  assistantContent?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  totalUsage?: {
    totalTokens: number;
  };
  toolCalls?: unknown[];
}

/**
 * Nanobot 专用 UIMessage 类型
 * 定义了自定义的 data parts：question 和 approval
 */
export type NanobotUIMessage = UIMessage<
  NanobotMessageMetadata, // METADATA: 包含使用情况等元数据
  {
    /**
     * 问题数据 - 用于向用户提问
     */
    question: {
      type: 'question.asked' | 'question.replied';
      requestID: string;
      questions: Array<{
        question: string;
        header: string;
        options: Array<{
          label: string;
          description: string;
        }>;
        multiple?: boolean;
      }>;
      timestamp: number;
    };
    /**
     * 审批数据 - 用于工具执行确认
     */
    approval: {
      type: 'approval.asked' | 'approval.replied';
      requestID: string;
      toolName: string;
      params: Record<string, unknown>;
      timeout: number;
      timestamp: number;
    };
  } // DATA_PARTS: 自定义数据部分类型
>;

/**
 * 从 UIMessage 类型推断 data types
 * 复制 AI SDK 内部的 InferUIMessageData 类型
 */
export type InferUIMessageData<T extends UIMessage> = T extends UIMessage<unknown, infer DATA_TYPES> ? DATA_TYPES : UIDataTypes;
