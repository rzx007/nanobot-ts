import { z } from 'zod';

/** 单个供应商配置（允许空 apiKey，与默认配置、未填写密钥场景一致） */
export const ProviderConfigSchema = z.object({
  apiKey: z.string(),
  apiBase: z.string().url().optional(),
  extraHeaders: z.record(z.string(), z.string()).optional(),
});

/**
 * 必须包含四大供应商键；其余 key（如 groq、zhipu、google、未来新增）只要符合 ProviderConfigSchema 即可。
 */
export const ProvidersConfigSchema = z
  .object({
    openai: ProviderConfigSchema,
    anthropic: ProviderConfigSchema,
    openrouter: ProviderConfigSchema,
    deepseek: ProviderConfigSchema,
  })
  .catchall(ProviderConfigSchema);

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>;
