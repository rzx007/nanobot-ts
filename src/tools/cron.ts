/**
 * Cron 工具：定时提醒与周期任务，与 Bus/Agent 联动
 * PRD F9/Phase 4，参考 nanobot/agent/tools/cron.py
 */

import { Tool } from './base';
import type { CronService } from '../cron/service';
import type { CronSchedule } from '../cron/types';

export interface CronToolContext {
  setContext(channel: string, chatId: string): void;
}

export class CronTool extends Tool {
  name = 'cron';

  description = 'Schedule reminders and recurring tasks. Actions: add, list, remove.';

  private channel = 'cli';
  private chatId = 'direct';

  constructor(private readonly cronService: CronService) {
    super();
  }

  setContext(channel: string, chatId: string): void {
    this.channel = channel;
    this.chatId = chatId;
  }

  /**
   * 
   * every_seconds → 	间隔执行，每 N 秒触发一次（周期任务）
   * cron_expr → Cron 表达式执行（可搭配 tz 设置时区）
   * at → 一次性执行时间，ISO 格式如 2026-02-12T10:30:00
   * job_id → 任务 ID（用于删除）
   */
  parameters = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'list', 'remove'],
        description: 'Action to perform',
      },
      message: {
        type: 'string',
        description: 'Reminder message (for add)',
      },
      every_seconds: {
        type: 'integer',
        description: 'Interval in seconds (for recurring tasks)',
      },
      cron_expr: {
        type: 'string',
        description: "Cron expression e.g. '0 9 * * *' (requires croner dependency)",
      },
      tz: {
        type: 'string',
        description: "IANA timezone for cron expressions e.g. 'Asia/Shanghai'",
      },
      at: {
        type: 'string',
        description: "ISO datetime for one-time execution e.g. '2026-02-12T10:30:00'",
      },
      job_id: {
        type: 'string',
        description: 'Job ID (for remove)',
      },
    },
    required: ['action'],
  };

  async execute(params: {
    action: string;
    message?: string;
    every_seconds?: number;
    cron_expr?: string;
    tz?: string;
    at?: string;
    job_id?: string;
  }): Promise<string> {
    const { action } = params;
    if (action === 'add') return this.addJob(params);
    if (action === 'list') return this.listJobs();
    if (action === 'remove') return this.removeJob(params.job_id);
    return `Unknown action: ${action}`;
  }

  private async addJob(params: {
    message?: string;
    every_seconds?: number;
    cron_expr?: string;
    tz?: string;
    at?: string;
  }): Promise<string> {
    const { message, every_seconds, cron_expr, tz, at } = params;
    if (!message?.trim()) {
      return 'Error: message is required for add';
    }
    if (!this.channel || !this.chatId) {
      return 'Error: no session context (channel/chat_id)';
    }
    if (tz && !cron_expr) {
      return 'Error: tz can only be used with cron_expr';
    }

    let schedule: CronSchedule;
    let deleteAfterRun = false;

    if (every_seconds != null && every_seconds > 0) {
      schedule = { kind: 'every', everyMs: every_seconds * 1000 };
    } else if (cron_expr) {
      schedule = { kind: 'cron', expr: cron_expr, tz: tz ?? null };
    } else if (at) {
      const atMs = new Date(at).getTime();
      if (Number.isNaN(atMs)) {
        return `Error: invalid at datetime '${at}'`;
      }
      schedule = { kind: 'at', atMs };
      deleteAfterRun = true;
    } else {
      return 'Error: one of every_seconds, cron_expr, or at is required';
    }

    const job = await this.cronService.addJob({
      name: message.slice(0, 30),
      schedule,
      message,
      deliver: true,
      channel: this.channel,
      to: this.chatId,
      deleteAfterRun,
    });
    return `Created job '${job.name}' (id: ${job.id})`;
  }

  private async listJobs(): Promise<string> {
    const jobs = await this.cronService.listJobs();
    if (jobs.length === 0) return 'No scheduled jobs.';
    const lines = jobs.map(
      (j) => `- ${j.name} (id: ${j.id}, ${j.schedule.kind})`
    );
    return 'Scheduled jobs:\n' + lines.join('\n');
  }

  private async removeJob(jobId: string | undefined): Promise<string> {
    if (!jobId) return 'Error: job_id is required for remove';
    const removed = await this.cronService.removeJob(jobId);
    return removed ? `Removed job ${jobId}` : `Job ${jobId} not found`;
  }
}
