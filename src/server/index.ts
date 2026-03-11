/**
 * HTTP 服务器入口
 */

import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import type { Runtime } from '@/core';
import type { ChannelManager } from '@/channels';
import type { ServerContext } from './types';
import type { AppContext } from './types';
import routes from './routes';
import { logger } from '@/utils/logger';

export interface CreateServerOptions {
  runtime: Runtime;
  bus: ServerContext['bus'];
  channelManager: ChannelManager;
  config: ServerContext['config'];
  startTime: Date;
  staticDir?: string;
}

export interface ServerInstance {
  app: Hono<AppContext>;
  close: () => Promise<void>;
  server: ReturnType<typeof Bun.serve>;
}

export function createServer(options: CreateServerOptions): ServerInstance {
  const { runtime, bus, channelManager, config, startTime, staticDir } = options;

  const app = new Hono<AppContext>();

  app.use('*', async (c, next) => {
    c.set('runtime', runtime as AppContext['Variables']['runtime']);
    c.set('bus', bus as AppContext['Variables']['bus']);
    c.set('channelManager', channelManager as AppContext['Variables']['channelManager']);
    c.set('config', config as AppContext['Variables']['config']);
    c.set('startTime', startTime as AppContext['Variables']['startTime']);
    await next();
  });

  app.route('/', routes);

  if (staticDir) {
    app.use('/static/*', serveStatic({ root: staticDir }));
    app.use(
      '/*',
      serveStatic({
        root: staticDir,
        onFound: (_path, c) => {
          c.header('Cache-Control', 'public, max-age=3600');
        },
      }),
    );

    logger.info(`Static files served from: ${staticDir}`);
  }

  const server = Bun.serve({
    fetch: app.fetch,
    port: config.server.port,
    hostname: config.server.host,
  });

  logger.info(
    `🌏 HTTP server started on http://${config.server.host}:${config.server.port}?apiKey=${config.server.apiKey}`,
  );

  return {
    app,
    server,
    close: async () => {
      logger.info('Shutting down HTTP server...');
      await server.stop();
      await new Promise(resolve => setTimeout(resolve, 100));
    },
  };
}

export type {
  AppContext,
  ServerContext,
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InternalError,
  SSEEvent,
} from './types';
export { default as routes } from './routes';
export { authMiddleware } from './middleware/auth';
export { errorMiddleware } from './middleware/error';
export { loggerMiddleware } from './middleware/logger';
export { streamSSE, setupStreamListener, type SSEStream } from './utils/sse';
