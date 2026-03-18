/**
 * Approval 相关端点
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../types';

const app = new Hono<AppContext>();

/**
 * POST /api/v1/approvals/:requestID/reply - 提交审批回复
 */
app.post('/approvals/:requestID/reply', async c => {
  const schema = z.object({
    approved: z.boolean(),
  });

  const body = await c.req.json();
  const validated = schema.safeParse(body);

  if (!validated.success) {
    return c.json({ success: false, error: 'Validation failed', issues: validated.error.issues }, 400);
  }

  const requestID = c.req.param('requestID');
  const approvalManager = c.get('approvalManager');

  if (!approvalManager) {
    return c.json({ success: false, error: 'ApprovalManager not available' }, 500);
  }

  const { approved } = validated.data;
  await approvalManager.respond(requestID, approved);

  return c.json({
    success: true,
    message: approved ? 'Approval granted' : 'Approval denied',
    data: { requestID, approved },
  });
});

/**
 * POST /api/v1/approvals/:requestID/cancel - 取消审批
 */
app.post('/approvals/:requestID/cancel', async c => {
  const requestID = c.req.param('requestID');
  const approvalManager = c.get('approvalManager');

  if (!approvalManager) {
    return c.json({ success: false, error: 'ApprovalManager not available' }, 500);
  }

  approvalManager.cancel(requestID);

  return c.json({
    success: true,
    message: 'Approval cancelled',
    data: { requestID },
  });
});

/**
 * GET /api/v1/approvals/status - 获取待处理审批状态
 */
app.get('/approvals/status', async c => {
  const approvalManager = c.get('approvalManager');

  if (!approvalManager) {
    return c.json({ success: false, error: 'ApprovalManager not available' }, 500);
  }

  return c.json({
    success: true,
    data: {
      pendingCount: approvalManager.pendingCount,
    },
  });
});

export default app;
