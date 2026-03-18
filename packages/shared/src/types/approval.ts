/**
 * Approval System Type Definitions
 *
 * 定义审批系统所需的类型，用于工具执行确认
 */

export interface ApprovalEvent {
  type: 'approval.asked' | 'approval.replied';
  requestID: string;
  channel: string;
  chatId: string;
  toolName: string;
  params: Record<string, unknown>;
  timeout: number;
  timestamp: Date;
}

/**
 * ApprovalManager 的公开 API 类型
 * 与 @nanobot/main 中 ApprovalManager 实现保持一致，便于依赖注入与测试
 */
export interface ApprovalManager {
  request(
    toolName: string,
    params: Record<string, unknown>,
    channel: string,
    chatId: string,
  ): Promise<boolean>;
  respond(requestID: string, approved: boolean): Promise<void>;
  cancel(requestID: string): void;
  close(): void;
  readonly pendingCount: number;
}
