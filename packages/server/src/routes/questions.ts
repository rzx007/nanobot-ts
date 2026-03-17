/**
 * 问题相关端点
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../types';
import { ValidationError } from '../types';

const app = new Hono<AppContext>();

/**
 * POST /api/v1/questions/:requestID/reply - 提交问题回答
 */
app.post(
  '/questions/:requestID/reply',
  zValidator(
    'json',
    z.object({
      answers: z.array(z.array(z.string())),
    })
  ),
  async c => {
    const { requestID } = c.req.param();
    const { answers } = c.req.valid('json');

    const questionManager = c.get('questionManager');
    if (!questionManager) {
      return c.json({ success: false, error: 'QuestionManager not available' }, 500);
    }

    try {
      await questionManager.reply(requestID, answers);
      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ success: false, error: message }, 400);
    }
  }
);

/**
 * POST /api/v1/questions/:requestID/cancel - 取消问题
 */
app.post('/questions/:requestID/cancel', async c => {
  const { requestID } = c.req.param();

  const questionManager = c.get('questionManager');
  if (!questionManager) {
    return c.json({ success: false, error: 'QuestionManager not available' }, 500);
  }

  try {
    questionManager.cancel(requestID);
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, error: message }, 400);
  }
});

/**
 * GET /api/v1/questions/status - 获取待处理问题状态
 */
app.get('/questions/status', async c => {
  const questionManager = c.get('questionManager');
  if (!questionManager) {
    return c.json({ success: false, error: 'QuestionManager not available' }, 500);
  }

  return c.json({
    success: true,
    data: {
      pendingCount: questionManager.pendingCount,
    },
  });
});

export default app;
