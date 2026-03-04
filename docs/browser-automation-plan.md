根据我之前的分析和规划，这里是完整的浏览器自动化集成计划文档：

---

# Nanobot-TS 浏览器自动化集成计划

## 📋 项目概述

为 **nanobot-ts** 添加浏览器自动化能力，使其能够通过自然语言指令控制浏览器，完成网页访问、表单填写、数据抓取、页面交互等任务。

## 🎯 技术选型

### 核心技术：agent-browser

**选择理由：**

1. **Vercel Labs 官方出品** - 代码质量有保障
2. **专为 AI Agent 设计** - 独特的 snapshot + refs 系统，AI 友好
3. **CLI 架构** - 通过守护进程自动管理浏览器状态
4. **功能完整** - 50+ 种浏览器操作
5. **跨平台支持** - Windows、macOS、Linux
6. **云浏览器支持** - Browserbase、Browser Use、Kernel
7. **活跃的社区** - GitHub 7.2K+ stars
8. **已安装** - nanobot-ts 已安装 agent-browser@0.16.1

## 🏗️ 架构设计

### 1. 设计原则

1. **与现有工具模式一致**：通过 `execaCommand` 调用 agent-browser CLI
2. **利用 agent-browser 原生能力**：会话管理、认证、快照等
3. **最小化依赖**：不额外安装 playwright-core
4. **易于维护**：复用现有基础设施（工具注册、错误处理、审批流程）

### 2. 目录结构

```
nanobot-ts/
├── src/
│   ├── tools/
│   │   ├── browser.ts              # 浏览器工具实现（单个文件）
│   │   ├── base.ts                # 工具基类（已存在）
│   │   ├── shell.ts               # Shell 工具参考（已存在）
│   │   └── index.ts               # 工具导出（需更新）
│   ├── config/
│   │   └── schema.ts              # 添加浏览器配置
│   └── cli/
│       └── setup.ts               # 注册浏览器工具（需更新）
├── skills/
│   └── agent-browser/             # 技能文档（可选）
└── package.json                   # 依赖已存在（agent-browser@0.16.1）
```

**设计决策：**

- **单文件实现**：类似 `web.ts`（包含 WebSearchTool 和 WebFetchTool），`browser.ts` 包含所有浏览器工具
- **避免过度设计**：不需要独立的 browser/ 目录、BrowserManager 单例、连接池等
- **利用守护进程**：agent-browser 通过后台守护进程自动管理浏览器

### 3. 核心实现

#### 3.1 配置扩展

```typescript
// src/config/schema.ts

export const BrowserConfigSchema = z.object({
  /** 是否启用浏览器工具 */
  enabled: z.boolean().default(false),

  /** 默认等待策略 */
  waitForLoad: z.enum(['load', 'domcontentloaded', 'networkidle']).default('networkidle'),

  /** 超时时间（秒） */
  timeout: z.number().int().positive().default(60),

  /** 默认下载路径 */
  downloadPath: z.string().default('./downloads'),

  /** 允许的域名白名单（逗号分隔，支持通配符 *.example.com） */
  allowedDomains: z.array(z.string()).default([]),

  /** 是否启用内容边界标记（用于 AI 安全） */
  contentBoundaries: z.boolean().default(true),

  /** 最大输出字符数（防止上下文溢出） */
  maxOutput: z.number().int().positive().default(50000),

  /** 是否有头模式（显示浏览器窗口） */
  headed: z.boolean().default(false),

  /** 默认会话名称（用于隔离不同聊天会话） */
  defaultSession: z.string().default('default'),
});

// 更新 ToolsConfigSchema
export const ToolsConfigSchema = z.object({
  restrictToWorkspace: z.boolean().default(false),
  exec: ExecConfigSchema,
  web: WebConfigSchema,
  browser: BrowserConfigSchema.optional(),  // 新增
  approval: ApprovalConfigSchema,
});
```

#### 3.2 工具基类

```typescript
// src/tools/browser.ts

import { Tool } from './base';
import { execaCommand } from 'execa';
import type { Config } from '../config/schema';
import { RiskLevel } from './safety';
import { logger } from '../utils/logger';

/**
 * 浏览器工具基类
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
   * 设置会话名称
   */
  setSessionName(name: string): void {
    this.sessionName = name;
  }

  /**
   * 构建 agent-browser 命令
   */
  protected buildCommand(
    args: string[],
    options: {
      json?: boolean;
      session?: string;
    } = {}
  ): string {
    const parts: string[] = ['agent-browser'];

    if (options.json) parts.push('--json');
    if (options.session) parts.push(`--session ${options.session}`);
    parts.push(...args);

    return parts.join(' ');
  }

  /**
   * 执行 agent-browser 命令
   */
  protected async executeCommand(
    command: string,
    timeoutMs?: number
  ): Promise<string> {
    try {
      const timeout = timeoutMs ?? (this.config.tools.browser?.timeout ?? 60) * 1000;

      logger.info(`Executing browser command: ${command}`);

      const result = await execaCommand(command, {
        shell: true,
        timeout,
      });

      // 检查退出码
      if (result.exitCode !== 0) {
        const stderr = result.stderr || 'Unknown error';
        return `Error: Browser command failed (exit code ${result.exitCode}): ${stderr}`;
      }

      const output = (result.stdout || '') + (result.stderr ? `\n${result.stderr}` : '');

      // 应用内容边界标记
      if (this.config.tools.browser?.contentBoundaries && output.length > 100) {
        return this.wrapWithContentBoundaries(output);
      }

      // 应用输出长度限制
      const maxOutput = this.config.tools.browser?.maxOutput ?? 50000;
      if (output.length > maxOutput) {
        return output.slice(0, maxOutput) + '\n... (output truncated)';
      }

      return output;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'ExecaTimeoutError') {
          return `Error: Browser operation timeout after ${timeoutMs / 1000}s`;
        }
        return `Error: ${error.message}`;
      }
      return `Error: ${String(error)}`;
    }
  }

  /**
   * 包装内容边界标记
   */
  private wrapWithContentBoundaries(content: string): string {
    const nonce = Math.random().toString(36).substring(2);
    return `--- AGENT_BROWSER_PAGE_CONTENT nonce=${nonce} ---\n${content}\n--- END_AGENT_BROWSER_PAGE_CONTENT nonce=${nonce} ---`;
  }

  /**
   * 获取默认会话名称
   */
  protected getDefaultSession(): string {
    return this.sessionName || this.config.tools.browser?.defaultSession || 'default';
  }
}
```

#### 3.3 工具实现示例

```typescript
// ==================== 导航类工具 ====================

/**
 * 打开浏览器并导航
 */
export class BrowserOpenTool extends BrowserTool {
  name = 'browser_open';
  description = '打开浏览器并导航到指定 URL。支持指定会话名称、等待策略、有头模式等。';
  riskLevel = RiskLevel.MEDIUM;

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
      waitForLoad: {
        type: 'string',
        enum: ['load', 'domcontentloaded', 'networkidle'],
        description: '等待策略',
      },
    },
    required: ['url'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { url, sessionName, headed, waitForLoad } = params;
    
    const session = sessionName || this.getDefaultSession();
    this.setSessionName(session as string);

    const args: string[] = ['open', url as string];
    if (headed) args.push('--headed');
    
    const command = this.buildCommand(args, { session });
    return await this.executeCommand(command);
  }
}

/**
 * 关闭浏览器
 */
export class BrowserCloseTool extends BrowserTool {
  name = 'browser_close';
  description = '关闭浏览器会话。如果不指定会话名称，关闭当前会话。';
  riskLevel = RiskLevel.MEDIUM;

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
    const session = sessionName || this.getDefaultSession();
    
    const command = this.buildCommand(['close'], { session });
    return await this.executeCommand(command);
  }
}

// ==================== 页面快照类工具 ====================

/**
 * 获取页面快照
 */
export class BrowserSnapshotTool extends BrowserTool {
  name = 'browser_snapshot';
  description = `
获取页面的结构化快照，返回可交互元素的引用标记（如 @e1, @e2）。

使用场景：
- 理解页面结构
- 发现可交互元素
- 获取元素引用用于后续操作

注意事项：
- 页面变化后需要重新获取快照
- 引用（@e1 等）在页面变化后失效
`.trim();

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
        description: 'CSS 选择器，限制快照范围',
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
    if (depth) args.push(`-d ${depth}`);
    if (selector) args.push(`-s "${selector}"`);

    const command = this.buildCommand(args, {
      json,
      session: this.getDefaultSession(),
    });

    return await this.executeCommand(command);
  }
}

// ==================== 交互类工具 ====================

/**
 * 点击元素
 */
export class BrowserClickTool extends BrowserTool {
  name = 'browser_click';
  description = '点击页面元素。支持元素引用（@e1）或 CSS 选择器。';
  riskLevel = RiskLevel.MEDIUM;

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

    const command = this.buildCommand(args, { session: this.getDefaultSession() });
    return await this.executeCommand(command);
  }
}

/**
 * 填写表单字段
 */
export class BrowserFillTool extends BrowserTool {
  name = 'browser_fill';
  description = '填写表单字段。会先清空输入框，然后输入文本。';
  riskLevel = RiskLevel.HIGH;

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
    
    const command = this.buildCommand(
      ['fill', element as string, text as string],
      { session: this.getDefaultSession() }
    );

    return await this.executeCommand(command);
  }
}

// ==================== 截图类工具 ====================

/**
 * 截取页面截图
 */
export class BrowserScreenshotTool extends BrowserTool {
  name = 'browser_screenshot';
  description = '截取页面截图。支持全页截图、元素截图、标注模式。';
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
        description: 'CSS 选择器或元素引用（截取特定元素）',
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
    const { full, selector, annotate, path } = params;

    const args: string[] = ['screenshot'];
    if (full) args.push('--full');
    if (annotate) args.push('--annotate');
    if (path) args.push(path as string);

    const command = this.buildCommand(args, { session: this.getDefaultSession() });
    return await this.executeCommand(command);
  }
}

// ==================== 等待类工具 ====================

/**
 * 等待条件
 */
export class BrowserWaitTool extends BrowserTool {
  name = 'browser_wait';
  description = '等待特定条件。支持等待元素、页面加载、URL 变化、时间延迟。';
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
        description: '等待 URL 匹配（支持通配符，如 **/dashboard）',
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
    if (load) args.push(`--load ${load}`);
    if (url) args.push(`--url "${url}"`);
    if (timeout) args.push(timeout as string);

    const command = this.buildCommand(args, { session: this.getDefaultSession() });
    return await this.executeCommand(command);
  }
}

// ==================== 获取信息类工具 ====================

/**
 * 获取页面信息
 */
export class BrowserGetTool extends BrowserTool {
  name = 'browser_get';
  description = '获取页面信息。支持获取文本、URL、标题等。';
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

    const command = this.buildCommand(args, { session: this.getDefaultSession() });
    return await this.executeCommand(command);
  }
}

/**
 * 执行 JavaScript
 */
export class BrowserEvalTool extends BrowserTool {
  name = 'browser_eval';
  description = '在浏览器上下文中执行 JavaScript 代码。返回执行结果。';
  riskLevel = RiskLevel.HIGH;

  parameters = {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript 代码',
      },
    },
    required: ['code'],
  };

  async execute(params: Record<string, unknown>): Promise<string> {
    const { code } = params;

    const command = this.buildCommand(
      ['eval', code as string],
      { session: this.getDefaultSession() }
    );

    return await this.executeCommand(command);
  }
}
```

### 4. 工具列表

根据 agent-browser CLI 命令，创建以下工具（30+ 个）：

| 工具名称 | agent-browser 命令 | 功能描述 | 风险级别 |
|---------|-------------------|---------|---------|
| browser_open | open | 打开浏览器并导航 | MEDIUM |
| browser_close | close | 关闭浏览器会话 | MEDIUM |
| browser_snapshot | snapshot | 获取页面快照 | LOW |
| browser_click | click | 点击元素 | MEDIUM |
| browser_dblclick | dblclick | 双击元素 | MEDIUM |
| browser_fill | fill | 填写表单字段 | HIGH |
| browser_type | type | 输入文本（不清空） | MEDIUM |
| browser_press | press | 按键（Enter, Tab 等） | LOW |
| browser_select | select | 选择下拉选项 | MEDIUM |
| browser_check | check | 勾选复选框 | MEDIUM |
| browser_uncheck | uncheck | 取消勾选复选框 | MEDIUM |
| browser_hover | hover | 鼠标悬停 | LOW |
| browser_focus | focus | 聚焦元素 | LOW |
| browser_screenshot | screenshot | 截图 | LOW |
| browser_pdf | pdf | 导出 PDF | LOW |
| browser_wait | wait | 等待条件 | LOW |
| browser_get | get | 获取页面信息 | LOW |
| browser_eval | eval | 执行 JavaScript | HIGH |
| browser_scroll | scroll | 滚动页面 | LOW |
| browser_back | back | 返回上一页 | LOW |
| browser_forward | forward | 前进下一页 | LOW |
| browser_reload | reload | 刷新页面 | LOW |
| browser_upload | upload | 上传文件 | MEDIUM |
| browser_download | download | 下载文件 | MEDIUM |
| browser_auth_save | auth save | 保存认证配置 | HIGH |
| browser_auth_login | auth login | 使用保存的认证登录 | HIGH |
| browser_auth_list | auth list | 列出认证配置 | LOW |
| browser_auth_delete | auth delete | 删除认证配置 | MEDIUM |
| browser_session_list | session list | 列出活动会话 | LOW |
| browser_diff_snapshot | diff snapshot | 比较页面快照 | LOW |
| browser_diff_url | diff url | 比较两个页面 | LOW |

### 5. 工具注册

```typescript
// src/tools/index.ts (更新)

export * from './base';
export * from './registry';
export * from './filesystem';
export * from './shell';
export * from './web';
export * from './browser';  // 新增
export * from './message';
export * from './spawn';
export * from './cron';
```

```typescript
// src/cli/setup.ts (更新)

import {
  BrowserOpenTool,
  BrowserCloseTool,
  BrowserSnapshotTool,
  BrowserClickTool,
  BrowserFillTool,
  BrowserScreenshotTool,
  BrowserWaitTool,
  BrowserGetTool,
  BrowserEvalTool,
  // ... 其他工具
} from '@/tools';

export async function buildAgentRuntime(config: Config, tui?: boolean): Promise<AgentRuntime> {
  // ... 现有代码

  // 注册浏览器工具
  if (config.tools.browser?.enabled) {
    tools.register(new BrowserOpenTool(config));
    tools.register(new BrowserCloseTool(config));
    tools.register(new BrowserSnapshotTool(config));
    tools.register(new BrowserClickTool(config));
    tools.register(new BrowserFillTool(config));
    tools.register(new BrowserScreenshotTool(config));
    tools.register(new BrowserWaitTool(config));
    tools.register(new BrowserGetTool(config));
    tools.register(new BrowserEvalTool(config));
    // ... 其他工具

    logger.info('Browser tools enabled');
  }

  // ... 现有代码
}
```

## 📅 实施计划

### Phase 1: 基础设施（1 天）

- [ ] 创建 `src/tools/browser.ts` 文件
- [ ] 实现 BrowserTool 基类
- [ ] 实现配置扩展（BrowserConfigSchema）
- [ ] 更新 `src/tools/index.ts`

### Phase 2: 核心工具（2-3 天）

- [ ] browser_open - 打开浏览器并导航
- [ ] browser_close - 关闭浏览器
- [ ] browser_snapshot - 获取页面快照
- [ ] browser_click - 点击元素
- [ ] browser_fill - 填写表单字段
- [ ] browser_screenshot - 截图
- [ ] browser_wait - 等待条件

### Phase 3: 扩展工具（1-2 天）

- [ ] browser_get - 获取页面信息
- [ ] browser_type - 输入文本（不清空）
- [ ] browser_press - 按键
- [ ] browser_select - 选择下拉选项
- [ ] browser_check/uncheck - 复选框
- [ ] browser_scroll - 滚动
- [ ] browser_eval - 执行 JavaScript
- [ ] browser_pdf - 导出 PDF

### Phase 4: 高级功能（1-2 天）

- [ ] browser_upload/download - 文件操作
- [ ] browser_auth_* - 认证管理
- [ ] browser_session_list - 会话管理
- [ ] browser_diff_* - 页面比较

### Phase 5: 集成和测试（1-2 天）

- [ ] 更新 `src/cli/setup.ts` 注册工具
- [ ] 单元测试
- [ ] 集成测试
- [ ] 手动测试清单

### Phase 6: 文档（1 天）

- [ ] 更新 README.md
- [ ] 创建使用示例文档
- [ ] 更新 API 文档
- [ ] 集成技能文档（可选）

**总计：约 7-10 天**

## 📖 使用示例

### 示例 1: 自动登录

```typescript
// 用户指令: "帮我登录 GitHub"

// AI 执行序列：
// 1. 打开登录页面
browser_open({
  url: 'https://github.com/login',
  waitForLoad: 'networkidle'
})

// 2. 获取页面快照
browser_snapshot({
  interactive: true,
  compact: true
})
// 返回:
// @e1 [textbox] "用户名或邮箱"
// @e2 [textbox] "密码"
// @e3 [button] "登录"

// 3. 填写表单
browser_fill({ element: '@e1', text: 'user@example.com' })
browser_fill({ element: '@e2', text: 'password' })

// 4. 点击登录
browser_click({ element: '@e3' })

// 5. 等待导航
browser_wait({ url: 'https://github.com' })

// 6. 截图验证
browser_screenshot()
```

### 示例 2: 数据抓取

```typescript
// 用户指令: "抓取 GitHub Trending 页面的前 10 个项目"

// AI 执行序列：
browser_open({
  url: 'https://github.com/trending',
  waitForLoad: 'networkidle'
})

browser_snapshot({ compact: true })

// 批量提取项目标题
browser_eval({
  code: `
    Array.from(document.querySelectorAll('article h2 a'))
      .map(a => a.textContent)
      .join('\n')
  `
})
```

### 示例 3: 表单自动化

```typescript
// 用户指令: "填写这个在线表单并提交"

// AI 执行序列：
browser_open({ url: 'https://example.com/form' })
browser_snapshot({ interactive: true })
// 返回:
// @e1 [textbox] "姓名"
// @e2 [textbox] "邮箱"
// @e3 [textbox] "电话"
// @e4 [button] "提交"

// 填写表单
browser_fill({ element: '@e1', text: '张三' })
browser_fill({ element: '@e2', text: 'zhangsan@example.com' })
browser_fill({ element: '@e3', text: '13800138000' })

// 提交表单
browser_click({ element: '@e4' })

// 等待加载
browser_wait({ load: 'networkidle' })

// 截图确认
browser_screenshot({ full: true })
```

## 🔒 安全考虑

### 1. 风险级别划分

| 工具类别 | 风险级别 | 原因 | 审批策略 |
|---------|---------|------|---------|
| 导航类（open, close） | MEDIUM | 系统资源消耗，访问任意网站 | 首次确认 |
| 交互类（click, fill） | MEDIUM/HIGH | 可能触发敏感操作，可能泄露信息 | 总是确认 |
| 信息获取类（snapshot, get, screenshot） | LOW | 只读操作 | 无需确认 |
| 代码执行类（eval） | HIGH | 任意代码执行 | 总是确认 |
| 认证类（auth_*, fill password） | HIGH | 处理敏感信息 | 总是确认 |

### 2. 域名白名单

```json
{
  "tools": {
    "browser": {
      "allowedDomains": ["example.com", "*.example.com", "github.com"]
    }
  }
}
```

### 3. 内容边界标记

启用后，agent-browser 的输出会被包装在标记中：

```
--- AGENT_BROWSER_PAGE_CONTENT nonce=abc123 ---
@e1 [button] "提交"
@e2 [textbox] "用户名"
--- END_AGENT_BROWSER_PAGE_CONTENT nonce=abc123 ---
```

## ⚡ 性能优化

### 1. 命令链优化

agent-browser 通过守护进程保持浏览器状态，可以使用 `&&` 链接命令：

```bash
agent-browser open https://example.com && \
  agent-browser wait --load networkidle && \
  agent-browser snapshot -i
```

### 2. 会话复用

使用 `--session` 参数隔离不同聊天会话：

```typescript
// 会话 1
browser_open({ url: 'https://example.com', sessionName: 'chat-1' })
browser_snapshot()

// 会话 2（并行）
browser_open({ url: 'https://example.com', sessionName: 'chat-2' })
browser_snapshot()
```

### 3. 紧凑快照

使用 `--compact` 和 `--depth` 参数减少 token 消耗：

```typescript
browser_snapshot({
  interactive: true,
  compact: true,
  depth: 5
})
```

## 🧪 测试策略

### 1. 手动测试清单

- [ ] 基础导航（open, close）
- [ ] 页面快照（snapshot）
- [ ] 表单填写（fill, type, select）
- [ ] 元素交互（click, check, scroll）
- [ ] 截图功能（screenshot, pdf）
- [ ] 等待机制（wait）
- [ ] 信息获取（get）
- [ ] JavaScript 执行（eval）
- [ ] 会话隔离（sessionName）
- [ ] 域名白名单
- [ ] 内容边界标记
- [ ] 输出限制

### 2. 常见错误处理

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| Browser command failed (exit code 1) | agent-browser 执行失败 | 检查命令参数，查看 stderr |
| Browser operation timeout | 操作超时 | 增加 timeout 配置，使用 wait 等待页面加载 |
| Target closed | 浏览器已关闭 | 使用 browser_open 重新打开 |
| Element not found | 元素不存在 | 使用 browser_wait 等待元素，或检查选择器 |
| Ref @e1 not found | 引用已失效 | 重新获取快照（页面变化后引用失效） |

## 📝 配置示例

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "waitForLoad": "networkidle",
      "timeout": 60,
      "downloadPath": "./downloads",
      "allowedDomains": ["example.com", "*.example.com"],
      "contentBoundaries": true,
      "maxOutput": 50000,
      "headed": false,
      "defaultSession": "default"
    }
  }
}
```

## 🎯 总结

通过集成 **agent-browser**，nanobot-ts 将获得强大的浏览器自动化能力：

1. **自主浏览网页** - 理解页面结构并智能交互
2. **操作复杂表单** - 自动填写、提交表单
3. **提取结构化数据** - 从网页中抓取信息
4. **视觉验证** - 通过截图确认操作结果
5. **安全可控** - 域名白名单、审批机制、内容边界标记
6. **高效性能** - 命令链优化、会话复用、紧凑输出

这将极大扩展 nanobot-ts 的应用场景：

- **RPA 自动化** - 自动化重复性网页操作
- **数据采集** - 批量抓取网页数据
- **自动化测试** - 端到端测试 Web 应用
- **内容监控** - 监控网页变化并通知

整个实施过程预计需要 **7-10 天**，完成后将提供一个功能完整、安全可靠、易于维护的浏览器自动化解决方案。
