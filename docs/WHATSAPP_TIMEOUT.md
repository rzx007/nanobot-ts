# WhatsApp 超时处理改进

## 问题

用户在 WhatsApp 授权过程中遇到超时错误，需要更稳定的重试机制。

## 改进内容

### 1. 自动重试机制

#### whatsapp.ts (Channel)

- **最大重试次数**: 5 次
- **重试延迟**: 指数退避 (3秒、6秒、9秒、12秒、15秒)
- **状态跟踪**: `retryCount` 和 `isAuthenticating`

#### whatsapp-auth.ts (CLI 命令)

- **最大重试次数**: 5 次
- **重试延迟**: 指数退避 (3秒、6秒、9秒、12秒、15秒)
- **重试计数**: 通过递归参数传递

### 2. 超时错误类型

| 错误码                       | 说明             | 处理方式               |
| ---------------------------- | ---------------- | ---------------------- |
| `DisconnectReason.timedOut`  | 二维码扫描超时   | 自动重试，最多 5 次    |
| `515`                        | 配对成功后流错误 | 立即重试，最多 5 次    |
| `DisconnectReason.loggedOut` | 用户登出         | 不重试，需删除凭证目录 |
| 其他                         | 连接失败         | 自动重试，最多 5 次    |

### 3. 用户提示

#### 重试中

```
⚠️  二维码已超时，3 秒后重试 (1/5)...

⚠️  连接失败 (401)，6 秒后重试 (2/5)...
```

#### 达到最大重试次数

```
❌ 已达到最大重试次数，请稍后再试
```

### 4. 代码示例

#### whatsapp.ts 重试逻辑

```typescript
private async shouldRetry(): Promise<boolean> {
  if (this.retryCount >= this.maxRetries) {
    return false;
  }
  this.retryCount++;
  const delay = this.retryDelay * this.retryCount;
  console.log(`\n⏳ 等待 ${delay / 1000} 秒后重试... (${this.retryCount}/${this.maxRetries})\n`);
  await this.sleep(delay);
  return true;
}
```

#### whatsapp-auth.ts 重试逻辑

```typescript
if (reason === DisconnectReason.timedOut) {
  if (retryCount < MAX_RETRIES) {
    const delay = RETRY_DELAY * (retryCount + 1);
    console.warn(
      `\n⚠️  二维码已超时，${delay / 1000} 秒后重试 (${retryCount + 1}/${MAX_RETRIES})...\n`,
    );
    await sleep(delay);
    await authWhatsApp(usePairingCode, phone, force, retryCount + 1);
    return;
  } else {
    error(`QR code timed out after ${MAX_RETRIES} retries. Please try again later.`);
    process.exit(1);
  }
}
```

## 使用建议

### 1. 首次授权

```bash
nanobot whatsapp:auth
```

- 扫描二维码后尽快完成（建议 20 秒内）
- 如果超时，系统会自动重试

### 2. 配对码授权

```bash
nanobot whatsapp:auth --pairing-code --phone 86123456789
```

- 配对码有效期较长（通常 60 秒）
- 不容易超时，推荐使用

### 3. Gateway 启动

```bash
nanobot gateway
```

- 已授权凭证会自动使用
- 如果凭证过期，会提示重新授权

## 故障排除

### 1. 持续超时

- 检查网络连接
- 尝试使用配对码模式
- 检查 WhatsApp 服务器状态

### 2. 登出错误

```bash
# 清除凭证目录
rm -rf ~/.nanobot/whatsapp_auth

# 或使用命令
nanobot whatsapp:logout
```

### 3. 连接失败

- 确认 WhatsApp 服务正常运行
- 检查防火墙设置
- 尝试更换网络环境

## 配置选项

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+86123456789"],
      "usePairingCode": true,
      "phoneNumber": "86123456789"
    }
  }
}
```

## 常见问题

### Q: 为什么会超时？

A: 二维码有效期通常 20-30 秒，需要在此时间内扫描。建议使用配对码模式获得更长的有效期。

### Q: 重试次数可以调整吗？

A: 当前代码中硬编码为 5 次，如需调整可修改 `MAX_RETRIES` 常量。

### Q: 超时后需要重新扫描二维码吗？

A: 不需要，系统会自动重新生成新的二维码，扫描新的即可。

### Q: 配对码和二维码有什么区别？

A:

- **二维码**: 有效期 20-30 秒，需要相机扫描
- **配对码**: 有效期 60 秒，手动输入，推荐使用
