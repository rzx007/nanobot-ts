/**
 * Skills 相关端点
 */

import { Hono } from 'hono';
import type { AppContext } from '../types';

const app = new Hono<AppContext>();

/**
 * GET /api/v1/skills - 获取所有技能列表
 */
app.get('/skills', async c => {
  try {
    const runtime = c.get('runtime');

    if (!runtime?.skills) {
      return c.json({
        code: 500,
        message: 'Skills loader not available',
      }, 500);
    }

    const skills = runtime.skills.getAllSkills();

    return c.json({
      code: 200,
      message: 'Skills retrieved',
      data: {
        skills,
        total: skills.length,
      },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to retrieve skills',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/skills/:name - 获取特定技能详情
 */
app.get('/skills/:name', async c => {
  try {
    const name = c.req.param('name');
    const runtime = c.get('runtime');

    if (!runtime?.skills) {
      return c.json({
        code: 500,
        message: 'Skills loader not available',
      }, 500);
    }

    const skill = runtime.skills.getSkill(name);

    if (!skill) {
      return c.json({
        code: 404,
        message: 'Skill not found',
      }, 404);
    }

    return c.json({
      code: 200,
      message: 'Skill retrieved',
      data: skill,
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to retrieve skill',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/skills/summary - 获取技能摘要
 */
app.get('/skills/summary', async c => {
  try {
    const runtime = c.get('runtime');

    if (!runtime?.skills) {
      return c.json({
        code: 500,
        message: 'Skills loader not available',
      }, 500);
    }

    const summary = runtime.skills.buildSkillsSummary();

    return c.json({
      code: 200,
      message: 'Skills summary retrieved',
      data: {
        summary,
      },
    });
  } catch (error) {
    return c.json({
      code: 500,
      message: 'Failed to retrieve skills summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default app;
