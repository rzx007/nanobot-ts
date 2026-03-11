/**
 * 技能加载器
 *
 * 动态加载工作区中的技能，支持标准 YAML Frontmatter、依赖检查、always 技能
 */

import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';
import matter from 'gray-matter';
import type { Config } from '@nanobot/shared';
import { expandHome, ensureDir } from '@nanobot/utils';
import { logger } from '@nanobot/logger';

/**
 * 技能信息
 */
export interface SkillInfo {
  /** 技能名称 */
  name: string;

  /** 技能路径 */
  path: string;

  /** 技能内容 (不含 frontmatter) */
  content: string;

  /** 描述 */
  description?: string;

  /** 版本号 */
  version?: string;

  /** 作者 */
  author?: string;

  /** 触发关键词 (用于自动匹配) */
  triggers?: string[];

  /** 是否满足依赖 */
  available?: boolean;

  /** 解析后的 frontmatter */
  _frontmatter?: Record<string, unknown>;
}

/**
 * 技能元数据 (来自 frontmatter)
 */
export interface SkillMetadata {
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  triggers?: string[];
  always?: boolean;
  requires?: {
    bins?: string[];
    env?: string[];
  };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 技能加载器
 */
export class SkillLoader {
  private workspace: string;
  private skillsDir: string;
  private readonly skills = new Map<string, SkillInfo>();

  constructor(config: Config) {
    this.workspace = expandHome(config.agents.defaults.workspace);
    this.skillsDir = path.join(this.workspace, 'skills');
  }

  /**
   * 初始化技能加载器
   *
   * 扫描技能目录，加载所有有效的技能文件（SKILL.md），解析其 frontmatter 和元数据，
   * 检查技能依赖是否满足，并将技能信息存储到内部的 Map 中
   *
   * @returns Promise<void> 无返回值的Promise
   */
  async init(): Promise<void> {
    try {
      await ensureDir(this.skillsDir);
      const entries = await fs.readdir(this.skillsDir) as string[];

      // 遍历技能目录中的所有条目
      for (const entry of entries) {
        const skillPath = path.join(this.skillsDir, entry);
        const skillFile = path.join(skillPath, 'SKILL.md');

        const stat = await fs.stat(skillPath).catch(() => null);
        if (!stat?.isDirectory()) continue;

        // 检查是否存在 SKILL.md 文件
        if (
          await fs
            .pathExists(skillFile)
            .then(() => true)
            .catch(() => false)
        ) {
          try {
            const raw = await fs.readFile(skillFile, 'utf-8');
            const { data: frontmatter, content } = matter(raw);

            // 解析技能元数据
            const requires = (frontmatter.requires as any) ?? {};
            const available = this._checkRequirements(requires);

            // 将解析出的技能信息存入 Map
            this.skills.set(entry, {
              name: entry,
              path: skillFile,
              content,
              description: (frontmatter.description as string) ?? entry,
              version: frontmatter.version as string,
              author: frontmatter.author as string,
              triggers: frontmatter.triggers as string[],
              available,
              _frontmatter: frontmatter as Record<string, unknown>,
            });
            logger.info(`Loaded skill: ${entry}`);
          } catch (error) {
            logger.error({ err: error, skill: entry }, `Failed to load skill`);
          }
        }
      }
      logger.info(`Loaded ${this.skills.size} skills`);
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize skill loader');
    }
  }

  getSkill(name: string): SkillInfo | null {
    return this.skills.get(name) ?? null;
  }

  getSkillNames(): string[] {
    return Array.from(this.skills.keys());
  }

  getAllSkills(): SkillInfo[] {
    return Array.from(this.skills.values());
  }

  /**
   * 获取 always=true 的技能 (用于完整加载到系统提示)
   */
  getAlwaysSkills(): SkillInfo[] {
    const result: SkillInfo[] = [];
    for (const s of this.skills.values()) {
      const frontmatter = s._frontmatter ?? {};
      const isAlways = frontmatter.always === true;
      if (isAlways && s.available !== false) {
        result.push(s);
      }
    }
    return result;
  }

  /**
   * 构建技能摘要 (渐进式加载，agent 用 read_file 按需加载)
   */
  buildSkillsSummary(): string {
    const all = Array.from(this.skills.values());
    if (all.length === 0) return '';

    const lines: string[] = ['<skills>'];
    for (const s of all) {
      const frontmatter = s._frontmatter ?? {};
      const requires = (frontmatter.requires as any) ?? {};
      const available = this._checkRequirements(requires);
      const desc = this._escapeXml(s.description ?? s.name);
      const name = this._escapeXml(s.name);
      const pathStr = this._escapeXml(s.path);
      const triggers = s.triggers ?? [];

      lines.push(`  <skill available="${String(available).toLowerCase()}">`);
      lines.push(`    <name>${name}</name>`);
      lines.push(`    <description>${desc}</description>`);
      lines.push(`    <location>${pathStr}</location>`);

      // 添加触发关键词
      if (triggers.length > 0) {
        const triggersStr = this._escapeXml(triggers.join(', '));
        lines.push(`    <triggers>${triggersStr}</triggers>`);
      }

      if (!available) {
        const missing = this._getMissingRequirements(requires);
        if (missing) lines.push(`    <requires>${this._escapeXml(missing)}</requires>`);
      }
      lines.push('  </skill>');
    }
    lines.push('</skills>');
    return lines.join('\n');
  }

  /**
   * 获取技能元数据 (从缓存)
   */
  getSkillMetadata(name: string): SkillMetadata | null {
    const skill = this.skills.get(name);
    if (!skill?._frontmatter) return null;
    return skill._frontmatter as unknown as SkillMetadata;
  }

  /**
   * 检查技能依赖是否满足
   */
  private _checkRequirements(requires: { bins?: string[]; env?: string[] }): boolean {
    for (const bin of requires.bins ?? []) {
      if (!this._which(bin)) return false;
    }
    for (const env of requires.env ?? []) {
      if (!process.env[env]) return false;
    }
    return true;
  }

  private _which(cmd: string): boolean {
    try {
      const cmdStr = process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;
      execSync(cmdStr, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private _getMissingRequirements(requires: { bins?: string[]; env?: string[] }): string {
    const missing: string[] = [];
    for (const bin of requires.bins ?? []) {
      if (!this._which(bin)) missing.push(`CLI: ${bin}`);
    }
    for (const env of requires.env ?? []) {
      if (!process.env[env]) missing.push(`ENV: ${env}`);
    }
    return missing.join(', ');
  }

  private _escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  clear(): void {
    this.skills.clear();
    logger.info('Skill cache cleared');
  }
}
