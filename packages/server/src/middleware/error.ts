/**
 * 统一错误处理中间件
 */

import type { Context, Next } from 'hono';
import type { ApiError } from '../types';

export const errorMiddleware = async (c: Context, next: Next): Promise<Response | void> => {
  try {
    await next();
  } catch (err) {
    console.error('[Server Error]', err);

    if (err instanceof Error && 'code' in err && 'message' in err) {
      const apiErr = err as ApiError;
      return c.json(
        {
          code: apiErr.code,
          message: apiErr.message,
          details: apiErr.details,
        },
        apiErr.code as 400 | 401 | 403 | 404 | 500,
      );
    }

    return c.json(
      {
        code: 500,
        message: 'Internal server error',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
};
