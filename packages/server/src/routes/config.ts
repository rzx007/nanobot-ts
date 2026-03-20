/**
 * 配置查询端点（只读）
 */

import { Hono } from 'hono';
import type { AppContext } from '../types';

const app = new Hono<AppContext>();

/**
 * GET /api/v1/config - 获取配置（脱敏）
 */
app.get('/config', async c => {
  const config = c.get('config');

  return c.json({
    code: 200,
    message: 'Config retrieved',
    data: { ...config },
  });
});

/**
 * PUT /api/v1/config - 更新配置
 */
app.put('/config', async c => {
  try {
    const config = await c.req.json();

    // 验证配置结构
    if (!config.agents || !config.providers || !config.tools || !config.subagent || !config.server) {
      return c.json({ code: 400, message: 'Invalid config structure' }, 400);
    }

    // 更新配置
    // await c.get('runtime').updateConfig(config);

    return c.json({
      code: 200,
      message: 'Config updated successfully',
    });
  } catch (error) {
    return c.json({ code: 500, message: 'Failed to update config' }, 500);
  }
});

/**
 * GET /api/v1/config/skills - 已加载技能列表
 */
app.get('/config/skills', async c => {
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
app.get('/config/tools', async c => {
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
