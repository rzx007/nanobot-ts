/**
 * 技能加载器
 *
 * 动态加载工作区中的技能，支持 frontmatter、requirements、always 技能
 * 参考 Python nanobot agent/skills.py
 */

import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import type { Config } from '../config/schema';
import { expandHome, ensureDir } from '../utils/helpers';
import { logger } from '../utils/logger';

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

  /** 是否满足依赖 */
  available?: boolean;

  /** 解析后的 nanobot 元数据 */
  _meta?: NanobotMeta;

  /** 原始 frontmatter */
  _frontmatter?: Record<string, string>;
}

/**
 * 技能元数据 (来自 frontmatter)
 */
export interface SkillMetadata {
  name?: string;
  description?: string;
  metadata?: string;
  always?: string | boolean;
  [key: string]: unknown;
}

/**
 * nanobot 元数据 (metadata JSON 中的 nanobot/openclaw)
 */
interface NanobotMeta {
  always?: boolean;
  requires?: { bins?: string[]; env?: string[] };
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

  async init(): Promise<void> {
    try {
      await ensureDir(this.skillsDir);
      const entries = await fs.readdir(this.skillsDir);

      for (const entry of entries) {
        const skillPath = path.join(this.skillsDir, entry);
        const skillFile = path.join(skillPath, 'SKILL.md');

        const stat = await fs.stat(skillPath).catch(() => null);
        if (!stat?.isDirectory()) continue;

        if (await fs.access(skillFile).then(() => true).catch(() => false)) {
          const raw = await fs.readFile(skillFile, 'utf-8');
          const content = this._stripFrontmatter(raw);
          const frontmatter = await this._readFrontmatter(skillFile);
          const skillMeta = this._parseNanobotMetadata(frontmatter.metadata);
          const available = this._checkRequirements(skillMeta);

          this.skills.set(entry, {
            name: entry,
            path: skillFile,
            content,
            description: frontmatter.description ?? entry,
            available,
            _meta: skillMeta,
            _frontmatter: frontmatter,
          });
          logger.info(`已加载技能: ${entry}`);
        }
      }
      logger.info(`共加载 ${this.skills.size} 个技能`);
    } catch (error) {
      logger.error({ err: error }, '初始化技能加载器失败');
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
      const skillMeta = s._meta ?? {};
      const fm = s._frontmatter ?? {};
      const isAlways = skillMeta.always || fm.always === 'true';
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
      const skillMeta = s._meta ?? {};
      const available = this._checkRequirements(skillMeta);
      const desc = this._escapeXml(s.description ?? s.name);
      const name = this._escapeXml(s.name);
      const pathStr = this._escapeXml(s.path);

      lines.push(`  <skill available="${String(available).toLowerCase()}">`);
      lines.push(`    <name>${name}</name>`);
      lines.push(`    <description>${desc}</description>`);
      lines.push(`    <location>${pathStr}</location>`);
      if (!available) {
        const missing = this._getMissingRequirements(skillMeta);
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

  private async _readFrontmatter(filePath: string): Promise<Record<string, string>> {
    const content = await fs.readFile(filePath, 'utf-8');
    if (!content.startsWith('---')) return {};
    const match = content.match(/^---\n(.*?)\n---/s);
    if (!match?.[1]) return {};

    const metadata: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
      if (line.includes(':')) {
        const idx = line.indexOf(':');
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        metadata[key] = value;
      }
    }
    return metadata;
  }

  private _parseNanobotMetadata(raw: string | undefined): NanobotMeta {
    if (!raw || typeof raw !== 'string') return {};
    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      return (data.nanobot ?? data.openclaw ?? {}) as NanobotMeta;
    } catch {
      return {};
    }
  }

  private _checkRequirements(meta: NanobotMeta): boolean {
    const requires = meta.requires ?? {};
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

  private _getMissingRequirements(meta: NanobotMeta): string {
    const missing: string[] = [];
    const requires = meta.requires ?? {};
    for (const bin of requires.bins ?? []) {
      if (!this._which(bin)) missing.push(`CLI: ${bin}`);
    }
    for (const env of requires.env ?? []) {
      if (!process.env[env]) missing.push(`ENV: ${env}`);
    }
    return missing.join(', ');
  }

  private _stripFrontmatter(content: string): string {
    if (content.startsWith('---')) {
      const match = content.match(/^---\n.*?\n---\n/s);
      if (match) return content.slice(match[0].length).trim();
    }
    return content;
  }

  private _escapeXml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  clear(): void {
    this.skills.clear();
    logger.info('技能缓存已清空');
  }
}
