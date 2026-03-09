/**
 * 通道状态端点（只读）
 */

import { Hono } from 'hono';
import type { AppContext } from '../types';

const app = new Hono<AppContext>();

/**
 * GET /api/v1/channels - 通道状态
 */
app.get('/api/v1/channels', async c => {
  const channelManager = c.get('channelManager');

  const channels = channelManager.getStatus();

  return c.json({
    code: 200,
    message: 'Channels status retrieved',
    data: {
      channels,
      total: channels.length,
    },
  });
});

export default app;
