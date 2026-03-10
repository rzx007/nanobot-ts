/**
 * Subagent 管理命令
 *
 * 提供命令行接口来管理子代理任务
 */

import { Command } from 'commander';
import { SubagentManager } from '@nanobot/main';
import { loadConfig } from '@nanobot/shared';
import { TaskStatus } from '@nanobot/main';

export function createSubagentManageCommand(): Command {
  const cmd = new Command('subagent').description('管理子代理任务');

  // 列出所有任务
  cmd
    .command('list')
    .description('列出所有子代理任务')
    .action(async () => {
      try {
        const config = await loadConfig();
        if (!config) {
          console.error('❌ Failed to load configuration');
          process.exit(1);
        }

        const manager = new SubagentManager({
          config,
          bus: null as any, // 不需要 bus
          provider: null as any, // 不需要 provider
          tools: null as any, // 不需要 tools
          workspace: config.agents.defaults.workspace,
        });

        await manager.initialize();

        const statuses = manager.getAllTaskStatuses();

        if (statuses.size === 0) {
          console.log('📋 没有活动的子代理任务');
          process.exit(0);
        }

        console.log('\n📋 子代理任务列表');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(
          `${'任务 ID'.padEnd(20)} ${'状态'.padEnd(15)} ${'创建时间'.padEnd(25)} ${'持续时间'.padEnd(20)}`,
        );
        console.log(
          '─────────────────────────────────────────────────────────────────────────────────────',
        );

        for (const [taskId, status] of statuses.entries()) {
          const metrics = manager.getTaskMetrics(taskId);
          const duration = calculateDuration(metrics);
          const statusText = formatTaskStatus(status);

          console.log(
            `${taskId.padEnd(20)} ${statusText.padEnd(15)} ${(
              metrics?.createdAt?.toLocaleString('zh-CN') ?? 'N/A'
            ).padEnd(25)} ${duration.padEnd(20)}`,
          );
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`\n总计: ${statuses.size} 个任务`);

        await manager.shutdown();
        process.exit(0);
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // 取消任务
  cmd
    .command('cancel <taskId>')
    .description('取消指定的子代理任务')
    .action(async (taskId: string) => {
      try {
        const config = await loadConfig();
        if (!config) {
          console.error('❌ Failed to load configuration');
          process.exit(1);
        }

        const manager = new SubagentManager({
          config,
          bus: null as any,
          provider: null as any,
          tools: null as any,
          workspace: config.agents.defaults.workspace,
        });

        await manager.initialize();

        const result = await manager.cancel(taskId);
        console.log(result);

        await manager.shutdown();
        process.exit(0);
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // 查看任务详情
  cmd
    .command('show <taskId>')
    .description('查看指定任务的详细信息')
    .action(async (taskId: string) => {
      try {
        const config = await loadConfig();
        if (!config) {
          console.error('❌ Failed to load configuration');
          process.exit(1);
        }

        const manager = new SubagentManager({
          config,
          bus: null as any,
          provider: null as any,
          tools: null as any,
          workspace: config.agents.defaults.workspace,
        });

        await manager.initialize();

        const status = manager.getTaskStatus(taskId);
        const metrics = manager.getTaskMetrics(taskId);

        if (!status) {
          console.log(`❌ 未找到任务: ${taskId}`);
          process.exit(1);
        }

        console.log(`\n📋 任务详情: ${taskId}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`状态: ${formatTaskStatus(status)}`);
        console.log(`创建时间: ${metrics?.createdAt?.toLocaleString('zh-CN') ?? 'N/A'}`);
        console.log(`开始时间: ${metrics?.startedAt?.toLocaleString('zh-CN') ?? 'N/A'}`);
        console.log(`完成时间: ${metrics?.completedAt?.toLocaleString('zh-CN') ?? 'N/A'}`);
        console.log(`持续时间: ${calculateDuration(metrics)}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        await manager.shutdown();
        process.exit(0);
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // 清理子代理数据目录
  cmd
    .command('clear-data')
    .description('清理子代理数据目录 (~/.nanobot/data/)')
    .option('--force', '强制删除，无需确认')
    .action(async (opts: { force?: boolean }) => {
      try {
        const { existsSync, rmSync, readdirSync, statSync } = await import('fs');
        const { join } = await import('node:path');
        const { homedir } = await import('os');
        const dataDir = join(homedir(), '.nanobot', 'data');

        if (!existsSync(dataDir)) {
          console.log('✅ 数据目录不存在');
          return;
        }

        const files = readdirSync(dataDir);

        if (files.length === 0) {
          console.log('✅ 数据目录为空');
          return;
        }

        const fileSize = files.reduce((total, file) => {
          const filePath = join(dataDir, file);
          const stats = statSync(filePath);
          return total + stats.size;
        }, 0);
        const sizeMB = (fileSize / 1024 / 1024).toFixed(2);

        console.log(`\n📋 数据目录: ${dataDir}`);
        console.log(`📁 文件数量: ${files.length}`);
        console.log(`💾 总大小: ${sizeMB} MB`);
        console.log(`\n📂 包含文件:`);

        for (const file of files) {
          const filePath = join(dataDir, file);
          const stats = statSync(filePath);
          const sizeKB = (stats.size / 1024).toFixed(2);
          console.log(`  - ${file} (${sizeKB} KB)`);
        }
        console.log();

        if (!opts.force) {
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          const answer = await new Promise<string>(resolve => {
            rl.question(`⚠️  确定要删除以上 ${files.length} 个文件吗？(yes/no): `, input => {
              rl.close();
              resolve(input.trim().toLowerCase());
            });
          });

          if (answer !== 'yes' && answer !== 'y') {
            console.log('❌ 操作已取消');
            return;
          }
        }

        rmSync(dataDir, { recursive: true, force: true });
        console.log(`🧹 已删除 ${files.length} 个文件 (${sizeMB} MB)`);
        console.log('✅ 清理完成');
      } catch (error) {
        console.error(`❌ 清理失败: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // 查看运行中的任务数量
  cmd
    .command('status')
    .description('查看子代理状态')
    .action(async () => {
      try {
        const config = await loadConfig();
        if (!config) {
          console.error('❌ Failed to load configuration');
          process.exit(1);
        }

        const manager = new SubagentManager({
          config,
          bus: null as any,
          provider: null as any,
          tools: null as any,
          workspace: config.agents.defaults.workspace,
        });

        await manager.initialize();

        const runningCount = await manager.getRunningCount();
        const mode = manager.getMode();
        const statuses = manager.getAllTaskStatuses();

        console.log(`\n🤖 子代理状态`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`运行模式: ${mode}`);
        console.log(`运行中任务数: ${runningCount}`);
        console.log(`总任务数: ${statuses.size}`);

        // 按状态分组统计
        const statusCount = new Map<TaskStatus, number>();
        for (const status of statuses.values()) {
          statusCount.set(status, (statusCount.get(status) ?? 0) + 1);
        }

        console.log(`\n任务状态分布:`);
        for (const [status, count] of statusCount.entries()) {
          console.log(`  - ${formatTaskStatus(status)}: ${count}`);
        }
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        await manager.shutdown();
        process.exit(0);
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * 格式化任务状态
 */
function formatTaskStatus(status: TaskStatus): string {
  const statusMap: Record<TaskStatus, string> = {
    [TaskStatus.PENDING]: '⏳ 待处理',
    [TaskStatus.RUNNING]: '🔄 运行中',
    [TaskStatus.COMPLETED]: '✅ 已完成',
    [TaskStatus.FAILED]: '❌ 失败',
    [TaskStatus.CANCELLED]: '⏹️ 已取消',
    [TaskStatus.TIMEOUT]: '⏱️ 超时',
  };
  return statusMap[status] ?? status;
}

/**
 * 计算任务持续时间
 */
function calculateDuration(metrics?: {
  createdAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}): string {
  if (!metrics?.createdAt) {
    return 'N/A';
  }

  const end = metrics.completedAt ?? metrics.startedAt ?? new Date();
  const duration = end.getTime() - metrics.createdAt.getTime();

  if (duration < 1000) {
    return `${Math.floor(duration)}ms`;
  } else if (duration < 60000) {
    return `${Math.floor(duration / 1000)}s`;
  } else if (duration < 3600000) {
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
  } else {
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
}
