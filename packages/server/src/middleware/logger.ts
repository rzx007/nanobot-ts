/**
 * 请求日志中间件
 */

import type { Context, Next } from 'hono';

export const loggerMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();
  const traceId = crypto.randomUUID();

  c.set('traceId', traceId);

  console.log(`[${traceId}] ${c.req.method} ${c.req.url}`);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  console.log(`[${traceId}] ${c.req.method} ${c.req.url} ${status} ${duration}ms`);
};
