/**
 * 浏览器自动化工具
 * 访问https://mp.weixin.qq.com/s/s4zCjnhZ-qBB_hSI3hfxhg 获取文档内容，存放到openclaw-setup.md, 现在浏览器可以用了
 * 通过 agent-browser CLI 实现浏览器自动化能力
 */

import { Tool } from './base';
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { Config } from '@nanobot/shared';
import { RiskLevel } from './safety';
import { logger } from '@nanobot/logger';

/**
 * 浏览器工具基类
 *
 * 提供统一的 agent-browser CLI 调用接口
 */
abstract class BrowserTool extends Tool {
  /** 配置对象 */
  protected config: Config;

  /** 会话名称（用于隔离不同聊天会话） */
  protected sessionName?: string;

  constructor(config: Config) {
    super();
    this.config = config;
  }

  /**
   * 设置会话名称（用于会话隔离）
   */
  setSessionName(name: string): void {
    this.sessionName = name;
  }

  /**
   * 构建 agent-browser 命令参数数组
   */
  protected buildCommandArgs(
    args: string[],
    options: {
      json?: boolean;
      session?: string;
    } = {},
  ): string[] {
    const parts: string[] = ['agent-browser'];

    if (options.json) parts.push('--json');
    if (options.session) {
      parts.push('--session');
      parts.push(options.session);
    }
    parts.push(...args);

    return parts;
  }

  /**
   * 执行 agent-browser 命令
   */
  protected async executeCommand(
    args: string[],
    options: {
      stdin?: string;
      timeoutMs?: number;
      retries?: number;
    } = {},
  ): Promise<string> {
    const { stdin, timeoutMs, retries = 0 } = options;

    try {
      // 基础超时时间（秒）
      let timeoutSeconds = this.config.tools.browser?.timeout ?? 60;

      // 如果参数包含 networkidle，增加超时时间
      if (args.includes('networkidle')) {
        timeoutSeconds = Math.max(timeoutSeconds, 120);
      }

      // 如果参数包含 open，增加超时时间
      if (args.includes('open')) {
        timeoutSeconds = Math.max(timeoutSeconds, 90);
      }

      const timeout = timeoutMs ?? timeoutSeconds * 1000;

      const commandStr = args.join(' ');
      logger.info(`🐼🐼🐼 Executing browser command (timeout ${timeoutSeconds}s): ${commandStr}`);

      const execaOptions: Record<string, unknown> = {
        timeout,
        shell: false,
      };

      if (stdin !== undefined) {
        execaOptions.input = stdin;
      }

      const result = await execa(args[0] ?? 'agent-browser', args.slice(1), execaOptions);
      logger.info("🪼🪼🪼 BrowserTool ~ executeCommand ~ result:", JSON.stringify(result, null, 2))
      if (result.exitCode !== 0) {
        const stderr = result.stderr || 'Unknown error';
        return `Error: Browser command failed (exit code ${result.exitCode}): ${stderr}`;
      }

      const output = (result.stdout || '') + (result.stderr ? `\n${result.stderr}` : '');

      if (this.config.tools.browser?.contentBoundaries && output.length > 100) {
        return this.wrapWithContentBoundaries(output);
      }

      const maxOutput = this.config.tools.browser?.maxOutput ?? 50000;
      if (output.length > maxOutput) {
        return output.slice(0, maxOutput) + '\n... (output truncated)';
      }

      return output;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'ExecaTimeoutError') {
          const timeoutVal = timeoutMs ?? (this.config.tools.browser?.timeout ?? 60) * 1000;
          return `Error: Browser operation timeout after ${timeoutVal / 1000}s. You may need to increase the timeout or use a different wait strategy.`;
        }

        // 尝试重试
        if (retries > 0) {
          logger.warn(
            `Browser command failed, retrying... (${retries} attempts remaining): ${error.message}`,
          );
          const retryOptions: { stdin?: string; timeoutMs?: number; retries: number } = {
            retries: retries - 1,
          };
          if (stdin !== undefined) retryOptions.stdin = stdin;
          if (timeoutMs !== undefined) retryOptions.timeoutMs = timeoutMs;
          return await this.executeCommand(args, retryOptions);
        }

        return `Error: ${error.message}`;
      }
      return `Error: ${String(error)}`;
    }
  }

  /**
   * 包装内容边界标记（用于 AI 安全）
   */
  private wrapWithContentBoundaries(content: string): string {
    const nonce = Math.random().toString(36).substring(2);
    return `--- AGENT_BROWSER_PAGE_CONTENT nonce=${nonce} ---\n${content}\n--- END_AGENT_BROWSER_PAGE_CONTENT nonce=${nonce} ---`;
  }

  /**
   * 获取默认会话名称
   */
  protected getDefaultSession(): string {
    return this.sessionName ?? this.config.tools.browser?.defaultSession ?? 'default';
  }

  /**
   * 展开 ~ 路径为完整路径
   */
  protected expandHome(filePath: string): string {
    if (filePath.startsWith('~')) {
      return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
  }

  /**
   * 获取完整的下载基础路径（workspace + downloadPath）
   */
  protected getDownloadBasePath(): string {
    const workspace = this.expandHome(this.config.agents.defaults.workspace);
    const downloadPath = this.config.tools.browser?.downloadPath ?? './downloads';
    return path.join(workspace, downloadPath);
  }

  /**
   * 确保目录存在
   */
  protected async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  /**
   * 从 URL 提取域名（用作文件名前缀）
   */
  protected extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      hostname = hostname.replace(/^www\./, '');
      return hostname.replace(/\./g, '-');
    } catch {
      return 'screenshot';
    }
  }

  /**
   * 生成毫秒级时间戳字符串
   */
  protected generateTimestamp(): string {
    const now = new Date();
    const iso = now.toISOString();
    const date = iso.split('T')[0];
    const timePart = iso.split('T')[1];
    const time = timePart?.split('.')[0]?.replace(/:/g, '-') ?? '00-00-00';
    const msPart = timePart?.split('.')[1];
    const ms = (msPart?.replace('Z', '') ?? '000').padStart(3, '0');
    return `${date}-${time}-${ms}`;
  }

  /**
   * 获取当前浏览器 URL
   */
  protected async getCurrentUrl(): Promise<string | null> {
    try {
      const args = this.buildCommandArgs(['get', 'url']);
      const result = await this.executeCommand(args);

      if (result.startsWith('Error:')) {
        return null;
      }

      return result.trim();
    } catch {
      return null;
    }
  }
}

// ==================== 导航类工具 ====================

export class BrowserOpenTool extends BrowserTool {
  name = 'browser_open';
  riskLevel = RiskLevel.LOW;
  description =
    '打开浏览器并导航到指定 URL。支持指定会话名称、有头模式等。使用场景：需要访问网页进行交互操作（如登录、填写表单、浏览内容等）。重要提示：页面打开后会自动等待加载完成（使用配置中的 waitForLoad 策略，默认 networkidle），等待完成后即可直接使用其他浏览器工具（如 browser_snapshot、browser_fill、browser_click、browser_screenshot 等），无需再次调用 browser_wait。如果需要立即进行交互操作，可以直接在打开后调用相应工具，不需要额外的检查步骤。';


  parameters = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '目标 URL（不包含协议时自动添加 https://）',
      },
      sessionName: {
        type: 'string',
        description: '会话名称（用于隔离不同聊天会话）',
      },
      headed: {
        type: 'boolean',
        description: '是否显示浏览器窗口（调试用）',
      },
      wait: {
        type: 'string',
        enum: ['load', 'domcontentloaded', 'networkidle'],
        description:
          '等待页面加载策略：load（等待 load 事件）、domcontentloaded（等待 DOM 加载）、networkidle（等待网络空闲，默认）',
      },
    },
    required: ['url'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { url, sessionName, headed, wait } = params;

    const session = (sessionName ?? this.getDefaultSession()) as string;
    this.setSessionName(session);

    const downloadDir = this.getDownloadBasePath();
    await this.ensureDir(downloadDir);

    const args: string[] = ['open', url as string];
    if (headed) args.push('--headed');

    const commandArgs = [
      'agent-browser',
      '--session',
      session,
      '--download-path',
      downloadDir,
      ...args,
    ];
    const result = await this.executeCommand(commandArgs);

    if (result.startsWith('Error:')) {
      return `打开浏览器失败（${url}）：${result}\n可能原因：未安装 agent-browser、Chrome/Chromium 未安装或路径不可用、网络或目标地址不可达。请检查环境后重试。`;
    }

    let finalResult = result;
    let waitResult = '';

    if (wait) {
      const waitStrategy = wait as string;
      const waitArgs = this.buildCommandArgs(['wait', '--load', waitStrategy], { session });
      waitResult = await this.executeCommand(waitArgs);
    } else {
      const defaultWait = this.config.tools.browser?.waitForLoad;
      if (defaultWait) {
        const waitArgs = this.buildCommandArgs(['wait', '--load', defaultWait], { session });
        waitResult = await this.executeCommand(waitArgs);
      }
    }

    if (waitResult) {
      finalResult = result + '\n' + waitResult;
    }

    return finalResult + '\n\n浏览器已成功打开页面，现在可以使用其他浏览器工具进行操作。';
  }
}

export class BrowserCloseTool extends BrowserTool {
  name = 'browser_close';
  description =
    '关闭浏览器会话。如果不指定会话名称，关闭当前会话。重要提示：关闭会话后，所有的元素引用（@e1 等）都会失效。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      sessionName: {
        type: 'string',
        description: '会话名称（可选）',
      },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { sessionName } = params;
    const session = (sessionName ?? this.getDefaultSession()) as string;

    const args = this.buildCommandArgs(['close'], { session });
    return await this.executeCommand(args);
  }
}

// ==================== 页面快照类工具 ====================

export class BrowserSnapshotTool extends BrowserTool {
  name = 'browser_snapshot';
  description =
    '获取页面的结构化快照，返回可交互元素的引用标记（如 @e1, @e2）。使用场景：需要填写表单、点击特定元素、交互前了解页面结构时使用。重要提示：一次调用即可获取完整信息，不要多次调用此工具。页面变化后（如点击导航、提交表单）才需要重新获取快照。如果只是需要截图或查看页面视觉效果，请使用 browser_screenshot 而非此工具。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      interactive: {
        type: 'boolean',
        description: '只显示可交互元素（推荐）',
      },
      cursorInteractive: {
        type: 'boolean',
        description: '包含鼠标交互元素（cursor:pointer, onclick, tabindex）',
      },
      compact: {
        type: 'boolean',
        description: '紧凑格式（移除空结构元素，减少 token）',
      },
      depth: {
        type: 'number',
        description: '限制树深度（减少 token）',
      },
      selector: {
        type: 'string',
        description: 'CSS 选择器，限制快照范围（注意：选择器不需要加引号，直接传入即可）',
      },
      json: {
        type: 'boolean',
        description: 'JSON 格式输出',
      },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const {
      interactive = true,
      cursorInteractive = false,
      compact = false,
      depth,
      selector,
      json = false,
    } = params;

    const args: string[] = ['snapshot'];
    if (interactive) args.push('-i');
    if (cursorInteractive) args.push('-C');
    if (compact) args.push('-c');
    if (depth) args.push('-d', String(depth));
    if (selector) {
      args.push('-s', selector as string);
    }

    return await this.executeCommand(this.buildCommandArgs(args, { json: json as boolean }));
  }
}

// ==================== 交互类工具 ====================

export class BrowserClickTool extends BrowserTool {
  name = 'browser_click';
  description =
    '点击页面元素。支持元素引用（@e1）或 CSS 选择器。重要提示：点击链接或提交表单后，页面可能发生变化或导航，需要重新使用 browser_snapshot 获取新的元素引用。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      element: {
        type: 'string',
        description: '元素引用（如 @e1）或 CSS 选择器',
      },
      newTab: {
        type: 'boolean',
        description: '在新标签页中打开链接',
      },
    },
    required: ['element'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { element, newTab } = params;

    const args: string[] = ['click', element as string];
    if (newTab) args.push('--new-tab');

    return await this.executeCommand(this.buildCommandArgs(args));
  }
}

export class BrowserFillTool extends BrowserTool {
  name = 'browser_fill';
  description =
    '填写表单字段。会先清空输入框，然后输入文本。支持的字段类型：文本输入框（<input type="text">）、邮箱输入框（<input type="email">）、密码输入框（<input type="password">）、文本域（<textarea>）。重要提示：文本中如果包含特殊字符或引号，会被自动处理。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      element: {
        type: 'string',
        description: '元素引用（如 @e1）或 CSS 选择器',
      },
      text: {
        type: 'string',
        description: '要填写的文本',
      },
    },
    required: ['element', 'text'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { element, text } = params;

    const args = this.buildCommandArgs(['fill', element as string, text as string]);
    return await this.executeCommand(args);
  }
}

export class BrowserTypeTool extends BrowserTool {
  name = 'browser_type';
  description =
    '在当前焦点输入文本，不清空原有内容。重要提示：文本中如果包含特殊字符或引号，会被自动处理。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      element: {
        type: 'string',
        description: '元素引用（如 @e1）或 CSS 选择器',
      },
      text: {
        type: 'string',
        description: '要输入的文本',
      },
    },
    required: ['element', 'text'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { element, text } = params;

    const args = this.buildCommandArgs(['type', element as string, text as string]);
    return await this.executeCommand(args);
  }
}

// ==================== 截图类工具 ====================

export class BrowserScreenshotTool extends BrowserTool {
  name = 'browser_screenshot';
  description =
    '截取页面截图并返回图片路径。使用场景：用户明确要求"截图"或"截屏"时必须使用此工具、保存页面当前状态、调试页面问题、展示页面内容给用户查看。功能：全页截图（包括滚动区域）、元素截图（使用选择器）、标注模式（标注元素引用，用于视觉模型）。重要提示：当用户说"截图"、"截图给我"、"截个屏"、"把页面截下来"等类似表述时，请直接使用此工具，不要使用其他工具（如 browser_get）代替。如果未指定 path 参数，截图会自动保存到工作空间的 downloadPath/screenshots/ 目录（默认 ~/.nanobot/workspace/downloads/screenshots/），文件名格式为 {域名}-{时间戳}.png（例如：baidu-2026-03-04-15-27-00-123.png）。返回的信息会包含完整的文件路径。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      full: {
        type: 'boolean',
        description: '全页截图（包括滚动区域）',
      },
      selector: {
        type: 'string',
        description: 'CSS 选择器或元素引用（截取特定元素，注意：选择器不需要加引号）',
      },
      annotate: {
        type: 'boolean',
        description: '标注模式（标注元素引用）',
      },
      path: {
        type: 'string',
        description: '保存路径',
      },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { full, annotate, path: userPath, selector } = params;

    let filePath = userPath as string;
    if (!filePath) {
      const screenshotDir = path.join(this.getDownloadBasePath(), 'screenshots');
      await this.ensureDir(screenshotDir);

      const currentUrl = await this.getCurrentUrl();
      const domain = this.extractDomain(currentUrl ?? 'unknown');
      const timestamp = this.generateTimestamp();

      filePath = path.join(screenshotDir, `${domain}-${timestamp}.png`);
    }

    const args: string[] = ['screenshot'];
    if (full) args.push('--full');
    if (annotate) args.push('--annotate');
    if (selector) args.push('--selector', selector as string);
    args.push(filePath);

    const result = await this.executeCommand(this.buildCommandArgs(args));

    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(process.cwd(), absolutePath);

    return `${result}\nAbsolute path: ${absolutePath}\nRelative path: ${relativePath}`;
  }
}

// ==================== 等待类工具 ====================

export class BrowserWaitTool extends BrowserTool {
  name = 'browser_wait';
  description =
    '等待特定条件。支持等待元素、页面加载、URL 变化、时间延迟。使用场景：等待元素出现、等待页面加载完成、等待 URL 变化（如跳转到登录后的页面）、固定时间延迟。重要提示：对于动态加载的页面，建议使用 --load networkidle 等待网络空闲；对于快速响应的页面，可以使用 --load domcontentloaded。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      element: {
        type: 'string',
        description: 'CSS 选择器或元素引用（等待元素出现）',
      },
      load: {
        type: 'string',
        enum: ['load', 'domcontentloaded', 'networkidle'],
        description: '等待页面加载状态',
      },
      url: {
        type: 'string',
        description: '等待 URL 匹配（支持通配符，如 **/dashboard，注意：不需要加引号）',
      },
      timeout: {
        type: 'number',
        description: '固定时间延迟（毫秒）',
      },
    },
    required: [],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { element, load, url, timeout } = params;

    const args: string[] = ['wait'];
    if (element) args.push(element as string);
    if (load) args.push('--load', load as string);
    if (url) args.push('--url', url as string);
    if (timeout) args.push(String(timeout));

    return await this.executeCommand(this.buildCommandArgs(args));
  }
}

// ==================== 获取信息类工具 ====================

export class BrowserGetTool extends BrowserTool {
  name = 'browser_get';
  description =
    '获取页面的文本信息。支持的类型：text（元素文本）、url（当前页面 URL）、title（页面标题）、html（元素 HTML）、value（表单字段值）、attr <name>（元素属性值）。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['text', 'url', 'title', 'html', 'value', 'attr'],
        description: '获取类型',
      },
      attribute: {
        type: 'string',
        description: '属性名称（type=attr 时必需）',
      },
      selector: {
        type: 'string',
        description: 'CSS 选择器或元素引用（type=text/html/value/attr 时必需）',
      },
    },
    required: ['type'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { type, attribute, selector } = params;

    const args: string[] = ['get', type as string];
    if (type === 'attr' && attribute) args.push(attribute as string);
    if (selector) args.push(selector as string);

    return await this.executeCommand(this.buildCommandArgs(args));
  }
}

export class BrowserEvalTool extends BrowserTool {
  name = 'browser_eval';
  description =
    '在浏览器上下文中执行 JavaScript 代码。返回执行结果。重要提示：代码会通过 stdin 传递，自动避免 shell 转义问题。支持复杂的 JavaScript 表达式，包括箭头函数、模板字符串等。';
  riskLevel = RiskLevel.HIGH;

  parameters = {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript 代码（会自动通过 stdin 传递，无需担心特殊字符转义）',
      },
    },
    required: ['code'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { code } = params;

    const args = this.buildCommandArgs(['eval', '--stdin']);
    return await this.executeCommand(args, { stdin: code as string, retries: 1 });
  }
}

export class BrowserPressTool extends BrowserTool {
  name = 'browser_press';
  description = '按键操作。支持 Enter、Tab、Escape、ArrowUp、ArrowDown 等键。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: '按键名称（如 Enter、Tab、Escape、ArrowUp、ArrowDown、PageUp、PageDown）',
      },
    },
    required: ['key'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { key } = params;

    const args = this.buildCommandArgs(['press', key as string]);
    return await this.executeCommand(args);
  }
}

export class BrowserSelectTool extends BrowserTool {
  name = 'browser_select';
  description = '选择下拉选项。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      element: {
        type: 'string',
        description: '元素引用（如 @e1）或 CSS 选择器',
      },
      value: {
        type: 'string',
        description: '要选择的选项值',
      },
    },
    required: ['element', 'value'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { element, value } = params;

    const args = this.buildCommandArgs(['select', element as string, value as string]);
    return await this.executeCommand(args);
  }
}

export class BrowserCheckTool extends BrowserTool {
  name = 'browser_check';
  description = '勾选复选框。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      element: {
        type: 'string',
        description: '元素引用（如 @e1）或 CSS 选择器',
      },
    },
    required: ['element'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { element } = params;

    const args = this.buildCommandArgs(['check', element as string]);
    return await this.executeCommand(args);
  }
}

export class BrowserUncheckTool extends BrowserTool {
  name = 'browser_uncheck';
  description = '取消勾选复选框。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      element: {
        type: 'string',
        description: '元素引用（如 @e1）或 CSS 选择器',
      },
    },
    required: ['element'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { element } = params;

    const args = this.buildCommandArgs(['uncheck', element as string]);
    return await this.executeCommand(args);
  }
}

export class BrowserScrollTool extends BrowserTool {
  name = 'browser_scroll';
  description = '滚动页面。支持方向：up（上）、down（下）、left（左）、right（右）。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      direction: {
        type: 'string',
        enum: ['up', 'down', 'left', 'right'],
        description: '滚动方向',
      },
      pixels: {
        type: 'number',
        description: '滚动像素数（默认 500）',
      },
    },
    required: ['direction'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { direction, pixels } = params;

    const args: string[] = ['scroll', direction as string];
    if (pixels) args.push(String(pixels));

    return await this.executeCommand(this.buildCommandArgs(args));
  }
}

export class BrowserBackTool extends BrowserTool {
  name = 'browser_back';
  description =
    '返回上一页。重要提示：返回后页面会变化，需要重新使用 browser_snapshot 获取元素引用。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {},
    required: [],
  };

  async execute(): Promise<string> {
    return await this.executeCommand(this.buildCommandArgs(['back']));
  }
}

export class BrowserForwardTool extends BrowserTool {
  name = 'browser_forward';
  description =
    '前进到下一页。重要提示：前进后页面会变化，需要重新使用 browser_snapshot 获取元素引用。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {},
    required: [],
  };

  async execute(): Promise<string> {
    return await this.executeCommand(this.buildCommandArgs(['forward']));
  }
}

export class BrowserReloadTool extends BrowserTool {
  name = 'browser_reload';
  description =
    '刷新当前页面。重要提示：刷新后页面会变化，需要重新使用 browser_snapshot 获取元素引用。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {},
    required: [],
  };

  async execute(): Promise<string> {
    return await this.executeCommand(this.buildCommandArgs(['reload']));
  }
}

export class BrowserPdfTool extends BrowserTool {
  name = 'browser_pdf';
  description = '将页面导出为 PDF 文件。返回的信息会包含完整的文件路径。';
  riskLevel = RiskLevel.LOW;

  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '保存路径',
      },
    },
    required: ['path'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { path: userPath } = params;

    const args = this.buildCommandArgs(['pdf', userPath as string]);
    const result = await this.executeCommand(args);

    const absolutePath = path.resolve(userPath as string);
    const relativePath = path.relative(process.cwd(), absolutePath);

    return `${result}\nAbsolute path: ${absolutePath}\nRelative path: ${relativePath}`;
  }
}
