/**
 * 路由聚合
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext } from '../types';
import messagesRouter from './messages';
import agentRouter from './agent';
import configRouter from './config';
import channelsRouter from './channels';
import healthRouter from './health';
import logsRouter from './logs';
import { authMiddleware } from '../middleware/auth';
import { errorMiddleware } from '../middleware/error';
import { loggerMiddleware } from '../middleware/logger';

const app = new Hono<AppContext>();

app.use('*', errorMiddleware);
app.use('*', loggerMiddleware);
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Type'],
    credentials: false,
    maxAge: 86400,
  }),
);

app.route('/', healthRouter);
/**
 * auth 中间件
 */
// app.use('/api/v1/*', authMiddleware);

app.route('/api/v1', messagesRouter);
app.route('/api/v1', agentRouter);
app.route('/api/v1', configRouter);
app.route('/api/v1', channelsRouter);
app.route('/api/v1', logsRouter);

export default app;
