/**
 * Agent 状态相关端点
 */

import { Hono } from 'hono';
import type { AppContext } from '../types';
import type { MessageBus } from '@nanobot/main';

const app = new Hono<AppContext>();

/**
 * GET /api/v1/agent/status - Agent 运行状态
 */
app.get('/agent/status', async c => {
  const runtime = c.get('runtime');
  const bus = c.get('bus') as MessageBus;
  const startTime = c.get('startTime');
  const sessions = runtime.sessions;
  const channelManager = c.get('channelManager');

  const sessionList = await sessions.listSessions();
  const busStatus = bus.getStatus();

  return c.json({
    code: 200,
    message: 'Agent status retrieved',
    data: {
      running: true,
      uptime: Date.now() - startTime.getTime(),
      model: runtime.config.agents.defaults.model,
      temperature: runtime.config.agents.defaults.temperature,
      maxTokens: runtime.config.agents.defaults.maxTokens,
      sessions: {
        total: sessionList.length,
      },
      bus: {
        inboundQueueLength: busStatus.inboundQueueLength,
        outboundQueueLength: busStatus.outboundQueueLength,
        inboundConsumersLength: busStatus.inboundConsumersLength,
        outboundConsumersLength: busStatus.outboundConsumersLength,
      },
      channels: channelManager.getStatus(),
    },
  });
});

/**
 * GET /api/v1/agent/sessions - 所有会话列表
 */
app.get('/agent/sessions', async c => {
  const sessions = c.get('runtime').sessions;

  const sessionList = await sessions.listSessions();

  return c.json({
    code: 200,
    message: 'Sessions retrieved',
    data: {
      sessions: sessionList,
      total: sessionList.length,
    },
  });
});

/**
 * GET /api/v1/agent/sessions/:key - 特定会话详情
 */
app.get('/agent/sessions/:key', async c => {
  const key = c.req.param('key');
  const sessions = c.get('runtime').sessions;

  const session = await sessions.getOrCreate(key);

  return c.json({
    code: 200,
    message: 'Session retrieved',
    data: {
      key: session.key,
      messageCount: session.messages.length,
      lastConsolidated: session.lastConsolidated,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      metadata: session.metadata,
    },
  });
});

/**
 * GET /api/v1/agent/memory/:key - 会话内存状态
 */
app.get('/agent/memory/:key', async c => {
  const key = c.req.param('key');
  const sessions = c.get('runtime').sessions;
  const memory = c.get('runtime').memory;

  const session = await sessions.getOrCreate(key);
  const memoryWindow = c.get('config').agents.defaults.memoryWindow;

  return c.json({
    code: 200,
    message: 'Session memory retrieved',
    data: {
      key: session.key,
      messageCount: session.messages.length,
      lastConsolidated: session.lastConsolidated,
      memoryWindow,
      hasMemoryConsolidator: memory !== null,
    },
  });
});

export default app;
