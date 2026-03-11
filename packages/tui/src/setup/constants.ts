/**
 * Setup相关常量定义
 */

import type { ProviderType } from './types';

export const PROVIDER_OPTIONS: {
  value: ProviderType;
  label: string;
  defaultModel: string;
  defaultBase: string;
}[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o',
    defaultBase: 'https://api.openai.com/v1',
  },
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    defaultModel: 'claude-3-5-sonnet-20241022',
    defaultBase: '',
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    defaultBase: 'https://openrouter.ai/api/v1',
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    defaultBase: 'https://api.deepseek.com/v1',
  },
  {
    value: 'groq',
    label: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultBase: 'https://api.groq.com/openai/v1',
  },
  {
    value: 'google',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash-exp',
    defaultBase: 'https://generativelanguage.googleapis.com',
  },
];

/** 供应商列表最后一项：跳过此步骤（value 用于表单内部，不写入 config） */
export const PROVIDER_SKIP_OPTION = {
  value: 'skip' as const,
  label: '跳过此步骤',
};

/** 渠道显示名，新增渠道可在此补充，否则用 key 首字母大写 */
export const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  feishu: '飞书',
  email: 'Email',
};

export const SETUP_STEPS = [
  { id: 'provider', title: 'Provider 配置', description: '选择并配置AI模型提供商' },
  { id: 'approval', title: '安全设置', description: '配置工具确认机制' },
  { id: 'channels', title: '渠道配置', description: '配置消息渠道（可选）' },
] as const;

export const PROVIDER_DEFAULTS: Record<ProviderType, { model: string; apiBase?: string }> = {
  openai: { model: 'gpt-4o', apiBase: 'https://api.openai.com/v1' },
  anthropic: { model: 'claude-3-5-sonnet-20241022' },
  openrouter: { model: 'anthropic/claude-3.5-sonnet', apiBase: 'https://openrouter.ai/api/v1' },
  deepseek: { model: 'deepseek-chat', apiBase: 'https://api.deepseek.com/v1' },
  groq: { model: 'llama-3.3-70b-versatile', apiBase: 'https://api.groq.com/openai/v1' },
  google: { model: 'gemini-2.0-flash-exp', apiBase: 'https://generativelanguage.googleapis.com' },
};

/** 各供应商常用模型列表（供选择或补全，首项为默认推荐） */
export const PROVIDER_MODELS: Record<ProviderType, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
  ],
  openrouter: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-exp',
    'meta-llama/llama-3.3-70b-instruct',
    'deepseek/deepseek-chat',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-coder',
    'deepseek-reasoner',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'mixtral-8x7b-32768',
  ],
  google: [
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
  ],
};

export const API_KEY_PLACEHOLDERS: Record<ProviderType, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  openrouter: 'sk-or-...',
  deepseek: 'sk-...',
  groq: 'gsk_...',
  google: 'AIza...',
};

export const CHECK_ITEMS = [
  { name: '配置文件', key: 'config' },
  { name: '工作区目录', key: 'workspace' },
  { name: 'API密钥', key: 'apikey' },
] as const;

export const ERROR_MESSAGES = {
  config_missing: '配置文件不存在',
  config_invalid: '配置文件格式错误',
  apikey_missing: '未配置API密钥',
  workspace_invalid: '工作区目录无效',
} as const;
