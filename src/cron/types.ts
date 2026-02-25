/**
 * Cron 定时任务类型定义
 */

export type CronScheduleKind = 'at' | 'every' | 'cron';

export interface CronSchedule {
  kind: CronScheduleKind;
  atMs?: number | null;
  everyMs?: number | null;
  expr?: string | null;
  tz?: string | null;
}

export interface CronPayload {
  kind: 'system_event' | 'agent_turn';
  message: string;
  deliver: boolean;
  channel: string | null;
  to: string | null;
}

export interface CronJobState {
  nextRunAtMs: number | null;
  lastRunAtMs: number | null;
  lastStatus: 'ok' | 'error' | 'skipped' | null;
  lastError: string | null;
}

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  state: CronJobState;
  createdAtMs: number;
  updatedAtMs: number;
  deleteAfterRun: boolean;
}

export interface CronStore {
  version: number;
  jobs: CronJob[];
}
