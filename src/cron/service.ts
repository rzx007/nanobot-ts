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

  private getNextWakeMs(): number | null {
    if (!this.store) return null;
    const times = this.store.jobs
      .filter((j) => j.enabled && j.state.nextRunAtMs != null)
      .map((j) => j.state.nextRunAtMs!);
    return times.length > 0 ? Math.min(...times) : null;
  }

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

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async listJobs(includeDisabled = false): Promise<CronJob[]> {
    const store = await this.loadStore();
    const list = includeDisabled ? store.jobs : store.jobs.filter((j) => j.enabled);
    return list.sort((a, b) => (a.state.nextRunAtMs ?? Infinity) - (b.state.nextRunAtMs ?? Infinity));
  }

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
