/**
 * API Key 认证中间件
 */

import type { Context, Next } from 'hono';

export const authMiddleware = async (c: Context, next: Next): Promise<void> => {
  const header = c.req.header('Authorization');

  if (!header?.startsWith('Bearer ')) {
    const { UnauthorizedError } = await import('../types');
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const apiKey = header.slice(7);
  const validKey = c.get('config').server.apiKey;

  if (apiKey !== validKey) {
    const { UnauthorizedError } = await import('../types');
    throw new UnauthorizedError('Invalid API key');
  }

  await next();
};
