/**
 * Question Configuration Schema
 *
 * 问题系统的配置定义
 */

import { z } from 'zod';

export const QuestionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timeout: z.number().int().positive().default(300),
  defaultHandler: z.enum(['cli', 'web']).default('cli'),
});
