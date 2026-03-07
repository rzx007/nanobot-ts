/**
 * CLI 公共搭建逻辑
 * 加载配置、构建 Agent 运行时，供 gateway / chat 等命令复用
 */

import path from 'path';
import { loadConfig } from '@/config';
import type { Config } from '@/config/schema';
import { expandHome } from '@/utils/helpers';
import { MessageBus } from '@/bus/queue';
import { SessionManager } from '@/storage';
import { LLMProvider } from '@/providers';
import { AgentLoop } from '@/core/agent';
import { MemoryConsolidator } from '@/core/memory';
import { SkillLoader } from '@/skills';
import { ApprovalManager, SubagentManager } from '@/core';
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
  BrowserOpenTool,
  BrowserCloseTool,
  BrowserSnapshotTool,
  BrowserClickTool,
  BrowserFillTool,
  BrowserTypeTool,
  BrowserScreenshotTool,
  BrowserWaitTool,
  BrowserGetTool,
  BrowserEvalTool,
  BrowserPressTool,
  BrowserSelectTool,
  BrowserCheckTool,
  BrowserUncheckTool,
  BrowserScrollTool,
  BrowserBackTool,
  BrowserForwardTool,
  BrowserReloadTool,
  BrowserPdfTool,
  MessageTool,
  SpawnTool,
  SubagentTool,
  CronTool,
} from '@/tools';
import { CronService } from '@/cron';
import { MCPToolLoader } from '@/mcp/loader';
import { LoadSkillTool, MatchSkillTool } from '@/tools/skill';
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
  subagentManager: import('@/core/subagent').SubagentManager | null;
}

/**
 * 根据配置构建完整 Agent 运行时（工具、MCP、Cron、Memory、Skills、AgentLoop）
 */
export async function buildAgentRuntime(config: Config, tui?: boolean): Promise<AgentRuntime> {
  const workspace = expandHome(config.agents.defaults.workspace);
  const bus = new MessageBus();
  const sessions = new SessionManager(workspace);
  await sessions.init();

  const provider = new LLMProvider(config);
  const tools = new ToolRegistry();

  // 创建审批管理器（内部从 config.tools?.approval 解析确认配置，按 config.channels 注册渠道 handler）
  const approvalManager = new ApprovalManager(config);
  // 设置工具的审批检查
  tools.setApprovalCheck(approvalManager);

  // 初始化默认处理器（按渠道名注册：cli + 已启用的 feishu/whatsapp/email）
  approvalManager.initializeDefaultHandlers(bus, tui);

  // 设置消息过滤器（更通用的方式）
  bus.addInboundFilter(m => approvalManager.handleUserMessage(m.channel, m.chatId, m.content));

  // 初始化 SubagentManager（如果启用）
  let subagentManager: SubagentManager | null = null;
  if (config.subagent?.enabled) {
    subagentManager = new SubagentManager({
      config,
      bus,
      provider,
      tools,
      workspace,
    });
    await subagentManager.initialize();
  }

  tools.register(new ReadFileTool(config));
  tools.register(new WriteFileTool(config));
  tools.register(new EditFileTool(config));
  tools.register(new DeleteFileTool(config));
  tools.register(new ListDirTool(config));
  tools.register(new ExecTool(config));
  tools.register(new WebSearchTool(config));
  tools.register(new WebFetchTool());
  tools.register(new MessageTool(config, bus));

  // 注册 Subagent 工具（如果启用）
  if (subagentManager) {
    const subagentTool = new SubagentTool();
    subagentTool.setManager(subagentManager);
    tools.register(subagentTool);
  }

  // 注册浏览器工具
  if (config.tools.browser?.enabled) {
    tools.register(new BrowserOpenTool(config));
    tools.register(new BrowserCloseTool(config));
    tools.register(new BrowserSnapshotTool(config));
    tools.register(new BrowserClickTool(config));
    tools.register(new BrowserFillTool(config));
    tools.register(new BrowserTypeTool(config));
    tools.register(new BrowserScreenshotTool(config));
    tools.register(new BrowserWaitTool(config));
    tools.register(new BrowserGetTool(config));
    tools.register(new BrowserEvalTool(config));
    tools.register(new BrowserPressTool(config));
    tools.register(new BrowserSelectTool(config));
    tools.register(new BrowserCheckTool(config));
    tools.register(new BrowserUncheckTool(config));
    tools.register(new BrowserScrollTool(config));
    tools.register(new BrowserBackTool(config));
    tools.register(new BrowserForwardTool(config));
    tools.register(new BrowserReloadTool(config));
    tools.register(new BrowserPdfTool(config));
  }

  const mcpToolLoader = new MCPToolLoader();
  await mcpToolLoader.load(config, tools);

  const cronStorePath = path.join(workspace, 'cron.json');
  const cronService = new CronService({
    storePath: cronStorePath,
    onJob: async job => {
      const ch = job.payload.channel ?? 'cli';
      const to = job.payload.to ?? 'direct';
      const now = new Date();
      const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const content = job.payload.message.replace(/\{\{time\}\}/g, timeStr);
      await bus.publishInbound({
        channel: ch,
        senderId: 'cron',
        chatId: to,
        content: `📢 ${content}`,
        timestamp: new Date(),
      });
      return null;
    },
  });
  await cronService.start();
  tools.register(new SpawnTool());
  tools.register(new CronTool(cronService));

  const memory = new MemoryConsolidator(config);

  // 添加消息过滤器处理 subagent 结果
  if (subagentManager) {
    // bus.addInboundFilter(m => {
    //   const isSubagentResult = m.channel === 'system' && m.senderId === 'subagent';
    //   if (!isSubagentResult) {
    //     return false;
    //   }

    //   const isSystemMessage = m.channel === 'system' && m.content.includes('[Subagent');
    //   if (isSystemMessage) {
    //     return true;
    //   }

    //   return false;
    // });
  }

  const skills = new SkillLoader(config);
  await skills.init();

  // 设置并注册技能工具
  const loadSkillTool = new LoadSkillTool();
  const matchSkillTool = new MatchSkillTool();
  loadSkillTool.setSkillLoader(skills);
  matchSkillTool.setSkillLoader(skills);
  tools.register(loadSkillTool);
  tools.register(matchSkillTool);

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
    subagentManager: subagentManager ?? null,
  };
}
