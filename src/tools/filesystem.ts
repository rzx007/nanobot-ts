/**
 * 文件系统工具
 * 
 * 读写文件的工具实现
 */

import path from 'path';
import fs from 'fs/promises';
import { Tool } from './base';
import type { Config } from '../config/schema';
import { expandHome, isPathInWorkspace, ensureDir } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * 文件系统工具基类
 * 
 * 提供工作区限制功能
 */
abstract class FileTool extends Tool {
  /** 配置 */
  protected config: Config;

  /** 工作区路径 */
  protected workspace: string;

  /**
   * 构造函数
   * 
   * @param config - 配置对象
   */
  constructor(config: Config) {
    super();
    this.config = config;
    this.workspace = expandHome(config.agents.defaults.workspace);
  }

  /**
   * 检查路径是否在工作区内
   * 
   * @param targetPath - 目标路径
   * @returns 是否在工作区内
   */
  protected isPathAllowed(targetPath: string): boolean {
    // 如果未启用工作区限制，总是允许
    if (!this.config.tools.restrictToWorkspace) {
      return true;
    }

    // 检查是否在工作区内
    return isPathInWorkspace(targetPath, this.workspace);
  }
}

/**
 * 读取文件工具
 */
export class ReadFileTool extends FileTool {
  name = 'read_file';

  description = '读取文件内容';

  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要读取的文件路径',
      },
    },
    required: ['path'],
  };

  async execute(params: { path: string }): Promise<string> {
    try {
      // 展开路径
      const fullPath = expandHome(params.path);

      // 检查权限
      if (!this.isPathAllowed(fullPath)) {
        return `Error: Path "${params.path}" is outside workspace`;
      }

      logger.info(`Reading file: ${fullPath}`);

      // 读取文件
      const content = await fs.readFile(fullPath, 'utf-8');

      return content;
    } catch (error) {
      const errorMsg = `Read file "${params.path}" failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return `Error: ${errorMsg}`;
    }
  }
}

/**
 * 写入文件工具
 */
export class WriteFileTool extends FileTool {
  name = 'write_file';

  description = '写入内容到文件';

  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要写入的文件路径',
      },
      content: {
        type: 'string',
        description: '要写入的内容',
      },
    },
    required: ['path', 'content'],
  };

  async execute(params: { path: string; content: string }): Promise<string> {
    try {
      // 展开路径
      const fullPath = expandHome(params.path);

      // 检查权限
      if (!this.isPathAllowed(fullPath)) {
        return `Error: Path "${params.path}" is outside workspace`;
      }

      logger.info(`Writing file: ${fullPath}`);

      // 确保目录存在
      const dirPath = path.dirname(fullPath);
      await ensureDir(dirPath);

      // 写入文件
      await fs.writeFile(fullPath, params.content, 'utf-8');

      return `File "${params.path}" written successfully`;
    } catch (error) {
      const errorMsg = `Write file "${params.path}" failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return `Error: ${errorMsg}`;
    }
  }
}

/**
 * 编辑文件工具
 */
export class EditFileTool extends FileTool {
  name = 'edit_file';

  description = '编辑文件中指定的字符串';

  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要编辑的文件路径',
      },
      oldStr: {
        type: 'string',
        description: '要替换的旧字符串',
      },
      newStr: {
        type: 'string',
        description: '新的字符串',
      },
    },
    required: ['path', 'oldStr', 'newStr'],
  };

  async execute(params: {
    path: string;
    oldStr: string;
    newStr: string;
  }): Promise<string> {
    try {
      // 展开路径
      const fullPath = expandHome(params.path);

      // 检查权限
      if (!this.isPathAllowed(fullPath)) {
        return `Error: Path "${params.path}" is outside workspace`;
      }

      logger.info(`Editing file: ${fullPath}`);

      // 读取文件
      const content = await fs.readFile(fullPath, 'utf-8');

      // 替换字符串
      const newContent = content.replace(params.oldStr, params.newStr);

      // 写入文件
      await fs.writeFile(fullPath, newContent, 'utf-8');

      return `File "${params.path}" edited successfully`;
    } catch (error) {
      const errorMsg = `Edit file "${params.path}" failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return `Error: ${errorMsg}`;
    }
  }
}

/**
 * 列出目录工具
 */
export class ListDirTool extends FileTool {
  name = 'list_dir';

  description = '列出目录内容';

  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要列出的目录路径',
      },
    },
    required: ['path'],
  };

  async execute(params: { path: string }): Promise<string> {
    try {
      // 展开路径
      const fullPath = expandHome(params.path);

      // 检查权限
      if (!this.isPathAllowed(fullPath)) {
        return `Error: Path "${params.path}" is outside workspace`;
      }

      logger.info(`Listing directory: ${fullPath}`);

      // 读取目录
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      // 格式化输出
      const output = entries
        .map((entry) => {
          const prefix = entry.isDirectory() ? '[DIR] ' : '      ';
          return `${prefix}${entry.name}`;
        })
        .join('\n');

      return output;
    } catch (error) {
      const errorMsg = `List directory "${params.path}" failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return `Error: ${errorMsg}`;
    }
  }
}
