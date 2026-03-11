/**
 * 默认配置
 */

export const AGENT_DEFAULTS = {
  /** 工作区路径 */
  workspace: '~/.nanobot/workspace',

  /** LLM 模型名称 */
  model: 'openai:gpt-4o',

  /** 温度参数 */
  temperature: 0.1,

  /** 最大 Token 数 */
  maxTokens: 8192,

  /** 最大工具调用迭代次数 */
  maxIterations: 40,

  /** 内存窗口 (保留的历史消息数) */
  memoryWindow: 100,

  /** 是否启用流式返回 */
  streaming: true,
} as const;

export const CHANNEL_DEFAULTS = {
  /** WhatsApp 默认配置 */
  whatsapp: {
    enabled: false,
    allowFrom: [],
    usePairingCode: false,
  },

  /** Feishu 默认配置 */
  feishu: {
    enabled: false,
    appId: '',
    appSecret: '',
    encryptKey: '',
    verificationToken: '',
    allowFrom: [],
  },

  /** Email 默认配置 */
  email: {
    enabled: false,
    consentGranted: false,
    imapHost: '',
    imapPort: 993,
    imapUsername: '',
    imapPassword: '',
    imapMailbox: 'INBOX',
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    smtpFrom: '',
    allowFrom: [],
  },

  /** CLI 默认配置 */
  cli: {
    enabled: true,
  },
} as const;

export const TOOL_DEFAULTS = {
  /** 审批默认配置 */
  approval: {
    enabled: true,
    memoryWindow: 300,
    timeout: 60,
  },
} as const;

export const SERVER_DEFAULTS = {
  /** HTTP 服务器默认配置 */
  host: '0.0.0.0',
  port: 3000,
  apiKey: '',
} as const;
