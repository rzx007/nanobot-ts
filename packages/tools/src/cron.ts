/**
 * Cron 工具：定时提醒与周期任务，与 Bus/Agent 联动
 * PRD F9/Phase 4，参考 nanobot/agent/tools/cron.py
 */

import { Tool } from './base';
import type { CronService } from '@nanobot/cron';
import type { CronSchedule } from '@nanobot/shared';
import { RiskLevel } from './safety';

export interface CronToolContext {
  setContext(channel: string, chatId: string): void;
}

export class CronTool extends Tool {
  name = 'cron';

  description =
    'Manage scheduled cron jobs (add/list/remove). Only call this tool when user explicitly asks to create, delete, or view scheduled tasks. Do NOT call this tool for system notifications or reminders that are already being displayed.';

  riskLevel = RiskLevel.LOW;

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
   * kind → 任务类型：'at'=一次性任务, 'every'=固定间隔周期任务, 'cron'=Cron表达式周期任务
   * at_time → 一次性任务的执行时间：支持相对时间（"30s", "1m", "1h", "1d", "1w", "1M", "1y", "1y3m2d"）或绝对时间（ISO格式： "2026-03-05T10:30:00"）
   * every_seconds → 周期任务（kind='every'）：每 N 秒重复执行
   * cron_expr → 周期任务（kind='cron'）：Cron 表达式
   * tz → 周期任务（kind='cron'）：时区，如 'Asia/Shanghai'
   * job_id → 任务 ID（用于删除）
   */
  parameters = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'list', 'remove'],
        description:
          'Action to perform: add=new job, list=view all jobs, remove=delete job. Only call when user explicitly requests to manage cron jobs.',
      },
      message: {
        type: 'string',
        description: 'Reminder message (for add)',
      },
      kind: {
        type: 'string',
        enum: ['at', 'every', 'cron'],
        description: 'Task type: "at"=one-time, "every"=repeat interval, "cron"=cron expression',
      },
      at_time: {
        type: 'string',
        description:
          'Execution time for "at" tasks. Supports relative time ("30s", "1m", "1h", "1d", "1w", "1M", "1y", "1y3m2d") or absolute datetime (ISO format: "2026-03-05T10:30:00")',
      },
      every_seconds: {
        type: 'integer',
        description:
          'Interval for "every" tasks. Repeat every N seconds indefinitely (recurring task)',
      },
      cron_expr: {
        type: 'string',
        description:
          "Cron expression for 'cron' tasks. e.g. '0 9 * * *' (requires croner dependency)",
      },
      tz: {
        type: 'string',
        description: "IANA timezone for 'cron' tasks. e.g. 'Asia/Shanghai'",
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
    kind?: string;
    at_time?: string;
    every_seconds?: number;
    cron_expr?: string;
    tz?: string;
    job_id?: string;
  }): Promise<string> {
    const { action } = params;
    if (action === 'add') return this.addJob(params);
    if (action === 'list') return this.listJobs();
    if (action === 'remove') return this.removeJob(params.job_id);
    return `Unknown action: ${action}`;
  }

  private parseRelativeTime(time: string): number | null {
    const timeStr = time;
    const regex = /(\d+)([smhdwMy])/g;
    let match: RegExpExecArray | null;
    const date = new Date();

    while ((match = regex.exec(timeStr)) !== null) {
      const value = parseInt(match[1] ?? '0', 10);
      const unit = match[2];

      switch (unit) {
        case 's':
          date.setSeconds(date.getSeconds() + value);
          break;
        case 'm':
          date.setMinutes(date.getMinutes() + value);
          break;
        case 'h':
          date.setHours(date.getHours() + value);
          break;
        case 'd':
          date.setDate(date.getDate() + value);
          break;
        case 'w':
          date.setDate(date.getDate() + value * 7);
          break;
        case 'M':
          date.setMonth(date.getMonth() + value);
          break;
        case 'y':
          date.setFullYear(date.getFullYear() + value);
          break;
      }
    }

    const timeMs = date.getTime();
    if (timeMs <= Date.now()) {
      return null;
    }
    return timeMs;
  }

  private parseAtTime(atTime: string): number | null {
    const relativeTimeMs = this.parseRelativeTime(atTime);
    if (relativeTimeMs !== null) {
      return relativeTimeMs;
    }

    const absoluteTimeMs = new Date(atTime).getTime();
    if (Number.isNaN(absoluteTimeMs)) {
      return null;
    }
    return absoluteTimeMs;
  }

  private async addJob(params: {
    message?: string;
    kind?: string;
    at_time?: string;
    every_seconds?: number;
    cron_expr?: string;
    tz?: string;
  }): Promise<string> {
    const { message, kind, at_time, every_seconds, cron_expr, tz } = params;
    if (!message?.trim()) {
      return 'Error: message is required for add';
    }
    if (!this.channel || !this.chatId) {
      return 'Error: no session context (channel/chat_id)';
    }
    if (!kind) {
      return 'Error: kind is required for add (must be "at", "every", or "cron")';
    }
    if (tz && kind !== 'cron') {
      return 'Error: tz can only be used with kind="cron"';
    }

    let schedule: CronSchedule;
    let deleteAfterRun = false;

    if (kind === 'at') {
      if (!at_time) {
        return 'Error: at_time is required for kind="at"';
      }
      const atMs = this.parseAtTime(at_time);
      if (atMs === null) {
        return `Error: invalid at_time '${at_time}'. Use relative time ("30s", "1m", "1h", "1d", "1w", "1M", "1y", "1y3m2d") or absolute datetime (ISO format: "2026-03-05T10:30:00")`;
      }
      schedule = { kind: 'at', atMs };
      deleteAfterRun = true;
    } else if (kind === 'every') {
      if (every_seconds == null || every_seconds <= 0) {
        return 'Error: every_seconds is required for kind="every" and must be > 0';
      }
      schedule = { kind: 'every', everyMs: every_seconds * 1000 };
    } else if (kind === 'cron') {
      if (!cron_expr) {
        return 'Error: cron_expr is required for kind="cron"';
      }
      schedule = { kind: 'cron', expr: cron_expr, tz: tz ?? null };
    } else {
      return `Error: invalid kind '${kind}'. Must be "at", "every", or "cron"`;
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
    const lines = jobs.map(j => `- ${j.name} (id: ${j.id}, ${j.schedule.kind})`);
    return 'Scheduled jobs:\n' + lines.join('\n');
  }

  private async removeJob(jobId: string | undefined): Promise<string> {
    if (!jobId) return 'Error: job_id is required for remove';
    const removed = await this.cronService.removeJob(jobId);
    return removed ? `Removed job ${jobId}` : `Job ${jobId} not found`;
  }
}
