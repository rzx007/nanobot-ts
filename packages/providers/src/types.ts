/**
 * LLM Provider 类型定义
 *
 * 统一使用 onChunk 单通道处理所有流事件类型
 */

import type {
  LanguageModel,
  OnFinishEvent,
  StepResult,
  StreamTextResult,
  UIMessageChunk,
} from 'ai';
import type { ToolSet } from '@nanobot/shared';

/**
 * 模型工厂：根据模型名返回 AI SDK 的 LanguageModel
 */
export type ModelFactory = (modelName: string) => LanguageModel;

/**
 * Provider 注册表：provider 名称 -> 模型工厂
 */
export type ProviderRegistry = Map<string, ModelFactory>;

/**
 * 统一流事件类型：
 * - chunk: AI SDK UI 的 UIMessageChunk（与 streamText().toUIMessageStream() 一致）
 * - finish/error/nanobot-abort: 终态或扩展事件，便于落库与渠道分发
 */
export type OnChunkResult<TOOLS extends ToolSet = ToolSet> =
  | { type: 'chunk'; chunk: UIMessageChunk }
  | { type: 'finish'; finish: OnFinishEvent<TOOLS>; assistantContent: string }
  | { type: 'error'; error: Error }
  | { type: 'nanobot-abort'; steps: StepResult<TOOLS>[] };

export interface StreamChatParams<TOOLS extends ToolSet> {
  messages: Array<{ role: string; content: unknown; timestamp?: string }>;
  tools: TOOLS;
  model: string;
  temperature?: number;
  abortSignal?: AbortSignal;
  maxSteps?: number;
  executeTool?: (name: string, args: Record<string, unknown>) => Promise<string>;
  /** 对齐 streamText */
  maxOutputTokens?: number;
  /** 兼容旧参数名，优先级低于 maxOutputTokens */
  maxTokens?: number;
  /** 单通道事件回调 */
  onChunk?: (event: OnChunkResult<TOOLS>) => void;
  /** 兼容旧回调：内部会同步产出 onChunk(type=finish) */
  onFinish?: (event: OnFinishEvent<TOOLS>) => void;
  /** 兼容旧回调：内部会同步产出 onChunk(type=error) */
  onError?: (error: Error) => void;
  /** 兼容旧回调：内部会同步产出 onChunk(type=abort) */
  onAbort?: (event: { steps: StepResult<TOOLS>[] }) => void;
}

/**
 * LLM Provider 接口
 *
 * 统一使用 streamText，通过 onChunk 单通道回调处理所有事件
 */
export interface LLMProvider {
  streamChat<TOOLS extends ToolSet>(params: StreamChatParams<TOOLS>): Promise<StreamTextResult<TOOLS, any>>;
}

export { LLMProviderImpl } from './registry';
