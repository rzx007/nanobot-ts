# Nanobot-TS 统一 TUI 应用整合计划

## 1. 项目概述

将当前分散的 TUI 子命令（`chat`、`status`、`config`）整合为一个完整的 TUI 应用。用户运行 `nanobot-ts` 即可启动应用,通过统一的界面管理聊天、状态、配置和 MCP 服务器监控。

### 1.1 核心功能

- **统一入口**：运行 `nanobot-ts` 启动主应用
- **命令面板**：按 `Ctrl+P` 打开命令面板，快速切换视图
- **多视图切换**：聊天、状态、配置、MCP 监控
- **会话管理**：在主页查看和打开最近会话
- **MCP 服务列表**：实时显示 MCP 服务列表

### 1.2 用户交互流程

```
启动 nanobot-ts
    ↓
显示主页（新会话界面）
    ↓
选择操作：
    - 创建新聊天
    - 打开最近会话
    - 查看状态
    - 查看配置
    - 查看 MCP
    - 按 Ctrl+P 打开命令面板
```

---

## 2. 当前架构分析

### 2.1 现有结构

```
CLI 入口: src/cli/run.ts
    ↓
Commander.js 子命令:
    - nanobot-ts chat    → runTui('chat')
    - nanobot-ts status  → runTui('status')
    - nanobot-ts config  → runTui('config')
    - nanobot-ts init    → runTui('init')
```

### 2.2 现有 TUI 组件

| 组件 | 路径 | 功能 |
|------|------|------|
| ChatApp | `src/cli/tui/chat/` | 交互式聊天界面 |
| StatusApp | `src/cli/tui/status/` | 显示配置、工作区、会话 |
| ConfigApp | `src/cli/tui/config/` | 配置编辑器 |
| InitWizard | `src/cli/tui/init/` | 首次设置向导 |
| Layout | `src/cli/tui/components/Layout.tsx` | 布局组件 |

### 2.3 缺失组件

- ❌ 主页/仪表板视图（新会话界面）
- ❌ 命令面板（Ctrl+P）
- ❌ MCP TUI 监控界面
- ❌ 视图导航系统
- ❌ 全局键盘快捷键管理

---

## 3. 实施计划

### 阶段 1：核心导航系统

#### 1.1 主应用组件
**文件**: `src/cli/tui/MainApp.tsx`

**功能**:
- 管理当前视图状态 (`'home' | 'chat' | 'status' | 'config' | 'mcp'`)
- 实现视图切换逻辑
- 添加全局键盘处理器
- 作为应用入口点

**核心状态**:
```typescript
type ViewMode = 'home' | 'chat' | 'status' | 'config' | 'mcp';

interface AppState {
  currentView: ViewMode;
  commandPaletteOpen: boolean;
  sessionKey?: string;
}
```

#### 1.2 命令面板组件
**文件**: `src/cli/tui/components/CommandPalette.tsx`

**功能**:
- 模态覆盖层，带可搜索命令列表
- 支持键盘导航（上下箭头 + Enter）
- `Ctrl+P` 切换，`Esc` 关闭

**命令列表**:
```typescript
const commands = [
  { id: 'new-chat', label: '新建聊天', shortcut: 'Ctrl+N' },
  { id: 'open-recent', label: '打开最近会话', shortcut: 'Ctrl+O' },
  { id: 'view-status', label: '查看状态', shortcut: 'Ctrl+S' },
  { id: 'view-config', label: '查看配置', shortcut: 'Ctrl+C' },
  { id: 'view-mcp', label: '查看 MCP 服务列表', shortcut: 'Ctrl+M' },
  { id: 'help', label: '显示帮助', shortcut: '?' },
  { id: 'exit', label: '退出应用', shortcut: 'Ctrl+Q' },
];
```

#### 1.3 主页/仪表板视图
**文件**: `src/cli/tui/home/HomeView.tsx`

**功能**:
- 显示最近会话列表（可选择）
- 快速操作按钮
- 系统状态摘要
- MCP 服务列表

**布局示例**:
```
┌─────────────────────────────────────────┐
│         Nanobot TUI  v0.1.0             │
├─────────────────────────────────────────┤
│  [新建聊天]  [查看状态]  [查看配置]     │
├─────────────────────────────────────────┤
│  最近会话:                               │
│  ┌───────────────────────────────────┐ │
│  │ 会话名称             2024-03-01    │ │
│  │ 会话名称             2024-02-28    │ │
│  └───────────────────────────────────┘ │
├─────────────────────────────────────────┤
│  MCP 服务列表:                           │
│  按 Ctrl+P 打开命令面板                 │
└─────────────────────────────────────────┘
```

---

### 阶段 2：创建 MCP 监控组件

#### 2.1 MCP 状态卡片
**文件**: `src/cli/tui/mcp/MCPStatusCard.tsx`

**功能**:
- 显示单个 MCP 服务信息
- 显示工具数量
- 显示服务器类型（stdio/http）

**UI 示例**:
```
┌─────────────────────────────┐
│ 📦 filesystem-server        │
│ 状态: 已连接 (✓)           │
│ 类型: stdio                 │
│ 工具: 12                    │
└─────────────────────────────┘
```

#### 2.2 MCP 管理器视图
**文件**: `src/cli/tui/mcp/MCPView.tsx`

**功能**:
- 列出所有配置的 MCP 服务器
- 显示每个服务器的连接状态
- 显示每个服务器可用的工具
- 测试工具接口（可选）

---

### 阶段 3：重构现有 TUI 组件

#### 3.1 提取通用布局
**文件**: `src/cli/tui/components/Layout.tsx`（更新）

**新增功能**:
- 页脚显示命令面板提示
- 非主页时显示返回导航
- 标题栏显示当前视图指示器

#### 3.2 更新现有视图
- **ChatApp**: 改为无状态，通过 props/context 接收消息
- **StatusApp**: 优化集成
- **ConfigApp**: 优化集成
- **所有视图**: 添加导航 props

#### 3.3 共享状态管理
**文件**: `src/cli/tui/context/AppContext.tsx`

**共享数据**:
- 当前会话
- 配置对象
- MCP 管理器实例
- 会话管理器

```typescript
interface AppContextValue {
  config: Config | null;
  sessionKey: string | null;
  mcpManager: MCPManager | null;
  sessionManager: SessionManager | null;
  navigateTo: (view: ViewMode) => void;
}
```

---

### 阶段 4：CLI 集成

#### 4.1 更新 CLI 入口点
**文件**: `src/cli/commands/index.ts`

**修改**:
- 添加默认操作（无子命令）启动主 TUI
- 保留现有子命令以实现向后兼容
- 如果使用子命令，传递模式标志（例如 `nanobot-ts chat` → 以聊天模式启动 TUI）

```typescript
program
  .action(async () => {
    // 无子命令时启动主 TUI
    await runTui('home');
  });

// 保留现有子命令用于向后兼容
registerChatCommand(program);  // 启动 TUI 并跳转到聊天视图
registerStatusCommand(program); // 启动 TUI 并跳转到状态视图
registerConfigCommand(program); // 启动 TUI 并跳转到配置视图
```

#### 4.2 更新 TUI 入口点
**文件**: `src/cli/tui/index.tsx`

**修改**:
- 支持以特定模式启动或默认为 'home'
- 处理模式转换

---

### 阶段 5：键盘快捷键系统

#### 5.1 全局快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+P` | 打开/关闭命令面板 | 任何视图 |
| `Esc` | 关闭模态框 / 返回主页 | 任何视图 |
| `Ctrl+Q` | 退出应用（需确认） | 任何视图 |
| `Ctrl+N` | 新建聊天 | 非聊天模式 |
| `?` | 显示帮助 | 任何视图 |

#### 5.2 视图特定快捷键

**聊天模式**:
- `Alt+Enter`: 发送消息
- `Ctrl+C`: 复制选中文本
- `Ctrl+K`: 清空聊天历史

**状态视图**:
- `Ctrl+R`: 刷新状态

**配置视图**:
- `Ctrl+S`: 保存配置（编辑模式）

**MCP 视图**:
- `Ctrl+T`: 测试工具
- `Ctrl+R`: 刷新 MCP 服务列表

#### 5.3 帮助模态框
**文件**: `src/cli/tui/components/HelpModal.tsx`

**功能**:
- 显示所有键盘快捷键
- 通过 `?` 键或命令面板触发

---

### 阶段 6：优化和测试

#### 6.1 视觉优化
- 主页添加 ASCII 艺术横幅
- 改进配色方案一致性
- 添加加载状态
- 添加错误边界

#### 6.2 响应式布局
- 处理终端大小调整事件
- 不同终端大小的自适应布局

#### 6.3 测试
- 测试视图切换
- 测试键盘快捷键
- 测试 MCP 服务列表
- 测试命令面板搜索/过滤

---

## 4. 文件结构计划

```
src/cli/tui/
├── MainApp.tsx                    # 主应用（导航）
├── App.tsx                        # 当前应用（将重构）
├── index.tsx                      # TUI 入口点
├── theme.ts                       # 主题（现有）
├── context/
│   └── AppContext.tsx            # 共享状态上下文
├── components/
│   ├── Layout.tsx                 # 更新以支持导航
│   ├── CommandPalette.tsx        # 新增：Ctrl+P 命令面板
│   ├── HelpModal.tsx             # 新增：键盘快捷键帮助
│   └── index.ts
├── home/
│   ├── HomeView.tsx              # 新增：仪表板/主页
│   ├── SessionList.tsx           # 新增：最近会话列表
│   └── index.ts
├── chat/
│   ├── ChatApp.tsx               # 现有，将重构
│   ├── ChatMessages.tsx          # 现有
│   ├── ChatInput.tsx             # 现有
│   └── index.ts
├── status/
│   ├── StatusApp.tsx             # 现有，将重构
│   ├── StatusDashboard.tsx       # 现有
│   ├── StatusCard.tsx            # 现有
│   └── index.ts
├── config/
│   ├── ConfigApp.tsx             # 现有，将重构
│   ├── ConfigEditor.tsx          # 现有
│   ├── ConfigForm.tsx            # 现有
│   └── index.ts
└── mcp/                          # 新增：MCP 监控
    ├── MCPView.tsx              # 新增：MCP 服务器列表和状态
    ├── MCPStatusCard.tsx        # 新增：单个服务器状态
    └── index.ts
```

---

## 5. 实施优先级

### 高优先级（核心功能）

1. ✅ MainApp 组件与视图切换
2. ✅ 主页/仪表板视图及最近会话
3. ✅ 命令面板（Ctrl+P）
4. ✅ MCP 服务列表组件
5. ✅ 默认 TUI 启动的 CLI 集成

### 中优先级（优化）

1. 帮助模态框及快捷键
2. Layout 中的增强导航
3. 用于状态管理的共享上下文
4. 键盘快捷键优化

### 低优先级（锦上添花）

1. ASCII 艺术横幅
2. 动画/过渡效果
3. MCP 服务列表界面优化
4. 主题自定义

---

## 6. 关键技术决策

### 6.1 状态管理
- **选择**: React Context
- **原因**: 
  - 避免引入额外依赖（如 Redux）
  - 轻量级，满足需求
  - 与现有 React 生态系统集成良好

### 6.2 导航
- **选择**: MainApp 中的简单视图状态（无路由库）
- **原因**: 
  - 不需要 URL 路由
  - 简单直接
  - 易于维护

### 6.3 命令面板
- **选择**: 可复用组件，接受命令列表
- **原因**: 
  - 灵活，可扩展
  - 统一外观和行为
  - 便于后续添加新命令

### 6.4 MCP 服务列表集成
- **选择**: 复用现有 `MCPManager`，创建 TUI 包装器
- **原因**: 
  - 避免重复代码
  - 保持逻辑分离
  - 便于测试和维护

### 6.5 键盘处理
- **选择**: 应用根部的全局 `useKeyboard` + 本地处理器
- **原因**: 
  - 集中管理全局快捷键
  - 允许视图特定的快捷键
  - 避免冲突

---

## 7. 技术约束和注意事项

### 7.1 OpenTUI 限制

根据 OpenTUI 技能文档，需要注意：

1. **⚠️ 不要直接调用 `process.exit()`**
   - 使用 `renderer.destroy()` 代替
   - 参考：`core/gotchas.md`

2. **文本样式需要嵌套标签**
   - 不要使用 props: `<text bold>Bold</text>` ❌
   - 使用嵌套标签: `<text><strong>Bold</strong></text>` ✅
   - 参考：`components/text-display.md`

3. **输入焦点管理**
   - 输入组件（`<input>`, `<textarea>`, `<select>`）聚焦时捕获键盘事件
   - 全局快捷键需要检查输入是否聚焦
   - 参考：`keyboard/REFERENCE.md`

### 7.2 性能考虑

- 避免频繁的状态更新导致重渲染
- MCP 状态更新使用轮询而非实时流
- 会话列表延迟加载（仅显示最近 N 条）

### 7.3 可访问性

- 提供键盘导航支持
- 清晰的视觉反馈
- 合理的颜色对比度

---

## 8. 待确认问题

在开始实施前，请确认以下问题：

### 8.1 主页设计
主页应显示：
- [ ] 选项 A：最近会话列表（带快速打开）
- [ ] 选项 B：仪表板小部件（最近会话、MCP 状态、快速操作）
- [ ] 选项 C：简单欢迎屏幕（带"新建聊天"按钮）

### 8.2 MCP 状态更新
MCP 服务器状态应：
- [ ] 选项 A：实时更新（每 N 秒轮询）
- [ ] 选项 B：手动刷新（Ctrl+R 或命令）
- [ ] 选项 C：仅在打开 MCP 视图时更新

### 8.3 向后兼容性
现有子命令（`nanobot-ts chat`、`nanobot-ts status` 等）应：
- [ ] 选项 A：启动主 TUI 并跳转到该视图
- [ ] 选项 B：保持为独立的 TUI 应用

### 8.4 聊天会话管理
会话应如何处理：
- [ ] 选项 A：一次一个活动会话
- [ ] 选项 B：多个会话带标签页/切换器
- [ ] 选项 C：主页显示所有，点击在聊天视图中打开

### 8.5 配置编辑
配置视图应：
- [ ] 选项 A：TUI 中完全可编辑（表单、输入框）
- [ ] 选项 B：仅可查看，提示使用外部编辑器
- [ ] 选项 C：混合（简单值可编辑，复杂值仅查看）

---

## 9. 实施时间表

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 阶段 1 | 核心导航系统 | 4-6 小时 |
| 阶段 2 | MCP 服务列表组件 | 3-4 小时 |
| 阶段 3 | 重构现有组件 | 4-6 小时 |
| 阶段 4 | CLI 集成 | 2-3 小时 |
| 阶段 5 | 键盘快捷键 | 2-3 小时 |
| 阶段 6 | 优化和测试 | 3-4 小时 |
| **总计** | | **18-26 小时** |

---

## 10. 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 状态管理复杂性高 | 中 | 使用简单 Context，避免过度设计 |
| MCP 服务列表显示性能 | 中 | 实现节流/防抖，限制轮询频率 |
| 键盘快捷键冲突 | 低 | 集中管理，文档化所有快捷键，避免冲突 |
| 向后兼容性破坏 | 中 | 保留现有子命令，渐进式迁移 |
| 终端大小适配 | 低 | 使用 flexbox 布局，测试不同尺寸 |

---

## 11. 成功标准

- [ ] 用户运行 `nanobot-ts` 可启动主应用
- [ ] 按 `Ctrl+P` 可打开命令面板
- [ ] 可在视图间无缝切换
- [ ] MCP 服务列表可显示
- [ ] 最近会话列表可访问和可打开
- [ ] 所有键盘快捷键正常工作
- [ ] 现有子命令仍可正常使用
- [ ] 应用在不同终端尺寸下正常显示
- [ ] 代码遵循 OpenTUI 最佳实践

---

## 附录：参考文档

- [OpenTUI React API](D:/code/person_project/nanobot-ts/.agents/skills/opentui/references/react/api.md)
- [OpenTUI 键盘处理](D:/code/person_project/nanobot-ts/.agents/skills/opentui/references/keyboard/REFERENCE.md)
- [现有 ChatApp 组件](D:/code/person_project/nanobot-ts/src/cli/tui/chat/ChatApp.tsx)
- [现有 StatusApp 组件](D:/code/person_project/nanobot-ts/src/cli/tui/status/StatusApp.tsx)
- [MCP 管理器](D:/code/person_project/nanobot-ts/src/mcp/manager.ts)
- [会话管理器](D:/code/person_project/nanobot-ts/src/storage/session.ts)

---

**文档版本**: 1.0  
**创建日期**: 2025-03-01  
**最后更新**: 2025-03-01