/**
 * Cron 定时任务 Schema 定义
 *
 * 使用 Zod 定义结构，z.infer 导出 TS 类型
 */

import { z } from 'zod';

/** 调度类型 */
export const CronScheduleKindSchema = z.enum(['at', 'every', 'cron']);
export type CronScheduleKind = z.infer<typeof CronScheduleKindSchema>;

/** 调度配置 Schema */
export const CronScheduleSchema = z.object({
  kind: CronScheduleKindSchema,
  atMs: z.number().nullable().optional(),
  everyMs: z.number().nullable().optional(),
  expr: z.string().nullable().optional(),
  tz: z.string().nullable().optional(),
});

/** 触发载荷 Schema */
export const CronPayloadSchema = z.object({
  kind: z.enum(['system_event', 'agent_turn']),
  message: z.string(),
  deliver: z.boolean(),
  channel: z.string().nullable(),
  to: z.string().nullable(),
});


/** 任务运行状态 Schema */
export const CronJobStateSchema = z.object({
  nextRunAtMs: z.number().nullable(),
  lastRunAtMs: z.number().nullable(),
  lastStatus: z.enum(['ok', 'error', 'skipped']).nullable(),
  lastError: z.string().nullable(),
});

/** 单个定时任务 Schema */
export const CronJobSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  schedule: CronScheduleSchema,
  payload: CronPayloadSchema,
  state: CronJobStateSchema,
  createdAtMs: z.number(),
  updatedAtMs: z.number(),
  deleteAfterRun: z.boolean(),
});

/** 定时任务存储 Schema */
export const CronStoreSchema = z.object({
  version: z.number(),
  jobs: z.array(CronJobSchema),
});


export type CronSchedule = z.infer<typeof CronScheduleSchema>;
export type CronPayload = z.infer<typeof CronPayloadSchema>;
export type CronJobState = z.infer<typeof CronJobStateSchema>;
export type CronJob = z.infer<typeof CronJobSchema>;
export type CronStore = z.infer<typeof CronStoreSchema>;
