# 测试指南

## 概述

Subagent 系统的单元测试和集成测试。

## 测试结构

```
tests/
├── unit/
│   └── subagent/
│       ├── manager.test.ts  # SubagentManager 单元测试
│       └── worker.test.ts   # SubagentWorker 单元测试
└── integration/
    └── subagent.test.ts   # Subagent 集成测试
```

## 运行测试

### 运行所有测试

```bash
# 运行所有测试
bun test

# 运行所有测试并生成覆盖率报告
bun test:coverage

# 打开测试 UI
bun test:ui
```

### 运行特定测试

```bash
# 运行单元测试
bun test tests/unit/subagent

# 运行集成测试
bun test tests/integration/subagent

# 运行单个测试文件
bun test tests/unit/subagent/manager.test.ts
```

### 监视模式

```bash
# 监视模式，文件变化时自动重新运行
bun test:watch
```

## 测试覆盖范围

### SubagentManager 测试

#### 单元测试

- ✅ `initialize()` - 初始化测试
  - embedded 模式初始化
  - disabled 状态初始化
- ✅ `spawn()` - 任务启动测试
  - 正常任务启动
  - disabled 状态下启动
  - 可选参数处理
- ✅ `cancel()` - 任务取消测试
  - 取消运行中的任务
  - 取消不存在的任务
- ✅ `getRunningCount()` - 状态查询测试
  - 运行中任务数量查询
- ✅ `getMode()` - 模式查询测试
  - 当前模式查询
- ✅ `shutdown()` - 优雅关闭测试
  - 优雅关闭验证

### SubagentWorker 测试

#### 单元测试

- ✅ `execute()` - 任务执行测试
  - 成功执行
  - 错误处理
- ✅ `buildFilteredToolSet()` - 工具过滤测试
  - 过滤 spawn 和 message 工具
  - 保留其他工具
- ✅ `buildSystemPrompt()` - 系统提示词测试
  - 提示词内容验证

### 集成测试

#### 任务生命周期测试

- ✅ 任务启动和完成
  - 完整的任务生命周期
  - 结果验证
- ✅ 任务取消
  - 启动后立即取消
  - 验证取消状态

#### 并发测试

- ✅ 多任务并发
  - 同时启动多个任务
  - 并发处理验证

#### 模式测试

- ✅ 模式查询
  - 当前模式验证

## 测试配置

### Vitest 配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts'],
    },
  },
});
```

### CI/CD 配置

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun test:coverage
```

## 覆盖率目标

- **代码覆盖率**: > 80%
- **分支覆盖率**: > 75%
- **函数覆盖率**: > 85%

## 故障排查

### 测试失败

1. **查看失败原因**

   ```bash
   bun test tests/unit/subagent/manager.test.ts --reporter=verbose
   ```

2. **调试单个测试**

   ```bash
   # 使用 Vitest UI
   bun test:ui

   # 在浏览器中查看测试结果和调试
   ```

3. **检查依赖**
   ```bash
   bun install
   bun run build
   ```

### 集成测试失败

1. **检查配置**

   ```bash
   # 确保配置文件存在
   ls -la ~/.nanobot/config.json
   ```

2. **检查 bunqueue**

   ```bash
   # 清理测试数据
   rm -f /tmp/test-bunqueue*.db
   ```

3. **检查端口**
   ```bash
   # 确保没有端口冲突
   netstat -tuln | grep :6789
   ```

## 性能测试

### 基准测试

```bash
# 运行性能测试
bun test:perf

# 查看性能报告
cat test-report/perf.json
```

### 性能指标

- 任务启动延迟: < 100ms
- 任务执行时间: < 5s（简单任务）
- 内存占用: < 100MB（空闲）
- CPU 占用: < 10%（空闲）

## 持续集成

### GitHub Actions

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      - name: Install dependencies
        run: bun install
      - name: Run tests
        run: bun test
      - name: Generate coverage
        run: bun test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### GitLab CI

```yaml
stages:
  - test

test:
  stage: test
  image: oven/bun:latest
  script:
    - bun install
    - bun test
    - bun test:coverage
  artifacts:
    paths:
      - coverage/
```

## 测试最佳实践

### 1. 测试隔离

每个测试应该是独立的：

```typescript
describe('SubagentManager', () => {
  let manager: SubagentManager;

  beforeEach(() => {
    // 为每个测试创建新实例
    manager = new SubagentManager(config);
  });

  afterEach(async () => {
    // 清理每个测试的状态
    await manager.shutdown();
  });
});
```

### 2. 异步测试

使用 async/await 处理异步操作：

```typescript
it('should spawn task asynchronously', async () => {
  const result = await manager.spawn('test');
  expect(result).toContain('started');
});
```

### 3. Mock 使用

使用 vitest 的 mock 功能：

```typescript
const mockProvider = {
  chat: vi.fn().mockResolvedValue({
    content: 'test response',
  }),
};
```

### 4. 超时处理

为集成测试设置合理的超时：

```typescript
it('should complete task', async () => {
  // 最多等待 15 秒
}, 15000);
```

## 贡献指南

### 添加新测试

1. **创建测试文件**

   ```bash
   touch tests/unit/subagent/new-feature.test.ts
   ```

2. **编写测试**

   ```typescript
   describe('New Feature', () => {
     it('should do something', async () => {
       // 测试逻辑
     });
   });
   ```

3. **运行测试**

   ```bash
   bun test tests/unit/subagent/new-feature.test.ts
   ```

4. **提交更改**
   ```bash
   git add tests/
   git commit -m "Add tests for new feature"
   git push
   ```

## 参考资料

- [Vitest 文档](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [bunqueue 测试](https://bunqueue.dev/guide/testing/)

---

**文档版本**: 1.0
**最后更新**: 2026-03-07
**作者**: Nanobot TypeScript Team
