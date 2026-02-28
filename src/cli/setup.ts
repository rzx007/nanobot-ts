/**
 * CLI 公共搭建逻辑
 * 加载配置、构建 Agent 运行时，供 gateway / chat 等命令复用
 */

import path from 'path';
import { loadConfig } from '@/config';
import type { Config } from '@/config/schema';
import { ApprovalConfigSchema } from '@/config/approval-schema';
import { expandHome } from '@/utils/helpers';
import { MessageBus } from '@/bus/queue';
import { SessionManager } from '@/storage';
import { LLMProvider } from '@/providers';
import { AgentLoop } from '@/core/agent';
import { MemoryConsolidator } from '@/core/memory';
import { SkillLoader } from '@/core/skills';
import { ApprovalManager } from '@/core/approval';
import {
  ToolRegistry,
  ReadFileTool,
  WriteFileTool,
  EditFileTool,
  DeleteFileTool,
  ListDirTool,
  ExecTool,
  WebSearchTool,
  WebFetchTool,
  MessageTool,
  SpawnTool,
  CronTool,
} from '@/tools';
import { CronService } from '@/cron';
import { MCPToolLoader } from '@/mcp/loader';
import { error } from './ui';

/**
 * 加载配置，失败则打印错误并退出进程
 */
export async function requireConfig(): Promise<Config> {
  const config = await loadConfig();
  if (!config) {
    error('No config found. Run "nanobot init" first.');
    process.exit(1);
  }
  return config;
}

/**
 * Agent 运行时：bus、sessions、provider、tools、memory、skills、agent 等
 * 供 gateway、chat 等命令共用搭建逻辑
 */
export interface AgentRuntime {
  config: Config;
  workspace: string;
  bus: MessageBus;
  sessions: SessionManager;
  provider: LLMProvider;
  tools: ToolRegistry;
  memory: MemoryConsolidator;
  skills: SkillLoader;
  approvalManager: ApprovalManager;
  agent: AgentLoop;
  cronService: CronService;
}

/**
 * 根据配置构建完整 Agent 运行时（工具、MCP、Cron、Memory、Skills、AgentLoop）
 */
export async function buildAgentRuntime(config: Config): Promise<AgentRuntime> {
  const workspace = expandHome(config.agents.defaults.workspace);
  const bus = new MessageBus();
  const sessions = new SessionManager(workspace);
  await sessions.init();

  const provider = new LLMProvider(config);
  const tools = new ToolRegistry();

  // 创建审批管理器（解析并补全默认值，避免旧配置缺少 approval 字段导致报错）
  const approvalConfig = ApprovalConfigSchema.parse(config.tools?.approval ?? {});
  const approvalManager = new ApprovalManager(approvalConfig);
  // 设置工具的审批检查
  tools.setApprovalCheck(approvalManager);

  // 初始化默认处理器
  approvalManager.initializeDefaultHandlers(bus);

  // 设置消息过滤器（更通用的方式）
  bus.addInboundFilter((m) =>
    approvalManager.handleUserMessage(m.channel, m.chatId, m.content),
  );

  tools.register(new ReadFileTool(config));
  tools.register(new WriteFileTool(config));
  tools.register(new EditFileTool(config));
  tools.register(new DeleteFileTool(config));
  tools.register(new ListDirTool(config));
  tools.register(new ExecTool(config));
  tools.register(new WebSearchTool(config));
  tools.register(new WebFetchTool());
  tools.register(new MessageTool(config, bus));

  const mcpToolLoader = new MCPToolLoader();
  await mcpToolLoader.load(config, tools);

  const cronStorePath = path.join(workspace, 'cron.json');
  const cronService = new CronService({
    storePath: cronStorePath,
    onJob: async job => {
      const ch = job.payload.channel ?? 'cli';
      const to = job.payload.to ?? 'direct';
      await bus.publishInbound({
        channel: ch,
        senderId: 'cron',
        chatId: to,
        content: job.payload.message,
        timestamp: new Date(),
      });
      return null;
    },
  });
  await cronService.start();
  tools.register(new SpawnTool());
  tools.register(new CronTool(cronService));

  const memory = new MemoryConsolidator(config);
  const skills = new SkillLoader(config);
  await skills.init();

  const agent = new AgentLoop({
    bus,
    provider,
    tools,
    sessions,
    config,
    memory,
    skills,
  });

  return {
    config,
    workspace,
    bus,
    sessions,
    provider,
    tools,
    memory,
    skills,
    approvalManager,
    agent,
    cronService,
  };
}
