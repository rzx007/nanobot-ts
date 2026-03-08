/**
 * 技能发现器
 *
 * 支持从远程 URL 获取技能索引，下载并安装技能到本地
 */

import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import type { Config } from '../config/schema';
import { expandHome, ensureDir } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * 技能索引条目
 */
export interface SkillIndexEntry {
  /** 技能名称 */
  name: string;

  /** 技能描述 */
  description: string;

  /** 技能文件列表 */
  files: string[];

  /** 版本号 */
  version?: string;

  /** 作者 */
  author?: string;
}

/**
 * 技能索引
 */
interface SkillIndex {
  skills: SkillIndexEntry[];
}

/**
 * 技能发现器
 */
export class SkillDiscoverer {
  private readonly skillsDir: string;
  private readonly cacheDir: string;

  constructor(config: Config) {
    this.skillsDir = path.join(expandHome(config.agents.defaults.workspace), 'skills');
    this.cacheDir = path.join(os.homedir(), '.nanobot', 'cache', 'skills');
  }

  /**
   * 从远程 URL 获取技能索引
   *
   * @param url - 技能仓库的 URL
   * @returns 技能索引条目数组
   */
  async discover(url: string): Promise<SkillIndexEntry[]> {
    const indexUrl = url.endsWith('/') ? `${url}index.json` : `${url}/index.json`;

    logger.info(`Fetching skill index from: ${indexUrl}`);

    try {
      const response = await fetch(indexUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch index: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as SkillIndex;

      if (!data.skills || !Array.isArray(data.skills)) {
        throw new Error('Invalid index format: missing or invalid skills array');
      }

      // 验证每个技能条目的必需字段
      const validSkills = data.skills.filter(skill => {
        if (!skill?.name || !Array.isArray(skill.files)) {
          logger.warn({ skill }, 'Invalid skill entry, skipping');
          return false;
        }
        return true;
      });

      logger.info(`Found ${validSkills.length} skills in index`);
      return validSkills;
    } catch (error) {
      logger.error({ err: error, url }, 'Failed to discover skills');
      throw error;
    }
  }

  /**
   * 下载并安装指定技能
   *
   * @param skillName - 要安装的技能名称
   * @param baseUrl - 技能仓库的基础 URL
   * @returns Promise<void>
   */
  async install(skillName: string, baseUrl: string): Promise<void> {
    const cachePath = path.join(this.cacheDir, skillName);
    const installPath = path.join(this.skillsDir, skillName);

    // 检查是否已安装
    if (await this.isInstalled(skillName)) {
      throw new Error(`Skill "${skillName}" is already installed`);
    }

    logger.info(`Installing skill: ${skillName}`);

    // 获取技能索引
    const skills = await this.discover(baseUrl);
    const skill = skills.find(s => s.name === skillName);

    if (!skill) {
      throw new Error(`Skill "${skillName}" not found in index`);
    }

    // 确保目录存在
    await ensureDir(cachePath);
    await ensureDir(installPath);

    // 下载所有文件
    for (const file of skill.files) {
      const fileUrl = new URL(file, `${baseUrl}/${skillName}/`).href;
      const destPath = path.join(installPath, file);

      logger.info(`Downloading: ${fileUrl}`);

      try {
        const response = await fetch(fileUrl);

        if (!response.ok) {
          throw new Error(`Failed to download ${file}: ${response.status}`);
        }

        // 确保目标目录存在
        await ensureDir(path.dirname(destPath));

        // 写入文件
        await fs.writeFile(destPath, new Uint8Array(await response.arrayBuffer()));
        logger.debug(`Downloaded: ${file} -> ${destPath}`);
      } catch (error) {
        logger.error({ err: error, file: fileUrl }, 'Failed to download skill file');
        throw new Error(
          `Failed to download ${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // 验证安装
    const skillFile = path.join(installPath, 'SKILL.md');
    const exists = await fs
      .pathExists(skillFile)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      throw new Error(`Installation validation failed: SKILL.md not found`);
    }

    logger.info(`Skill "${skillName}" installed successfully`);
  }

  /**
   * 检查技能是否已安装
   *
   * @param skillName - 技能名称
   * @returns 是否已安装
   */
  async isInstalled(skillName: string): Promise<boolean> {
    const skillPath = path.join(this.skillsDir, skillName);
    const skillFile = path.join(skillPath, 'SKILL.md');
    return fs
      .pathExists(skillFile)
      .then(() => true)
      .catch(() => false);
  }

  /**
   * 卸载技能
   *
   * @param skillName - 要卸载的技能名称
   * @returns Promise<void>
   */
  async uninstall(skillName: string): Promise<void> {
    const skillPath = path.join(this.skillsDir, skillName);

    try {
      await fs.remove(skillPath);
      logger.info(`Skill "${skillName}" uninstalled successfully`);
    } catch (error) {
      logger.error({ err: error, skillName }, 'Failed to uninstall skill');
      throw new Error(
        `Failed to uninstall skill "${skillName}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 清理缓存目录
   *
   * @returns Promise<void>
   */
  async clearCache(): Promise<void> {
    try {
      await fs.remove(this.cacheDir);
      logger.info('Skill cache cleared');
    } catch (error) {
      logger.error({ err: error }, 'Failed to clear skill cache');
      throw error;
    }
  }
}
