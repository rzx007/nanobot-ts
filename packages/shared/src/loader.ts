/**
 * 配置文件加载器
 *
 * 使用 cosmiconfig 加载配置文件，支持多种格式和路径
 */

import path from 'path';
import fs from 'fs-extra';
import { cosmiconfig } from 'cosmiconfig';
import type { Config } from './config';
import { getDefaultRegisteredProviders } from '@nanobot/providers';

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
 * 1. 如果提供了 configPath，直接从指定路径加载
 * 2. NANOBOT_HOME/config.json 或 ~/.nanobot/config.json
 * 3. cosmiconfig 从 cwd 向上搜索
 *
 * @param configPath - 可选的配置文件路径
 * @returns 配置对象，如果未找到则返回 null
 */
export async function loadConfig(configPath?: string): Promise<Config | null> {
  try {
    const pathToUse = configPath ? expandTilde(configPath) : expandTilde(DEFAULT_CONFIG_PATH);

    try {
      const raw = await fs.readJson(pathToUse);
      const config = raw as Config;
      return config;
    } catch {
      if (configPath) {
        return null;
      }
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
    const fs = await import('fs-extra');
    const path = await import('path');

    // 确保目录存在
    const dir = path.dirname(filepath);
    await fs.ensureDir(dir);

    // 写入配置文件 (格式化 JSON)
    await fs.writeJson(filepath, config, { spaces: 2 });

    console.log(`Config saved: ${filepath}`);
  } catch (error) {
    console.error('Failed to save config:', error);
    throw error;
  }
}

/** 渠道开关（仅 enabled），键与 Config.channels 一致，由 createDefaultConfig 推导 */
export type ChannelsEnabledMap = Record<string, { enabled: boolean }>;

/**
 * 从完整配置中取出渠道开关（用于 Setup 向导等）。
 * 渠道列表以 createDefaultConfig().channels 为准，新增渠道只需改默认配置即可。
 */
export function getChannelsFromConfig(config: Config | null): ChannelsEnabledMap {
  const defaultChannels = createDefaultConfig().channels;
  const defaultKeys = Object.keys(defaultChannels);
  const keys = config?.channels
    ? [...defaultKeys, ...Object.keys(config.channels).filter(k => !defaultKeys.includes(k))]
    : defaultKeys;
  return Object.fromEntries(
    keys.map(k => [
      k,
      {
        enabled: (config?.channels as Record<string, { enabled?: boolean }>)?.[k]?.enabled ?? false,
      },
    ]),
  );
}

/**
 * 创建默认配置
 *
 * @returns 默认配置对象
 */
export function createDefaultConfig(): Config {
  const providers: Config['providers'] = {
    ...getDefaultRegisteredProviders(),
    google: {
      apiKey: '',
      apiBase: 'https://generativelanguage.googleapis.com',
    },
  };

  return {
    agents: {
      defaults: {
        workspace: '~/.nanobot/workspace',
        model: 'deepseek:deepseek-chat',
        temperature: 0.1,
        maxTokens: 8192,
        maxIterations: 40,
        memoryWindow: 100,
        streaming: true,
      },
    },
    providers,
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
      cli: {
        enabled: true,
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
      browser: {
        enabled: true,
        waitForLoad: 'networkidle',
        timeout: 60,
        downloadPath: './downloads',
        allowedDomains: [],
        contentBoundaries: true,
        maxOutput: 50000,
        headed: false,
        defaultSession: 'default',
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
    subagent: {
      enabled: true,
      mode: 'embedded',
      concurrency: 3,
      maxIterations: 15,
      timeout: 300,
      maxWorkerRestarts: 3,
      dataPath: '~/.nanobot/data/bunqueue.db',
    },
    server: {
      port: 18790,
      host: 'localhost',
      apiKey: `nb_${Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join('')}`,
    },
    concurrent: {
      enabled: false,
      maxConcurrency: 5,
    },
  };
}
