import { request } from '@/lib/request';

export interface QuestionReplyData {
  answers: string[][];
}

/**
 * 提交问题回答
 */
export async function replyQuestion(
  requestID: string,
  data: QuestionReplyData,
): Promise<{ success: boolean; error?: string }> {
  return request(`/api/v1/questions/${requestID}/reply`, {
    method: 'POST',
    body: data,
  });
}

/**
 * 取消问题
 */
export async function cancelQuestion(
  requestID: string,
): Promise<{ success: boolean; error?: string }> {
  return request(`/api/v1/questions/${requestID}/cancel`, {
    method: 'POST',
  });
}

/**
 * 获取问题状态
 */
export async function getQuestionStatus(): Promise<{
  success: boolean;
  data?: { pendingCount: number };
  error?: string;
}> {
  return request('/api/v1/questions/status');
}
