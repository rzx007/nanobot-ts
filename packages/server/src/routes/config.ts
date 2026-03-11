/**
 * 配置查询端点（只读）
 */

import { Hono } from 'hono';
import type { AppContext } from '../types';

const app = new Hono<AppContext>();

/**
 * GET /api/v1/config - 获取配置（脱敏）
 */
app.get('/api/v1/config', async c => {
  const config = c.get('config');

  const sanitizedConfig = {
    agents: {
      defaults: {
        model: config.agents.defaults.model,
        temperature: config.agents.defaults.temperature,
        maxTokens: config.agents.defaults.maxTokens,
        maxIterations: config.agents.defaults.maxIterations,
        memoryWindow: config.agents.defaults.memoryWindow,
        streaming: config.agents.defaults.streaming,
        workspace: config.agents.defaults.workspace,
      },
    },
    providers: {
      openai: {
        apiBase: config.providers.openai.apiBase,
      },
      anthropic: {
        apiBase: config.providers.anthropic.apiBase,
      },
      google: config.providers.google
        ? {
          apiBase: config.providers.google.apiBase,
        }
        : null,
      deepseek: {
        apiBase: config.providers.deepseek.apiBase,
      },
      groq: config.providers.groq
        ? {
          apiBase: config.providers.groq.apiBase,
        }
        : null,
      openrouter: {
        apiBase: config.providers.openrouter.apiBase,
      },
    },
    tools: {
      restrictToWorkspace: config.tools.restrictToWorkspace,
      exec: {
        timeout: config.tools.exec.timeout,
        allowedCommands: config.tools.exec.allowedCommands,
      },
      web: {
        hasApiKey: config.tools.web.search.apiKey !== undefined,
      },
      browser: config.tools.browser
        ? {
          enabled: config.tools.browser.enabled,
          headed: config.tools.browser.headed,
        }
        : null,
      approval: {
        enabled: config.tools.approval.enabled,
      },
    },
    subagent: {
      enabled: config.subagent.enabled,
      mode: config.subagent.mode,
      concurrency: config.subagent.concurrency,
    },
    server: {
      port: config.server.port,
      host: config.server.host,
    },
    channels: {
      whatsapp: {
        enabled: config.channels.whatsapp.enabled,
      },
      feishu: {
        enabled: config.channels.feishu.enabled,
      },
      email: {
        enabled: config.channels.email.enabled,
      },
    },
  };

  return c.json({
    code: 200,
    message: 'Config retrieved',
    data: sanitizedConfig,
  });
});

/**
 * GET /api/v1/config/skills - 已加载技能列表
 */
app.get('/api/v1/config/skills', async c => {
  const skills = c.get('runtime').skills;

  const skillsList = skills.getAllSkills();

  return c.json({
    code: 200,
    message: 'Skills retrieved',
    data: {
      skills: skillsList,
      total: skillsList.length,
    },
  });
});

/**
 * GET /api/v1/config/tools - 已注册工具列表
 */
app.get('/api/v1/config/tools', async c => {
  const tools = c.get('runtime').tools;

  const toolsList = tools.getToolNames();

  return c.json({
    code: 200,
    message: 'Tools retrieved',
    data: {
      tools: toolsList,
      total: toolsList.length,
    },
  });
});

export default app;
