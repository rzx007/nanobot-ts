import { z } from 'zod'

export const configSchema = z.object({
  agents: z.object({
    defaults: z.object({
      model: z.string(),
      temperature: z.number().min(0).max(2),
      maxTokens: z.number().min(1),
      maxIterations: z.number().min(1),
      memoryWindow: z.number().min(1),
      streaming: z.boolean(),
      workspace: z.string(),
    }),
  }),
  providers: z.object({
    openai: z.object({
      apiBase: z.string().url().optional(),
    }),
    anthropic: z.object({
      apiBase: z.string().url().optional(),
    }),
    google: z.object({
      apiBase: z.string().url().optional(),
    }).optional(),
    deepseek: z.object({
      apiBase: z.string().url().optional(),
    }),
    groq: z.object({
      apiBase: z.string().url().optional(),
    }).optional(),
    openrouter: z.object({
      apiBase: z.string().url().optional(),
    }),
    zhipu: z.object({
      apiBase: z.string().url().optional(),
    }).optional(),
  }),
  tools: z.object({
    restrictToWorkspace: z.boolean(),
    exec: z.object({
      timeout: z.number().min(1),
      allowedCommands: z.string(),
    }),
    web: z.object({
      hasApiKey: z.boolean(),
    }),
    browser: z.object({
      enabled: z.boolean(),
      headed: z.boolean(),
    }).optional(),
    approval: z.object({
      enabled: z.boolean(),
    }),
  }),
  subagent: z.object({
    enabled: z.boolean(),
    mode: z.enum(['auto', 'manual']),
    concurrency: z.number().min(1),
  }),
  server: z.object({
    port: z.number().min(1).max(65535),
    host: z.string(),
  }),
})

export type Config = z.infer<typeof configSchema>