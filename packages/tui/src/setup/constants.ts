/**
 * Setup相关常量定义
 */

export {
  PROVIDER_SETUP_OPTIONS as PROVIDER_OPTIONS,
  PROVIDER_DEFAULTS,
  PROVIDER_MODELS,
  API_KEY_PLACEHOLDERS,
} from '@nanobot/providers';

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
