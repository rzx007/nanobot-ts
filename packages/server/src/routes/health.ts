/**
 * 健康检查端点
 */

import { Hono } from 'hono';
import type { AppContext, HealthStatus, DetailedHealthStatus } from '../types';
import type { MessageBus } from '@nanobot/main';
import { version } from '../../../../package.json';

const app = new Hono<AppContext>();

/**
 * GET /health - 基础健康检查
 */
app.get('/health', async c => {
  const startTime = c.get('startTime');
  const uptime = Date.now() - startTime.getTime();

  const data: HealthStatus = {
    status: 'healthy',
    uptime,
    version,
    timestamp: new Date().toISOString(),
  };

  return c.json({
    code: 200,
    message: 'Server is healthy',
    data,
  });
});

/**
 * GET /health/detailed - 详细健康检查
 */
app.get('/health/detailed', async c => {
  const startTime = c.get('startTime');
  const uptime = Date.now() - startTime.getTime();
  const bus = c.get('bus') as MessageBus;
  const sessions = c.get('runtime').sessions;
  const channelManager = c.get('channelManager');

  const sessionList = await sessions.listSessions();
  const busStatus = bus.getStatus();

  const data: DetailedHealthStatus = {
    status: 'healthy',
    uptime,
    version,
    timestamp: new Date().toISOString(),
    bus: {
      inboundQueueLength: busStatus.inboundQueueLength,
      outboundQueueLength: busStatus.outboundQueueLength,
    },
    sessions: {
      count: sessionList.length,
    },
    channels: channelManager.getStatus(),
  };

  return c.json({
    code: 200,
    message: 'Server is healthy',
    data,
  });
});

export default app;
