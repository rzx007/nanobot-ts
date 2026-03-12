import { Hono } from 'hono';
import type { AppContext } from '../types';
import { getLogs } from '@nanobot/logger';

const logsRouter = new Hono<AppContext>();

logsRouter.get('/logs', async (c) => {
  try {
    const logs = await getLogs();
    return c.json(logs);
  } catch (error) {
    return c.json({ error: 'Failed to fetch logs' }, 500);
  }
});

logsRouter.get('/logs/levels', async (c) => {
  try {
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    return c.json(levels);
  } catch (error) {
    return c.json({ error: 'Failed to fetch log levels' }, 500);
  }
});

export default logsRouter;