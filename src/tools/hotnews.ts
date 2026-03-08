import { jsonSchema, tool, type Tool as AITool } from 'ai';
import { Tool } from './base';

// 支持的热榜平台类型
const HOTBOARD_TYPES = [
  // 视频/社区
  'bilibili', 'acfun', 'weibo', 'zhihu', 'zhihu-daily', 'douyin', 'kuaishou',
  'douban-movie', 'douban-group', 'tieba', 'hupu', 'miyoushe', 'ngabbs',
  'v2ex', '52pojie', 'hostloc', 'coolapk',
  // 新闻/资讯
  'baidu', 'thepaper', 'toutiao', 'qq-news', 'sina', 'sina-news',
  'netease-news', 'huxiu', 'ifanr',
  // 技术/IT
  'sspai', 'ithome', 'ithome-xijiayi', 'juejin', 'jianshu', 'guokr',
  '36kr', '51cto', 'csdn', 'nodeseek', 'hellogithub',
  // 游戏
  'lol', 'genshin', 'honkai', 'starrail',
  // 其他
  'weread', 'weatheralarm', 'earthquake', 'history',
] as const;

export type HotboardType = (typeof HOTBOARD_TYPES)[number];

/**
 * 获取指定平台的热榜数据（继承 Tool 基类）
 */
export class HotNewsTool extends Tool {
  name = 'getHotNews';
  description =
    '获取各大主流平台的实时热榜/热搜数据，包括哔哩哔哩、微博、知乎、抖音、百度等平台。每个热榜条目包含标题、热度值和原始链接。默认查询抖音热搜。';
  parameters: Record<string, unknown> = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: [...HOTBOARD_TYPES],
        default: 'douyin',
        description:
          "要查询的热榜平台类型，例如：'douyin(抖音热搜)' 'weibo'(微博热搜)、'bilibili'(B站热榜)、'zhihu'(知乎热榜)、'baidu'(百度热搜)等",
      },
    },
    required: [],
  };

  override async execute(params: Record<string, unknown>): Promise<string> {
    const type = (params.type as string) ?? 'douyin';
    try {
      const response = await fetch(
        `https://uapis.cn/api/v1/misc/hotboard?type=${type}`,
      );

      if (!response.ok) {
        if (response.status === 400) {
          return JSON.stringify({
            error: `无效的热榜平台类型：${type}，请检查参数是否正确。`,
          });
        }
        if (response.status === 502) {
          return JSON.stringify({
            error: `无法从 ${type} 平台获取数据，上游服务可能暂时不可用。`,
          });
        }
        if (response.status === 500) {
          return JSON.stringify({
            error: '服务器处理热榜数据时发生内部错误，请稍后重试。',
          });
        }
        return JSON.stringify({
          error: `获取热榜失败，HTTP状态码：${response.status}`,
        });
      }

      const data = (await response.json()) as {
        list: unknown[];
        type: string;
        update_time: string;
      };

      const result = {
        platform: type,
        list: data.list,
        type: data.type,
        updateTime: data.update_time,
      };
      return JSON.stringify(result);
    } catch (error) {
      return JSON.stringify({
        error: `获取热榜数据时发生异常：${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /** 转为 AI SDK Tool（含 execute），兼容原有用法 */
  override toSchema(): AITool {
    return tool({
      description: this.description,
      inputSchema: jsonSchema(this.parameters),
      execute: async (input: { type?: string }) => {
        const params = { type: input?.type ?? 'douyin' };
        const str = await this.execute(params);
        return JSON.parse(str) as Record<string, unknown>;
      },
    });
  }
}

/** 热榜工具实例，可直接作为 AI SDK 的 tool 使用 */
export const getHotNews = new HotNewsTool().toSchema();
