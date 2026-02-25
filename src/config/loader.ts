/**
 * 配置文件加载器
 * 
 * 使用 cosmiconfig 加载配置文件，支持多种格式和路径
 */

import { cosmiconfig } from 'cosmiconfig';
import type { Config } from './schema';

/**
 * 加载配置文件
 * 
 * 搜索路径 (按顺序):
 * 1. ~/.nanobot/config.json
 * 2. ./config.json
 * 3. ./config.ts (如果存在)
 * 
 * @returns 配置对象，如果未找到则返回 null
 */
export async function loadConfig(): Promise<Config | null> {
  try {
    const result = await cosmiconfig('nanobot', {
      // 搜索路径
      searchPlaces: [
        '~/.nanobot/config.json',
        './config.json',
        './config.ts',
      ],
    }).search();

    if (result) {
      console.log(`配置加载成功: ${result.filepath}`);
      return result.config as Config;
    }

    console.log('未找到配置文件');
    return null;
  } catch (error) {
    console.error('加载配置文件失败:', error);
    throw error;
  }
}

/**
 * 保存配置到文件
 * 
 * @param config - 配置对象
 * @param filepath - 文件路径
 */
export async function saveConfig(
  config: Config,
  filepath: string
): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');

    // 确保目录存在
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });

    // 写入配置文件 (格式化 JSON)
    await fs.writeFile(
      filepath,
      JSON.stringify(config, null, 2),
      'utf-8'
    );

    console.log(`配置已保存: ${filepath}`);
  } catch (error) {
    console.error('保存配置文件失败:', error);
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
    },
  };
}
