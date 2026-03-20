import type { OnFinishEvent, StepResult, UIMessageChunk } from 'ai';
import type { ToolSet } from '@nanobot/shared';

/**
 * Core `onAbort` 携带 steps，与 UIMessageChunk 的 `abort`（仅 reason）区分。
 */
export type StreamNanobotAbortPart<TOOLS extends ToolSet = ToolSet> = {
  type: 'nanobot-abort';
  steps: StepResult<TOOLS>[];
};

/**
 * SSE / 总线流式分片：对齐 AI SDK UI 的 UIMessageChunk，外加 nanobot 扩展。
 */
export type StreamPartPayload<TOOLS extends ToolSet = ToolSet> =
  | UIMessageChunk
  | StreamNanobotAbortPart<TOOLS>;

export interface StreamPartEvent<TOOLS extends ToolSet = ToolSet> {
  channel: string;
  chatId: string;
  part: StreamPartPayload<TOOLS>;
}

export type StreamFinishPart<TOOLS extends ToolSet = ToolSet> = {
  type: 'finish';
  assistantContent?: string;
} & Partial<Pick<OnFinishEvent<TOOLS>, 'finishReason' | 'usage' | 'totalUsage' | 'toolCalls'>>;

export interface StreamFinishEvent<TOOLS extends ToolSet = ToolSet> {
  channel: string;
  chatId: string;
  part: StreamFinishPart<TOOLS>;
}
