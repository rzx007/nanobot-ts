/**
 * 确认处理器核心接口定义
 *
 * 定义确认处理器的接口和数据结构
 */

/**
 * 确认请求数据
 */
export interface ConfirmationRequest {
  /** 工具名称 */
  toolName: string;
  /** 工具参数 */
  params: Record<string, unknown>;
  /** 渠道名称 */
  channel: string;
  /** 聊天ID */
  chatId: string;
  /** 超时时间（秒） */
  timeout: number;
}

/**
 * 确认结果
 */
export interface ConfirmationResult {
  /** 是否批准 */
  approved: boolean;
  /** 响应时间（毫秒） */
  responseTime: number;
  /** 超时 */
  timedOut?: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 确认处理器接口
 *
 * 不同渠道的确认处理器需要实现此接口
 */
export interface ApprovalHandler {
  /**
   * 请求用户确认
   *
   * @param req - 确认请求
   * @returns 确认结果
   */
  requestConfirmation(req: ConfirmationRequest): Promise<boolean>;

  /**
   * 取消待处理的确认（可选）
   *
   * @param chatId - 聊天ID
   */
  cancelPending?(chatId: string): void;
}
