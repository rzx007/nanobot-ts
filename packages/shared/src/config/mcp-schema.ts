import { z } from 'zod';
/**
 * MCP 服务器类型
 */
export const MCPServerTypeEnum = z.enum(['stdio', 'http']);

/**
 * STDIO MCP 服务器配置
 */
export const STDIO_MCPServerSchema = z.object({
  /** 命令 (如 node, python, java) */
  command: z.string().min(1),

  /** 参数列表 */
  args: z.array(z.string()).default([]),

  /** 环境变量 */
  env: z.record(z.string(), z.string()).optional(),

  /** 工作目录 */
  cwd: z.string().optional(),
});

/**
 * HTTP MCP 服务器配置
 */
export const HTTP_MCPServerSchema = z.object({
  /** 服务器URL */
  url: z.string().url(),

  /** OAuth配置（可选） */
  oauth: z
    .object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      authorizationEndpoint: z.string().optional(),
      tokenEndpoint: z.string().optional(),
    })
    .optional(),
});
/**
 * MCP 服务器配置
 */
export const MCPServerSchema = z
  .object({
    /** 服务器名称 */
    name: z.string().min(1),

    /** 服务器类型 */
    type: MCPServerTypeEnum.default('stdio'),

    /** STDIO配置 (当type=stdio时必需) */
    stdio: STDIO_MCPServerSchema.optional(),

    /** HTTP配置 (当type=http时必需) */
    http: HTTP_MCPServerSchema.optional(),
  })
  .refine(
    (data): boolean => {
      if (data.type === 'stdio' && !data.stdio) {
        return false;
      }
      if (data.type === 'http' && !data.http) {
        return false;
      }
      return true;
    },
    {
      message: 'Invalid MCP server configuration',
    },
  );

/**
 * MCP 配置
 */
export const MCPConfigSchema = z.object({
  /** 是否启用 */
  enabled: z.boolean().default(false),

  /** MCP 服务器列表 */
  servers: z.array(MCPServerSchema).default([]),
});


/**
 * 工具定义 - 直接兼容 Vercel AI SDK 的 Tool 类型
 */
export type ToolDefinition = import('ai').Tool;

/**
 * 工具集合 - Record<工具名, Tool>
 */
export type ToolSet = Record<string, ToolDefinition>;
export type MCPConfig = z.infer<typeof MCPConfigSchema>;
export type MCPServerTypeEnum = z.infer<typeof MCPServerTypeEnum>;
export type STDIO_MCPServerConfig = z.infer<typeof STDIO_MCPServerSchema>;
export type HTTP_MCPServerConfig = z.infer<typeof HTTP_MCPServerSchema>;
export type MCPServerConfig = z.infer<typeof MCPServerSchema>;