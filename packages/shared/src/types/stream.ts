import type { TextStreamPart, OnFinishEvent, StepResult } from 'ai';
import type { ToolSet } from '../config/mcp-schema';

export type StreamPartPayload<TOOLS extends ToolSet = ToolSet> =
  | TextStreamPart<TOOLS>
  | { type: 'error'; error: string }
  | { type: 'abort'; steps: StepResult<TOOLS>[] };

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