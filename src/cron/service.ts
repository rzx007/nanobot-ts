/**
 * Cron 服务：持久化定时任务，到期触发 on_job 回调（与 Bus/Agent 联动）
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import type { CronJob, CronSchedule, CronStore } from './types';

function nowMs(): number {
  return Date.now();
}

function computeNextRunSync(schedule: CronSchedule, now: number): number | null {
  if (schedule.kind === 'at') {
    const at = schedule.atMs ?? 0;
    return at > now ? at : null;
  }
  if (schedule.kind === 'every') {
    const every = schedule.everyMs ?? 0;
    return every > 0 ? now + every : null;
  }
  if (schedule.kind === 'cron') {
    return null;
  }
  return null;
}

async function computeNextRun(schedule: CronSchedule, now: number): Promise<number | null> {
  if (schedule.kind === 'at' || schedule.kind === 'every') {
    return computeNextRunSync(schedule, now);
  }
  if (schedule.kind === 'cron' && schedule.expr) {
    try {
      const { Cron } = await import('croner');
      const opts: { timezone?: string } = {};
      if (schedule.tz != null && schedule.tz !== '') opts.timezone = schedule.tz;
      const cron = new Cron(schedule.expr, opts);
      const next = cron.nextRun();
      return next ? next.getTime() : null;
    } catch {
      return null;
    }
  }
  return null;
}

export type OnJobCallback = (job: CronJob) => Promise<string | null>;

export interface CronServiceOptions {
  storePath: string;
  onJob?: OnJobCallback;
}

export class CronService {
  private storePath: string;
  private onJob: OnJobCallback | undefined;
  private store: CronStore | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(options: CronServiceOptions) {
    this.storePath = options.storePath;
    this.onJob = options.onJob;
  }

  /**
   * 加载任务存储，如果已加载则直接返回缓存的存储
   */
  private async loadStore(): Promise<CronStore> {
    if (this.store) return this.store;
    try {
      const raw = await fs.readFile(this.storePath, 'utf-8');
      const data = JSON.parse(raw) as { version?: number; jobs?: unknown[] };
      const jobs: CronJob[] = (data.jobs ?? []).map((j: any) => ({
        id: j.id,
        name: j.name,
        enabled: j.enabled !== false,
        schedule: j.schedule,
        payload: j.payload ?? { kind: 'agent_turn', message: '', deliver: false, channel: null, to: null },
        state: j.state ?? { nextRunAtMs: null, lastRunAtMs: null, lastStatus: null, lastError: null },
        createdAtMs: j.createdAtMs ?? 0,
        updatedAtMs: j.updatedAtMs ?? 0,
        deleteAfterRun: j.deleteAfterRun === true,
      }));
      this.store = { version: data.version ?? 1, jobs };
    } catch {
      this.store = { version: 1, jobs: [] };
    }
    return this.store;
  }

  /**
   * 保存当前任务存储到文件
   */
  private async saveStore(): Promise<void> {
    if (!this.store) return;
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    const data = {
      version: this.store.version,
      jobs: this.store.jobs.map((j) => ({
        id: j.id,
        name: j.name,
        enabled: j.enabled,
        schedule: j.schedule,
        payload: j.payload,
        state: j.state,
        createdAtMs: j.createdAtMs,
        updatedAtMs: j.updatedAtMs,
        deleteAfterRun: j.deleteAfterRun,
      })),
    };
    await fs.writeFile(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 获取下一次唤醒的时间戳
   * @returns 最近的任务执行时间戳或null
   */
  private getNextWakeMs(): number | null {
    if (!this.store) return null;
    const times = this.store.jobs
      .filter((j) => j.enabled && j.state.nextRunAtMs != null)
      .map((j) => j.state.nextRunAtMs!);
    return times.length > 0 ? Math.min(...times) : null;
  }

  /**
   * 设置定时器以在下一个任务执行时间唤醒
   */
  private armTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const next = this.getNextWakeMs();
    if (next == null || !this.running) return;
    const delay = Math.max(0, next - nowMs());
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onTimer().catch((err) => logger.error({ err }, 'Cron timer error'));
    }, delay);
  }

  /**
   * 定时器回调函数，检查并执行到期的任务
   */
  private async onTimer(): Promise<void> {
    const store = await this.loadStore();
    const now = nowMs();
    const due = store.jobs.filter(
      (j) => j.enabled && j.state.nextRunAtMs != null && now >= j.state.nextRunAtMs!
    );
    for (const job of due) {
      await this.executeJob(job);
    }
    await this.saveStore();
    this.armTimer();
  }

  /**
   * 执行指定的定时任务
   * @param job 需要执行的任务
   */
  private async executeJob(job: CronJob): Promise<void> {
    const start = nowMs();
    logger.info({ name: job.name, id: job.id }, 'Cron: executing job');
    try {
      if (this.onJob) {
        await this.onJob(job);
      }
      job.state.lastStatus = 'ok';
      job.state.lastError = null;
    } catch (err) {
      job.state.lastStatus = 'error';
      job.state.lastError = err instanceof Error ? err.message : String(err);
      logger.error({ err, name: job.name }, 'Cron: job failed');
    }
    job.state.lastRunAtMs = start;
    job.updatedAtMs = nowMs();

    if (job.schedule.kind === 'at') {
      if (job.deleteAfterRun && this.store) {
        this.store.jobs = this.store.jobs.filter((j) => j.id !== job.id);
      } else {
        job.enabled = false;
        job.state.nextRunAtMs = null;
      }
    } else {
      job.state.nextRunAtMs = await computeNextRun(job.schedule, nowMs());
    }
  }

  /**
   * 启动 Cron 服务
   * 加载存储、计算任务下次运行时间并设置定时器
   */
  async start(): Promise<void> {
    this.running = true;
    await this.loadStore();
    for (const job of this.store!.jobs) {
      if (job.enabled && job.state.nextRunAtMs == null) {
        job.state.nextRunAtMs = await computeNextRun(job.schedule, nowMs());
      }
    }
    await this.saveStore();
    this.armTimer();
    logger.info({ count: this.store!.jobs.length }, 'Cron service started');
  }

  /**
   * 停止 Cron 服务
   * 清除定时器并重置运行状态
   */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 列出所有定时任务
   * @param includeDisabled 是否包含已禁用的任务
   * @returns 任务列表，按下次执行时间排序
   */
  async listJobs(includeDisabled = false): Promise<CronJob[]> {
    const store = await this.loadStore();
    const list = includeDisabled ? store.jobs : store.jobs.filter((j) => j.enabled);
    return list.sort((a, b) => (a.state.nextRunAtMs ?? Infinity) - (b.state.nextRunAtMs ?? Infinity));
  }

  /**
   * 添加新的定时任务
   * @param opts 任务选项，包括名称、调度规则、消息内容等
   * @returns 创建的任务对象
   */
  async addJob(opts: {
    name: string;
    schedule: CronSchedule;
    message: string;
    deliver: boolean;
    channel: string | null;
    to: string | null;
    deleteAfterRun: boolean;
  }): Promise<CronJob> {
    const store = await this.loadStore();
    const id = Math.random().toString(36).slice(2, 10);
    const now = nowMs();
    const nextRunAtMs = await computeNextRun(opts.schedule, now);
    const job: CronJob = {
      id,
      name: opts.name,
      enabled: true,
      schedule: opts.schedule,
      payload: {
        kind: 'agent_turn',
        message: opts.message,
        deliver: opts.deliver,
        channel: opts.channel,
        to: opts.to,
      },
      state: {
        nextRunAtMs: nextRunAtMs,
        lastRunAtMs: null,
        lastStatus: null,
        lastError: null,
      },
      createdAtMs: now,
      updatedAtMs: now,
      deleteAfterRun: opts.deleteAfterRun,
    };
    store.jobs.push(job);
    await this.saveStore();
    this.armTimer();
    logger.info({ name: job.name, id: job.id }, 'Cron: added job');
    return job;
  }

  /**
   * 删除指定 ID 的定时任务
   * @param jobId 需要删除的任务 ID
   * @returns 是否成功删除
   */
  async removeJob(jobId: string): Promise<boolean> {
    const store = await this.loadStore();
    const before = store.jobs.length;
    store.jobs = store.jobs.filter((j) => j.id !== jobId);
    const removed = store.jobs.length < before;
    if (removed) {
      await this.saveStore();
      this.armTimer();
    }
    return removed;
  }
}

// 添加任务 (addJob)
//     ↓
// computeNextRun() 计算下次执行时间
//     ↓
// 保存到 cron.json
//     ↓
// armTimer() 设置 setTimeout(delay)
//     ↓
// 到期 → onTimer() → executeJob()
//     ↓
// 执行 onJob 回调 (publishInbound)
//     ↓
// 根据 schedule.kind 处理：
//   at → 删除/禁用
//   every → 重新计算 now + everyMs
//   cron → croner.nextRun()
//     ↓
// 重新 armTimer()
