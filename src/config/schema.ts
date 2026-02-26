/**
 * 配置 Schema 定义
 *
 * 使用 Zod 定义完整的配置结构，支持类型安全验证
 */

import { z } from 'zod';

/**
 * Agent 默认配置
 */
export const AgentDefaultsSchema = z.object({
  /** 工作区路径 */
  workspace: z.string().default('~/.nanobot/workspace'),

  /** LLM 模型名称 */
  model: z.string().default('openai:gpt-4o'),

  /** 温度参数 */
  temperature: z.number().min(0).max(2).default(0.1),

  /** 最大 Token 数 */
  maxTokens: z.number().int().positive().default(8192),

  /** 最大工具调用迭代次数 */
  maxIterations: z.number().int().positive().default(40),

  /** 内存窗口 (保留的历史消息数) */
  memoryWindow: z.number().int().positive().default(100),
});

/**
 * Agent 配置
 */
export const AgentConfigSchema = z.object({
  /** 默认配置 */
  defaults: AgentDefaultsSchema,
});

/**
 * Provider 基础配置
 */
export const ProviderConfigSchema = z.object({
  /** API 密钥 */
  apiKey: z.string().min(1),

  /** API 基础 URL */
  apiBase: z.string().url().optional(),

  /** 额外的请求头 */
  extraHeaders: z.record(z.string(), z.string()).optional(),
  // ... existing code ...
});

/**
 * Providers 配置
 */
export const ProvidersConfigSchema = z.object({
  /** OpenAI 配置 */
  openai: ProviderConfigSchema,

  /** Anthropic 配置 */
  anthropic: ProviderConfigSchema,

  /** OpenRouter 配置 */
  openrouter: ProviderConfigSchema,

  /** Google 配置 */
  google: ProviderConfigSchema.optional(),

  /** DeepSeek 配置 */
  deepseek: ProviderConfigSchema,

  /** Groq 配置 */
  groq: ProviderConfigSchema.optional(),
});

/**
 * WhatsApp 渠道配置
 */
export const WhatsAppConfigSchema = z.object({
  /** 是否启用 */
  enabled: z.boolean().default(false),

  /** 允许的用户列表 */
  allowFrom: z.array(z.string()).default([]),

  /** 使用配对码而非二维码 */
  usePairingCode: z.boolean().default(false),

  /** 配对码手机号 (格式: 86123456789) */
  phoneNumber: z.string().optional(),
});

/**
 * Feishu 渠道配置
 */
export const FeishuConfigSchema = z.object({
  /** 是否启用 */
  enabled: z.boolean().default(false),

  /** App ID */
  appId: z.string().min(1),

  /** App Secret */
  appSecret: z.string().min(1),

  /** 加密密钥 */
  encryptKey: z.string().default(''),

  /** 验证 Token */
  verificationToken: z.string().default(''),

  /** 允许的用户列表 */
  allowFrom: z.array(z.string()).default([]),
});

/**
 * Email 渠道配置
 */
export const EmailConfigSchema = z.object({
  /** 是否启用 */
  enabled: z.boolean().default(false),

  /** 用户是否同意使用 Email */
  consentGranted: z.boolean().default(false),

  /** IMAP 主机 */
  imapHost: z.string().min(1),

  /** IMAP 端口 */
  imapPort: z.number().int().positive().default(993),

  /** IMAP 用户名 */
  imapUsername: z.string().min(1),

  /** IMAP 密码 */
  imapPassword: z.string().min(1),

  /** IMAP 邮箱 */
  imapMailbox: z.string().default('INBOX'),

  /** SMTP 主机 */
  smtpHost: z.string().min(1),

  /** SMTP 端口 */
  smtpPort: z.number().int().positive().default(587),

  /** SMTP 用户名 */
  smtpUsername: z.string().min(1),

  /** SMTP 密码 */
  smtpPassword: z.string().min(1),

  /** 发件人地址 */
  fromAddress: z.string().email(),

  /** 允许的发件人列表 */
  allowFrom: z.array(z.string()).default([]),

  /** 是否启用自动回复 */
  autoReplyEnabled: z.boolean().default(true),
});

/**
 * 渠道配置
 */
export const ChannelsConfigSchema = z.object({
  /** WhatsApp 配置 */
  whatsapp: WhatsAppConfigSchema,

  /** Feishu 配置 */
  feishu: FeishuConfigSchema,

  /** Email 配置 */
  email: EmailConfigSchema,
});

/**
 * Shell 执行配置
 */
export const ExecConfigSchema = z.object({
  /** 超时时间 (秒) */
  timeout: z.number().int().positive().default(60),

  /** 允许的命令列表 */
  allowedCommands: z.array(z.string()).default([]),
});

/**
 * Web 搜索配置
 */
export const WebConfigSchema = z.object({
  /** 搜索 API 配置 */
  search: z.object({
    /** Brave Search API 密钥 */
    apiKey: z.string().optional(),
  }),
});

/**
 * 工具配置
 */
export const ToolsConfigSchema = z.object({
  /** 是否限制在工作区内 */
  restrictToWorkspace: z.boolean().default(false),

  /** Shell 执行配置 */
  exec: ExecConfigSchema,

  /** Web 配置 */
  web: WebConfigSchema,
});

/**
 * 根配置 Schema
 */
export const ConfigSchema = z.object({
  /** Agent 配置 */
  agents: AgentConfigSchema,

  /** Providers 配置 */
  providers: ProvidersConfigSchema,

  /** 渠道配置 */
  channels: ChannelsConfigSchema,

  /** 工具配置 */
  tools: ToolsConfigSchema,
});

// 导出类型
export type AgentDefaults = z.infer<typeof AgentDefaultsSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>;
export type WhatsAppConfig = z.infer<typeof WhatsAppConfigSchema>;
export type FeishuConfig = z.infer<typeof FeishuConfigSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;
export type ChannelsConfig = z.infer<typeof ChannelsConfigSchema>;
export type ExecConfig = z.infer<typeof ExecConfigSchema>;
export type WebConfig = z.infer<typeof WebConfigSchema>;
export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
