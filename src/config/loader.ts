/**
 * 配置文件加载器
 *
 * 使用 cosmiconfig 加载配置文件，支持多种格式和路径
 */

import path from 'path';
import fs from 'fs/promises';
import { cosmiconfig } from 'cosmiconfig';
import type { Config } from './schema';

const NANOBOT_HOME =
  process.env.NANOBOT_HOME ??
  path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.nanobot');
const DEFAULT_CONFIG_PATH = path.join(NANOBOT_HOME, 'config.json');

function expandTilde(p: string): string {
  if (p.startsWith('~')) {
    return path.join(process.env.HOME ?? process.env.USERPROFILE ?? '', p.slice(1));
  }
  return p;
}

/**
 * 加载配置文件
 *
 * 搜索路径 (按顺序):
 * 1. NANOBOT_HOME/config.json 或 ~/.nanobot/config.json
 * 2. cosmiconfig 从 cwd 向上搜索
 *
 * @returns 配置对象，如果未找到则返回 null
 */
export async function loadConfig(): Promise<Config | null> {
  try {
    const defaultPath = expandTilde(DEFAULT_CONFIG_PATH);
    try {
      const raw = await fs.readFile(defaultPath, 'utf-8');
      const config = JSON.parse(raw) as Config;
      return config;
    } catch {
      // 继续尝试 cosmiconfig
    }

    const result = await cosmiconfig('nanobot', {
      searchPlaces: ['config.json', 'config.ts', '.nanobotrc'],
    }).search();

    if (result) {
      return result.config as Config;
    }

    return null;
  } catch (error) {
    console.error('Failed to load config:', error);
    throw error;
  }
}

/**
 * 保存配置到文件
 *
 * @param config - 配置对象
 * @param filepath - 文件路径
 */
export async function saveConfig(config: Config, filepath: string): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');

    // 确保目录存在
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });

    // 写入配置文件 (格式化 JSON)
    await fs.writeFile(filepath, JSON.stringify(config, null, 2), 'utf-8');

    console.log(`Config saved: ${filepath}`);
  } catch (error) {
    console.error('Failed to save config:', error);
    throw error;
  }
}

/**
 * 创建默认配置
 *
 * @returns 默认配置对象
 */
export function createDefaultConfig(): Config {
  return {
    agents: {
      defaults: {
        workspace: '~/.nanobot/workspace',
        model: 'openai:gpt-4o',
        temperature: 0.1,
        maxTokens: 8192,
        maxIterations: 40,
        memoryWindow: 100,
      },
    },
    providers: {
      openai: {
        apiKey: '',
        apiBase: 'https://api.openai.com/v1',
      },
      anthropic: {
        apiKey: '',
      },
      openrouter: {
        apiKey: '',
        apiBase: 'https://openrouter.ai/api/v1',
      },
      deepseek: {
        apiKey: '',
        apiBase: 'https://api.deepseek.com/v1',
      },
    },
    channels: {
      whatsapp: {
        enabled: false,
        allowFrom: [],
        usePairingCode: false,
      },
      feishu: {
        enabled: false,
        appId: '',
        appSecret: '',
        encryptKey: '',
        verificationToken: '',
        allowFrom: [],
      },
      email: {
        enabled: false,
        consentGranted: false,
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        imapUsername: '',
        imapPassword: '',
        imapMailbox: 'INBOX',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: '',
        fromAddress: '',
        allowFrom: [],
        autoReplyEnabled: true,
      },
    },
    tools: {
      restrictToWorkspace: false,
      exec: {
        timeout: 60,
        allowedCommands: [],
      },
      web: {
        search: {
          apiKey: '',
        },
      },
      approval: {
        enabled: true,
        memoryWindow: 300,
        timeout: 60,
        toolOverrides: {},
        strictMode: false,
        enableLogging: true,
      },
    },
  };
}
