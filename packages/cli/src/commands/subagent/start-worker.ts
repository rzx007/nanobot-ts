/**
 * Subagent Worker 进程启动器
 *
 * 在 isolated 模式下作为独立进程运行，处理 subagent 任务
 */

import { Worker, Queue } from 'bunqueue/client';
import { SubagentWorker } from '@nanobot/main';
import { logger } from '@nanobot/logger';
import { loadConfig } from '@nanobot/shared';
import { LLMProviderImpl } from '@nanobot/providers';
import { ToolRegistry } from '@nanobot/main';
import { expandHome } from '@nanobot/utils';
import {
  ReadFileTool,
  WriteFileTool,
  CreateFileTool,
  EditFileTool,
  DeleteFileTool,
  ListDirTool,
  ExecTool,
  WebSearchTool,
  WebFetchTool,
} from '@nanobot/main';

async function main() {
  const workerId = process.argv[2];
  const dataPath = process.env.DATA_PATH ?? expandHome('~/.nanobot/data/bunqueue.db');

  logger.info({ workerId, dataPath }, 'Starting subagent worker process');

  try {
    const configPath = process.env.NANOBOT_CONFIG_PATH ?? expandHome('~/.nanobot/config.json');
    logger.info({ configPath }, 'Loading configuration for subagent worker');

    const config = await loadConfig(configPath);
    if (!config) {
      logger.error('Failed to load configuration');
      process.exit(1);
    }

    const provider = new LLMProviderImpl(config);
    const tools = new ToolRegistry();
    const workspace = expandHome(config.agents.defaults.workspace);

    tools.register(new ReadFileTool(config));
    tools.register(new WriteFileTool(config));
    tools.register(new CreateFileTool(config));
    tools.register(new EditFileTool(config));
    tools.register(new DeleteFileTool(config));
    tools.register(new ListDirTool(config));
    tools.register(new ExecTool(config));
    tools.register(new WebSearchTool(config));
    tools.register(new WebFetchTool());

    logger.info('Registered tools for subagent worker');

    // 创建结果队列，用于向主进程发送结果
    const resultQueue = new Queue<import('@nanobot/main').SubagentResult>(
      'subagent-results',
      {
        embedded: true,
      },
    );

    const subagentWorker = new SubagentWorker({
      config,
      provider,
      tools,
      workspace,
      maxIterations: config.subagent?.maxIterations ?? 15,
      timeout: config.subagent?.timeout ?? 300,
    });

    logger.info('Connected to task queue');

    const worker = new Worker(
      'subagent-tasks',
      async job => {
        logger.info({ jobId: job.id }, 'Processing subagent job');

        const result = await subagentWorker.execute(job.data as any);

        logger.info({ jobId: job.id, status: result.status }, 'Job completed');

        // 发送结果到结果队列，供主进程处理
        await resultQueue.add(result.taskId, result);

        return result as any;
      },
      {
        embedded: true,
        concurrency: 1,
      },
    );

    logger.info('Subagent worker ready');

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down worker');
      await worker.close();
      await resultQueue.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down worker');
      await worker.close();
      await resultQueue.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start worker');
    process.exit(1);
  }
}

main().catch(err => {
  logger.error({ err }, 'Worker process failed to start');
  process.exit(1);
});
