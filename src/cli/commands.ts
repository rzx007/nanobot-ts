/**
 * CLI 命令
 * 使用 commander 注册 nanobot 子命令
 */

import { Command } from 'commander';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { loadConfig, saveConfig, createDefaultConfig } from '../config/loader';
import { expandHome, ensureDir } from '../utils/helpers';
import { MessageBus } from '../bus/queue';
import { ChannelManager } from '../channels';
import { CLIChannel } from '../channels';
import { SessionManager } from '../storage';
import { LLMProvider } from '../providers/registry';
import { AgentLoop } from '../core/agent';
import { MemoryConsolidator } from '../core/memory';
import { SkillLoader } from '../core/skills';
import {
  ToolRegistry,
  ReadFileTool,
  WriteFileTool,
  EditFileTool,
  ListDirTool,
  ExecTool,
  WebSearchTool,
  WebFetchTool,
  MessageTool,
  SpawnTool,
  CronTool,
} from '../tools';
import { CronService } from '@/cron';
import { success, error, info } from './ui';
import { logger } from '../utils/logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 包根目录 (dist 的上一级) */
const packageRoot = path.resolve(__dirname, '..', '..');
const templatesWorkspace = path.join(packageRoot, 'templates', 'workspace');

const NANOBOT_HOME =
  process.env.NANOBOT_HOME ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '~', '.nanobot');
const DEFAULT_CONFIG_PATH = path.join(NANOBOT_HOME, 'config.json');

/**
 * 执行 CLI
 */
export async function runCLI(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name('nanobot')
    .description('Ultra-lightweight personal AI assistant')
    .version('0.1.0');

  program
    .command('init')
    .description('Initialize config and workspace at ~/.nanobot')
    .action(async () => {
      await cmdInit();
    });

  program
    .command('gateway')
    .description('Start message bus and agent (no channels yet)')
    .option('--port <number>', 'Port for future HTTP server', '18790')
    .action(async (opts: { port: string }) => {
      await cmdGateway(opts.port);
    });

  program
    .command('chat [prompt]')
    .description('Send a prompt and get a response')
    .option('-i, --interactive', 'Interactive REPL')
    .action(async (prompt: string | undefined, opts: { interactive?: boolean }) => {
      await cmdChat(prompt, opts.interactive);
    });

  program
    .command('status')
    .description('Show config and status')
    .action(async () => {
      await cmdStatus();
    });

  program
    .command('session')
    .description('List sessions')
    .action(async () => {
      const config = await loadConfig();
      if (!config) {
        error('No config found. Run "nanobot init" first.');
        process.exit(1);
      }
      const workspace = expandHome(config.agents.defaults.workspace);
      const sessions = new SessionManager(workspace);
      await sessions.init();
      const list = await sessions.listSessions();
      if (list.length === 0) {
        info('No sessions.');
        return;
      }
      list.forEach((s) => console.log(`  ${s.key}  ${s.messageCount} msgs  ${s.updatedAt}`));
    });

  program
    .command('config')
    .description('Get or set config values')
    .argument('[key]', 'Config key (e.g. agents.defaults.model)')
    .argument('[value]', 'Value to set')
    .action(async (key?: string, value?: string) => {
      const config = await loadConfig();
      if (!config) {
        error('No config found. Run "nanobot init" first.');
        process.exit(1);
      }
      if (!key) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }
      if (value === undefined) {
        const parts = key.split('.');
        let cur: unknown = config;
        for (const p of parts) {
          cur = (cur as Record<string, unknown>)?.[p];
        }
        console.log(cur);
        return;
      }
      info('Config set not fully implemented. Edit ~/.nanobot/config.json directly.');
    });

  await program.parseAsync(argv);
}

async function cmdInit(): Promise<void> {
  await ensureDir(NANOBOT_HOME);
  const workspacePath = expandHome('~/.nanobot/workspace');
  await ensureDir(workspacePath);
  await ensureDir(path.join(workspacePath, 'memory'));
  await ensureDir(path.join(workspacePath, 'sessions'));
  await ensureDir(path.join(workspacePath, 'skills'));

  const configPath = path.join(NANOBOT_HOME, 'config.json');
  try {
    await fs.access(configPath);
    info(`Config already exists: ${configPath}`);
  } catch {
    const config = createDefaultConfig();
    await saveConfig(config, configPath);
    success(`Created ${configPath}`);
  }

  // Copy workspace templates if not present
  try {
    const stat = await fs.stat(templatesWorkspace);
    if (!stat.isDirectory()) throw new Error('Not a directory');
  } catch {
    info('No templates/workspace found, skipping template copy');
    success('Init done.');
    return;
  }

  const templateFiles = await fs.readdir(templatesWorkspace);
  for (const name of templateFiles) {
    const src = path.join(templatesWorkspace, name);
    const dest = path.join(workspacePath, name);
    try {
      await fs.access(dest);
    } catch {
      const stat = await fs.stat(src);
      if (stat.isDirectory()) {
        await fs.cp(src, dest, { recursive: true });
      } else {
        await fs.copyFile(src, dest);
      }
      info(`Created ${path.relative(workspacePath, dest)}`);
    }
  }

  const memoryDir = path.join(templatesWorkspace, 'memory');
  try {
    const entries = await fs.readdir(memoryDir);
    const destMemory = path.join(workspacePath, 'memory');
    for (const name of entries) {
      const dest = path.join(destMemory, name);
      try {
        await fs.access(dest);
      } catch {
        await fs.copyFile(path.join(memoryDir, name), dest);
        info(`Created memory/${name}`);
      }
    }
  } catch {
    // no memory template
  }

  success('Init done. Edit ~/.nanobot/config.json and run "nanobot gateway".');
}

async function cmdGateway(_port: string): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    error('No config found. Run "nanobot init" first.');
    process.exit(1);
  }

  const workspace = expandHome(config.agents.defaults.workspace);
  const bus = new MessageBus();
  const sessions = new SessionManager(workspace);
  await sessions.init();

  const provider = new LLMProvider(config);
  const tools = new ToolRegistry();

  tools.register(new ReadFileTool(config));
  tools.register(new WriteFileTool(config));
  tools.register(new EditFileTool(config));
  tools.register(new ListDirTool(config));
  tools.register(new ExecTool(config));
  tools.register(new WebSearchTool(config));
  tools.register(new WebFetchTool());
  tools.register(new MessageTool(config, bus));

  const cronStorePath = path.join(workspace, 'cron.json');
  const cronService = new CronService({
    storePath: cronStorePath,
    onJob: async (job) => {
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

  const channelManager = new ChannelManager(config, bus);
  channelManager.registerChannel('cli', new CLIChannel({}, bus));
  await channelManager.loadChannelsFromConfig(bus);
  await channelManager.startAll();
  channelManager.runOutboundLoop();

  agent.run().catch((err) => {
    logger.error({ err }, 'Agent loop error');
  });

  info('Gateway started (agent running). Type a message and press Enter. Ctrl+C to exit.');

  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = (): void => {
    rl.question('\nYou> ', async (line) => {
      const content = line?.trim() ?? '';
      if (!content) {
        logger.info('Gateway: skipped empty input (type a message then Enter)');
        prompt();
        return;
      }
      if (content === '/exit' || content === '/quit') {
        channelManager.stop();
        rl.close();
        process.exit(0);
      }
      await bus.publishInbound({
        channel: 'cli',
        senderId: 'user',
        chatId: 'direct',
        content,
        timestamp: new Date(),
      });
      prompt();
    });
  };
  prompt();
}

async function cmdChat(promptArg: string | undefined, interactive?: boolean): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    error('No config found. Run "nanobot init" first.');
    process.exit(1);
  }

  const workspace = expandHome(config.agents.defaults.workspace);
  const bus = new MessageBus();
  const sessions = new SessionManager(workspace);
  await sessions.init();

  const provider = new LLMProvider(config);
  const tools = new ToolRegistry();
  tools.register(new ReadFileTool(config));
  tools.register(new WriteFileTool(config));
  tools.register(new EditFileTool(config));
  tools.register(new ListDirTool(config));
  tools.register(new ExecTool(config));
  tools.register(new WebSearchTool(config));
  tools.register(new WebFetchTool());
  tools.register(new MessageTool(config, bus));

  const cronStorePath = path.join(workspace, 'cron.json');
  const cronService = new CronService({
    storePath: cronStorePath,
    onJob: async (job) => {
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

  if (interactive) {
    info('Interactive chat. Type /exit to quit.');
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (): void => {
      rl.question('You> ', async (line) => {
        const content = line?.trim();
        if (!content) {
          ask();
          return;
        }
        if (content === '/exit' || content === '/quit') {
          rl.close();
          process.exit(0);
        }
        const msg = {
          channel: 'cli' as const,
          senderId: 'user',
          chatId: 'direct',
          content,
          timestamp: new Date(),
        };
        const out = await agent.process(msg, async (text, opts) => {
          if (opts?.toolHint) process.stdout.write(`  [tools: ${text}]\n`);
        });
        if (out) console.log('Bot>', out.content);
        ask();
      });
    };
    ask();
    return;
  }

  if (!promptArg?.trim()) {
    error('Provide a prompt: nanobot chat "your question"');
    process.exit(1);
  }

  const msg = {
    channel: 'cli' as const,
    senderId: 'user',
    chatId: 'direct',
    content: promptArg.trim(),
    timestamp: new Date(),
  };
  const out = await agent.process(msg);
  if (out) console.log(out.content);
}

async function cmdStatus(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    error('No config found. Run "nanobot init" first.');
    process.exit(1);
  }

  const workspace = expandHome(config.agents.defaults.workspace);
  const sessions = new SessionManager(workspace);
  await sessions.init();

  const list = await sessions.listSessions();
  info(`Config: ${DEFAULT_CONFIG_PATH}`);
  info(`Workspace: ${workspace}`);
  info(`Sessions: ${list.length}`);
  if (list.length > 0) {
    list.slice(0, 5).forEach((s) => console.log(`  - ${s.key} (${s.messageCount} messages)`));
  }
}
