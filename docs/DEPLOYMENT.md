# Nanobot-TS 部署指南

本指南介绍如何在不同环境中部署和运行 Nanobot-TS。

## 目录

- [前置要求](#前置要求)
- [本地安装](#本地安装)
- [配置](#配置)
- [运行](#运行)
- [Docker 部署](#docker-部署)
- [生产环境注意事项](#生产环境注意事项)

## 前置要求

### 系统要求

- **Node.js**: >= 18.0.0
- **pnpm**: >= 10.30.2 (推荐) 或 npm
- **操作系统**: Linux, macOS, Windows (WSL2 推荐)

### 依赖要求

- LLM Provider API Key（至少一个）：
  - OpenAI
  - Anthropic
  - DeepSeek
  - Groq
  - OpenRouter

- 可选：渠道服务 API Key（如需使用）：
  - WhatsApp: 手机号（通过 baileys 自动配置）
  - Feishu: App ID 和 App Secret
  - Email: IMAP 和 SMTP 凭据

## 本地安装

### 1. 克隆仓库

```bash
git clone https://github.com/rzx007/nanobot-ts.git
cd nanobot-ts
```

### 2. 安装依赖

使用 pnpm（推荐）：

```bash
pnpm install
```

或使用 npm：

```bash
npm install
```

### 3. 构建

```bash
pnpm run build
# 或
npm run build
```

### 4. 初始化配置

```bash
pnpm run onboard
# 或
node dist/cli/run.js init
```

这会在 `~/.nanobot/` 下创建配置文件和工作区。

## 配置

### 配置文件位置

默认配置文件位于：`~/.nanobot/config.json`

### 配置结构

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.nanobot/workspace",
      "model": "openai:gpt-4o",
      "temperature": 0.1,
      "maxTokens": 8192,
      "maxIterations": 40,
      "memoryWindow": 100
    }
  },
  "providers": {
    "openai": {
      "apiKey": "your-openai-api-key",
      "apiBase": "https://api.openai.com/v1"
    },
    "anthropic": {
      "apiKey": "your-anthropic-api-key"
    },
    "deepseek": {
      "apiKey": "your-deepseek-api-key"
    },
    "groq": {
      "apiKey": "your-groq-api-key"
    },
    "openrouter": {
      "apiKey": "your-openrouter-api-key",
      "apiBase": "https://openrouter.ai/api/v1"
    }
  },
  "channels": {
    "whatsapp": {
      "enabled": false,
      "allowFrom": []
    },
    "feishu": {
      "enabled": false,
      "appId": "",
      "appSecret": "",
      "encryptKey": "",
      "verificationToken": "",
      "allowFrom": []
    },
    "email": {
      "enabled": false,
      "consentGranted": false,
      "imapHost": "",
      "imapPort": 993,
      "imapUsername": "",
      "imapPassword": "",
      "imapMailbox": "INBOX",
      "smtpHost": "",
      "smtpPort": 587,
      "smtpUsername": "",
      "smtpPassword": "",
      "fromAddress": "test@example.com",
      "allowFrom": [],
      "autoReplyEnabled": true
    }
  },
  "tools": {
    "restrictToWorkspace": false,
    "exec": {
      "timeout": 60,
      "allowedCommands": []
    },
    "web": {
      "search": {
        "apiKey": ""
      }
    }
  }
}
```

### 环境变量

可通过环境变量覆盖配置：

```bash
export NANOBOT_HOME=/custom/path/.nanobot
export NODE_ENV=production
```

## 运行

### 交互式聊天

```bash
pnpm run agent
# 或
node dist/cli/run.js chat --interactive
```

### 单次查询

```bash
node dist/cli/run.js chat "你的问题"
```

### Gateway 模式（推荐）

```bash
pnpm run gateway
# 或
node dist/cli/run.js gateway
```

### 其他命令

```bash
# 查看状态
node dist/cli/run.js status

# 列出会话
node dist/cli/run.js session

# 查看渠道状态
node dist/cli/run.js channels status

# 查看日志（默认显示最后 50 行）
node dist/cli/run.js logs

# 查看指定行数的日志
node dist/cli/run.js logs --tail 100
node dist/cli/run.js logs -t 20

# 获取配置
node dist/cli/run.js config
node dist/cli/run.js config agents.defaults.model
node dist/cli/run.js config agents.defaults.model "groq:llama3-70b-8192"
```

## Docker 部署

### 1. 使用 Docker Compose（推荐）

创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'

services:
  nanobot:
    build:
      context: .
      dockerfile: Dockerfile
    image: nanobot-ts:latest
    container_name: nanobot
    restart: unless-stopped
    volumes:
      # 挂载配置目录
      - ~/.nanobot:/home/nanobot/.nanobot
      # 挂载工作区目录（供工具访问）
      - ~/nanobot-workspace:/home/nanobot/workspace
    environment:
      - NODE_ENV=production
      - TZ=Asia/Shanghai
    networks:
      - nanobot-network

networks:
  nanobot-network:
    driver: bridge
```

运行：

```bash
docker-compose up -d
```

查看日志：

```bash
docker-compose logs -f nanobot
```

停止：

```bash
docker-compose down
```

### 2. 手动 Docker 部署

构建镜像：

```bash
docker build -t nanobot-ts:latest .
```

运行容器：

```bash
docker run -d \
  --name nanobot \
  --restart unless-stopped \
  -v ~/.nanobot:/home/nanobot/.nanobot \
  -v ~/nanobot-workspace:/home/nanobot/workspace \
  -e NODE_ENV=production \
  nanobot-ts:latest
```

查看日志：

```bash
docker logs -f nanobot
```

### Docker 镜像更新

```bash
# 拉取最新镜像
docker pull zx007/nanobot-ts:latest

# 重新创建容器
docker-compose up -d
```

## 生产环境注意事项

### 安全

1. **保护 API Keys**：
   - 不要将包含真实 API keys 的 config.json 提交到版本控制
   - 使用环境变量或 secrets 管理工具（如 HashiCorp Vault）

2. **工作区限制**：
   - 在生产环境中启用 `tools.restrictToWorkspace: true`
   - 配置 `tools.exec.allowedCommands` 限制可执行命令

3. **渠道访问控制**：
   - 使用 `channels.whatsapp.allowFrom` 等配置限制允许的用户

4. **网络隔离**：
   - 运行在隔离的 Docker 网络中
   - 只暴露必要的端口

### 性能

1. **LLM Provider 选择**：
   - 根据场景选择合适的模型（如聊天用 GPT-4o，编程用 Claude 3.5 Sonnet）
   - 配置合适的 `maxTokens` 和 `temperature`

2. **内存管理**：
   - 调整 `agents.defaults.memoryWindow` 控制历史消息数
   - 定期归档旧会话

3. **并发处理**：
   - 当前版本为单进程模式，如需高并发可考虑多实例部署

### 监控

1. **日志**：
   - 查看容器日志：`docker logs -f nanobot`
   - 日志级别可通过代码调整

2. **健康检查**：
   - Docker 会自动检查进程状态
   - 可集成外部监控（如 Prometheus）

3. **资源使用**：
   - 监控 CPU、内存、磁盘使用
   - Docker stats: `docker stats nanobot`

### 备份

备份以下重要目录：

- `~/.nanobot/config.json` - 配置文件
- `~/.nanobot/workspace/` - 工作区（包含会话、记忆等）

```bash
# 创建备份
tar -czf nanobot-backup-$(date +%Y%m%d).tar.gz ~/.nanobot

# 恢复备份
tar -xzf nanobot-backup-YYYYMMDD.tar.gz -C ~/
```

## 故障排除

### 问题：模块未找到

确保已运行构建命令：

```bash
pnpm run build
```

### 问题：连接超时

1. 检查网络连接
2. 验证 API Key 是否正确
3. 查看防火墙设置

### 问题：内存不足

1. 减小 `agents.defaults.memoryWindow`
2. 减小 `agents.defaults.maxTokens`
3. 增加 Docker 容器内存限制

### 问题：渠道无法连接

1. 检查配置中的凭证是否正确
2. 查看容器日志了解详细错误
3. 验证网络访问权限

## 更多资源

- [项目 README](../README.md)
- [PRD](./PRD.md)
- [开发计划](./DEVELOPMENT-PLAN.md)
