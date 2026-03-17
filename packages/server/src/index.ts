/**
 * HTTP 服务器入口
 */
/// <reference types="bun-types" />

import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import type { Runtime } from '@nanobot/main';
import type { ChannelManager } from '@nanobot/channels';
import type { ServerContext } from './types';
import type { AppContext } from './types';
import routes from './routes';
import { logger } from '@nanobot/logger';
import path from 'path';
import { fileURLToPath } from 'url';

export interface CreateServerOptions {
  runtime: Runtime;
  bus: ServerContext['bus'];
  questionManager: ServerContext['questionManager'];
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
  const { runtime, bus, questionManager, channelManager, config, startTime, } = options;
  /** 当前文件路径往前跳两个目录（如 server/src -> server），再拼 web/dist 作为默认静态目录 */
  const twoUp = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const staticDir = path.join(twoUp, 'web', 'dist');
  console.log("🚀 ~ createServer ~ staticDir:", staticDir)
  const app = new Hono<AppContext>();

  app.use('*', async (c, next) => {
    c.set('runtime', runtime as AppContext['Variables']['runtime']);
    c.set('bus', bus as AppContext['Variables']['bus']);
    c.set('questionManager', questionManager as AppContext['Variables']['questionManager']);
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
    /**
     * 修复 SPA HTML5 history 模式的 404 问题
     */
    app.get('*', async (c) => {
      if (c.req.path.startsWith('/api/v1') || c.req.path === '/health') {
        return c.text('Not Found', 404);
      }
      const filePath = path.join(staticDir, 'index.html');
      const file = Bun.file(filePath);

      if (await file.exists()) {
        c.header('Content-Type', 'text/html; charset=utf-8');
        return c.body(await file.text());
      }

      return c.text('Not Found', 404);
    });

    logger.info(`Static files served from: ${staticDir}`);
  }

  const server = Bun.serve({
    fetch: app.fetch,
    port: config.server.port,
    hostname: config.server.host,
    idleTimeout: 255,
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
