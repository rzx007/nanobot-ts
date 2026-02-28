/**
 * WhatsApp 渠道 (Baileys)
 * 消息接收与发送，二维码/配对码登录
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
  type WAMessage,
  type BaileysEventMap,
  Browsers,
} from 'baileys';
import path from 'path';
import qrcode from 'qrcode-terminal';
import type { InboundMessage, OutboundMessage, IMessageBus } from '@/bus/types';
import type { BaseChannel } from './base';
import type { WhatsAppConfig } from '../config/schema';
import { createLogger, logger } from '../utils/logger';

export interface WhatsAppChannelConfig extends WhatsAppConfig {
  /** 认证状态存储目录（默认 ~/.nanobot/whatsapp_auth） */
  authDir?: string;
}

/** 从 WA 消息中提取文本 */
function getMessageText(msg: WAMessage): string {
  const m = msg.message;
  if (!m) return '';
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  return '';
}

export class WhatsAppChannel implements BaseChannel {
  name = 'whatsapp';

  private socket: WASocket | null = null;
  // 静默 logger 供 baileys 使用，不输出库内日志
  private readonly pinoLogger = createLogger(undefined, { level: 'silent' });
  private readonly authDir: string;
  private isAuthenticating = false;
  private retryCount = 0;
  private readonly maxRetries = 5;
  private readonly retryDelay = 3000;

  constructor(
    private readonly config: WhatsAppChannelConfig,
    private readonly bus: IMessageBus,
  ) {
    this.authDir =
      config.authDir ??
      path.join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.nanobot', 'whatsapp_auth');
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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

  async start(): Promise<void> {
    /**
     * 使用多文件认证状态
     */
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    /**
     * 如果已认证且不是在重连，直接返回
     */
    if (state.creds.registered && !this.isAuthenticating) {
      logger.info('WhatsApp already authenticated, connecting...');
    } else {
      this.isAuthenticating = true;
    }

    /**
     * 创建 WhatsApp 套接字
     */
    this.socket = makeWASocket({
      auth: state,
      logger: this.pinoLogger,
      browser: Browsers.macOS('Chrome'),
      printQRInTerminal: false,
    });

    /**
     * 配对码模式：请求配对码
     */
    if (this.config.usePairingCode && this.config.phoneNumber && !state.creds.me) {
      setTimeout(async () => {
        try {
          const code = await this.socket!.requestPairingCode(this.config.phoneNumber!);
          console.log(`\n🔗 WhatsApp 配对码: ${code}\n`);
          console.log('  1. 打开手机 WhatsApp');
          console.log('  2. 设置 → 已连接的设备 → 连接设备');
          console.log('  3. 点击"使用手机号码连接"');
          console.log(`  4. 输入配对码: ${code}\n`);
        } catch (err: any) {
          logger.error({ err }, 'Failed to request pairing code');
        }
      }, 3000);
    }

    /**
     * 处理连接状态更新
     */
    this.socket.ev.on('connection.update', async (update: BaileysEventMap['connection.update']) => {
      const { connection, lastDisconnect, qr } = update;

      /**
       * 显示二维码
       */
      if (qr) {
        console.log('\n📱 扫描此二维码登录 WhatsApp:\n');
        console.log('  1. 打开手机 WhatsApp');
        console.log('  2. 设置 → 已连接的设备 → 连接设备');
        console.log('  3. 使用相机扫描下方二维码\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const err = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
        const reason = err?.output?.statusCode;

        if (reason === DisconnectReason.loggedOut) {
          logger.error('WhatsApp logged out, please re-authenticate');
          console.error('\n❌ WhatsApp 已登出，请删除认证目录后重试');
          console.error(`   认证目录: ${this.authDir}\n`);
          this.isAuthenticating = false;
          return;
        } else if (reason === DisconnectReason.timedOut) {
          logger.warn('WhatsApp QR code timed out');
          if (this.isAuthenticating) {
            if (await this.shouldRetry()) {
              console.warn('⚠️  二维码已超时，正在重新生成...\n');
              await this.start();
              return;
            } else {
              console.error('\n❌ 已达到最大重试次数，请稍后再试\n');
              this.isAuthenticating = false;
              return;
            }
          }
        } else if (reason === 515) {
          logger.info('Stream error (515) after pairing, reconnecting...');
          await this.start();
          return;
        }

        logger.warn({ reason }, 'WhatsApp connection closed');
        if (!this.isAuthenticating) {
          if (await this.shouldRetry()) {
            await this.start();
          } else {
            console.error('\n❌ 已达到最大重试次数，请稍后再试\n');
          }
        }
      } else if (connection === 'open') {
        this.isAuthenticating = false;
        this.retryCount = 0;
        logger.info('WhatsApp connection opened');
        if (process.stdout.isTTY) {
          console.log('\n✅ WhatsApp 连接成功！\n');
        }
      }
    });

    /**
     * 处理认证状态更新
     */
    this.socket.ev.on('creds.update', saveCreds);

    /**
     * 处理接收到的消息
     */
    this.socket.ev.on('messages.upsert', async ev => {
      if (ev.type !== 'notify') return;
      for (const m of ev.messages) {
        if (m.key.fromMe) continue;
        const text = getMessageText(m);
        if (!text) continue;
        const allowFrom = this.config.allowFrom;
        const jid = m.key.remoteJid ?? '';
        if (allowFrom.length > 0 && !allowFrom.some(id => jid.includes(id))) continue;

        const inbound: InboundMessage = {
          channel: 'whatsapp',
          senderId: jid,
          chatId: jid,
          content: text,
          timestamp: new Date(Number(m.messageTimestamp) * 1000),
        };
        await this.bus.publishInbound(inbound);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.socket) {
      await this.socket.end(undefined);
      this.socket = null;
    }
    logger.info('WhatsApp channel stopped');
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp socket not connected');
    }
    await this.socket.sendMessage(msg.chatId, { text: msg.content });
  }
}
