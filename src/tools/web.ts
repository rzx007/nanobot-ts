/**
 * Web 工具
 * 
 * 网络搜索和获取的工具实现
 */

import { Tool } from './base';
import type { Config } from '../config/schema';
import { logger } from '../utils/logger';

// 定义 Brave Search API 响应的数据结构
interface SearchResultItem {
  title: string;
  url: string;
  snippet?: string;
}

interface SearchResult {
  results?: SearchResultItem[];
}

interface SearchResponse {
  web?: SearchResult;
  error?: {
    message?: string;
  };
}

/**
 * Web 搜索工具
 */
export class WebSearchTool extends Tool {
  name = 'web_search';

  description = '使用 Brave Search 搜索网络';

  /** 配置 */
  private config: Config;

  /**
   * 构造函数
   * 
   * @param config - 配置对象
   */
  constructor(config: Config) {
    super();
    this.config = config;
  }

  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询',
      },
    },
    required: ['query'],
  };

  /**
   * 执行网络搜索
   * 
   * @param params - 工具参数
   * @returns 搜索结果
   */
  async execute(params: { query: string }): Promise<string> {
    try {
      const { query } = params;
      const apiKey = this.config.tools.web.search.apiKey;

      if (!apiKey) {
        return 'Error: 未配置 Brave Search API 密钥';
      }

      logger.info(`搜索网络: ${query}`);

      // 调用 Brave Search API
      const response = await fetch('https://api.search.brave.com/res/v1/web/search', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        body: JSON.stringify({ q: query, count: 5 }),
      });

      const data = await response.json() as SearchResponse;

      if (!response.ok) {
        throw new Error(data.error?.message ?? '搜索请求失败');
      }

      // 格式化搜索结果
      const results = (data.web?.results ?? []).map((item: SearchResultItem) => {
        return `${item.title}\n${item.url}\n${item.snippet ?? ''}`;
      });

      return results.join('\n\n');
    } catch (error) {
      const errorMsg = `网络搜索失败: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return `Error: ${errorMsg}`;
    }
  }
}

/**
 * Web 获取工具
 */
export class WebFetchTool extends Tool {
  name = 'web_fetch';

  description = '获取网页内容';

  constructor(_config?: Config) {
    super();
  }

  parameters = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要获取的网页 URL',
      },
    },
    required: ['url'],
  };

  /**
   * 执行网页获取
   * 
   * @param params - 工具参数
   * @returns 网页内容
   */
  async execute(params: { url: string }): Promise<string> {
    try {
      const { url } = params;

      logger.info(`获取网页: ${url}`);

      // 获取网页内容
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; nanobot/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 获取内容类型
      const contentType = response.headers.get('content-type') ?? '';

      // 如果是 HTML，提取文本
      if (contentType.includes('text/html')) {
        const html = await response.text();

        // 简单的 HTML 标签移除
        const text = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        // 限制长度
        const maxLength = 5000;
        if (text.length > maxLength) {
          return text.substring(0, maxLength) + '\n\n... (内容已截断)';
        }

        return text;
      }

      // 其他类型，直接返回
      const content = await response.text();
      const maxLength = 10000;
      if (content.length > maxLength) {
        return content.substring(0, maxLength) + '\n\n... (内容已截断)';
      }

      return content;
    } catch (error) {
      const errorMsg = `获取网页失败: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return `Error: ${errorMsg}`;
    }
  }
}