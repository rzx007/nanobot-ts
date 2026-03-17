/**
 * Question System Type Definitions
 *
 * 定义问题系统所需的类型，用于 Agent 向用户提问
 */

export interface QuestionOption {
  label: string;
  description: string;
}

export interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
}

export interface QuestionEvent {
  type: 'question.asked' | 'question.replied';
  requestID: string;
  channel: string;
  chatId: string;
  questions: Question[];
  timestamp: Date;
}

/**
 * QuestionManager 的公开 API 类型
 * 与 @nanobot/main 中 QuestionManager 实现保持一致，便于依赖注入与测试
 */
export interface QuestionManager {
  ask(questions: Question[], channel: string, chatId: string): Promise<string[][]>;
  reply(requestID: string, answers: string[][]): Promise<void>;
  cancel(requestID: string): void;
  close(): void;
  readonly pendingCount: number;
}
