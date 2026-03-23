/**
 * 会话管理 API 路由
 *
 * 提供会话的增删改查、状态管理和搜索功能
 */

import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import type { AppContext } from '../types';
import type { SessionInfo, SessionMetadata } from '@nanobot/shared';
import { getSessionStatusManager } from '@nanobot/main';
import { SessionTitleGenerator } from '@nanobot/main';

const app = new Hono<AppContext>();

/**
 * GET /api/v1/sessions - 获取会话列表
 *
 * 查询参数：
 * - channel: 按渠道过滤
 * - archived: 是否包含归档（默认 false）
 * - limit: 最大返回数量（默认 50）
 * - search: 搜索关键词
 */
app.get('/', async c => {
  const sessions = c.get('runtime').sessions;
  const config = c.get('config');

  const query = c.req.query();
  const channel = query.channel as string | undefined;
  const archived = query.archived === 'true';
  const limit = parseInt(query.limit || '50', 10);
  const search = query.search as string | undefined;

  try {
    let sessionList: SessionInfo[];

    if (search || archived !== undefined) {
      // 使用搜索功能
      sessionList = await (sessions as any).searchSessions({
        query: search,
        channel,
        archived,
        limit,
      });
    } else if (channel) {
      // 按渠道查询
      sessionList = await sessions.listSessionsByChannel(channel);
    } else {
      // 获取所有活跃会话
      sessionList = await (sessions as any).getActiveSessions(7);
    }

    return c.json({
      code: 200,
      message: 'Sessions retrieved',
      data: {
        sessions: sessionList,
        total: sessionList.length,
      },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to retrieve sessions',
      data: null,
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * GET /api/v1/sessions/:key - 获取会话详情
 */
app.get('/:key', async c => {
  const key = c.req.param('key');
  const sessions = c.get('runtime').sessions;

  try {
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
  } catch (error) {
    return c.json({
      code: 404,
      message: 'Session not found',
      data: null,
    }, 404);
  }
});

/**
 * POST /api/v1/sessions - 创建新会话
 *
 * 请求体：
 * - key: 会话键（可选，默认自动生成）
 * - metadata: 初始元数据（可选）
 */
app.post('/', async c => {
  const sessions = c.get('runtime').sessions;
  const config = c.get('config');

  try {
    const body = await c.req.json();

    // 使用提供或默认的会话键
    const key = body.key || `${config.channels.cli.enabled ? 'cli' : 'http'}:default`;

    // 创建会话（如果不存在）
    const session = await sessions.getOrCreate(key);

    // 如果提供了初始元数据，更新它
    if (body.metadata) {
      await (sessions as any).updateMetadata(key, body.metadata);
    }

    return c.json({
      code: 200,
      message: 'Session created',
      data: {
        key: session.key,
        createdAt: session.createdAt,
        metadata: session.metadata,
      },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to create session',
      data: null,
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * PUT /api/v1/sessions/:key - 更新会话
 *
 * 请求体：
 * - metadata: 要更新的元数据字段
 */
app.put('/:key', async c => {
  const key = c.req.param('key');
  const sessions = c.get('runtime').sessions;

  try {
    const body = await c.req.json();

    // 更新元数据
    if (body.metadata) {
      await (sessions as any).updateMetadata(key, body.metadata);
    }

    const session = await sessions.getOrCreate(key);

    return c.json({
      code: 200,
      message: 'Session updated',
      data: {
        key: session.key,
        metadata: session.metadata,
      },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to update session',
      data: null,
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * DELETE /api/v1/sessions/:key - 删除会话
 */
app.delete('/:key', async c => {
  const key = c.req.param('key');
  const sessions = c.get('runtime').sessions;

  try {
    await sessions.deleteSession(key);

    return c.json({
      code: 200,
      message: 'Session deleted',
      data: { key },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to delete session',
      data: null,
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * PUT /api/v1/sessions/:key/archive - 归档/取消归档会话
 *
 * 请求体：
 * - archived: 是否归档
 */
app.put('/:key/archive', async c => {
  const key = c.req.param('key');
  const sessions = c.get('runtime').sessions;

  try {
    const body = await c.req.json();
    const archived = Boolean(body.archived);

    await (sessions as any).setArchived(key, archived);

    return c.json({
      code: 200,
      message: archived ? 'Session archived' : 'Session unarchived',
      data: { key, archived },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to update archive status',
      data: null,
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * PUT /api/v1/sessions/:key/pin - 置顶/取消置顶会话
 *
 * 请求体：
 * - pinned: 是否置顶
 */
app.put('/:key/pin', async c => {
  const key = c.req.param('key');
  const sessions = c.get('runtime').sessions;

  try {
    const body = await c.req.json();
    const pinned = Boolean(body.pinned);

    await (sessions as any).setPinned(key, pinned);

    return c.json({
      code: 200,
      message: pinned ? 'Session pinned' : 'Session unpinned',
      data: { key, pinned },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to update pin status',
      data: null,
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * POST /api/v1/sessions/:key/title - 生成并设置会话标题
 */
app.post('/:key/title', async c => {
  const key = c.req.param('key');
  const sessions = c.get('runtime').sessions;
  const provider = c.get('runtime').provider;
  const config = c.get('config');

  try {
    const session = await sessions.getOrCreate(key);

    // 如果已有标题，直接返回
    if (session.metadata?.title) {
      return c.json({
        code: 200,
        message: 'Session title already exists',
        data: {
          key,
          title: session.metadata.title,
        },
      });
    }

    // 生成标题
    const titleGenerator = new SessionTitleGenerator({
      provider,
      model: config.agents.defaults.model,
    });

    const title = await titleGenerator.generateTitleFromHistory(session.messages);

    // 保存标题
    await (sessions as any).setTitle(key, title);

    return c.json({
      code: 200,
      message: 'Session title generated',
      data: {
        key,
        title,
      },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to generate session title',
      data: null,
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * GET /api/v1/sessions/status - 获取所有会话状态
 */
app.get('/status', async c => {
  const sessionStatusManager = getSessionStatusManager();

  try {
    const status = sessionStatusManager.list();
    const stats = sessionStatusManager.getStats();

    return c.json({
      code: 200,
      message: 'Session statuses retrieved',
      data: {
        statuses: status,
        stats,
      },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to retrieve session statuses',
      data: null,
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * GET /api/v1/sessions/:key/status - 获取指定会话状态
 */
app.get('/:key/status', async c => {
  const key = c.req.param('key');
  const sessionStatusManager = getSessionStatusManager();

  try {
    const status = sessionStatusManager.get(key);

    return c.json({
      code: 200,
      message: 'Session status retrieved',
      data: {
        key,
        status,
      },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to retrieve session status',
      data: null,
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * POST /api/v1/sessions/:key/abort - 取消会话处理
 */
app.post('/:key/abort', async c => {
  const key = c.req.param('key');
  const concurrentSessionManager = (c.get('runtime') as any).concurrentSessionManager;

  try {
    if (concurrentSessionManager) {
      concurrentSessionManager.cancel(key);
    }

    const sessionStatusManager = getSessionStatusManager();
    sessionStatusManager.clear(key);

    return c.json({
      code: 200,
      message: 'Session aborted',
      data: { key },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to abort session',
      data: null,
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * GET /api/v1/sessions/:key/events - SSE 事件流
 *
 * 实时推送会话状态变更事件
 */
app.get('/:key/events', async c => {
  const key = c.req.param('key');
  const sessionStatusManager = getSessionStatusManager();

  // 设置 SSE 响应头
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return streamText(c, async stream => {
    try {
      // 发送初始状态
      const initialStatus = sessionStatusManager.get(key);
      await stream.write(`event: status\ndata: ${JSON.stringify({ key, status: initialStatus })}\n\n`);

      // 监听状态变更
      const handler = (event: { sessionKey: string; status: any }) => {
        if (event.sessionKey === key) {
          stream.write(`event: status\ndata: ${JSON.stringify({ key, status: event.status })}\n\n`);
        }
      };

      sessionStatusManager.on('status-change', handler);

      // 每 30 秒发送一次心跳
      const heartbeat = setInterval(() => {
        stream.write(': heartbeat\n\n');
      }, 30000);

      // 等待连接关闭
      const cleanup = () => {
        clearInterval(heartbeat);
        sessionStatusManager.off('status-change', handler);
      };

      // 监听连接关闭
      c.req.raw.on('close', cleanup);
      c.req.raw.on('error', cleanup);

      // 如果客户端断开，清理资源
      try {
        await new Promise((resolve) => {
          c.req.raw.on('close', resolve);
          c.req.raw.on('end', resolve);
        });
      } catch {
        // 忽略错误
      }
    } catch (error) {
      console.error('SSE error:', error);
    }
  });
});

export default app;
