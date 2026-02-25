/**
 * WhatsApp 渠道 (Baileys)
 * 消息接收与发送，二维码登录
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
  type WAMessage,
  type BaileysEventMap,
} from 'baileys';
import pino from 'pino';
import path from 'path';
import type { InboundMessage, OutboundMessage } from '../bus/events';
import type { BaseChannel } from './base';
import type { WhatsAppConfig } from '../config/schema';
import { logger } from '../utils/logger';

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
  private socket: WASocket | null = null;
  private readonly pinoLogger = pino({ level: 'silent' });
  private authDir: string;

  constructor(
    private readonly config: WhatsAppChannelConfig,
    private readonly bus: { publishInbound: (msg: InboundMessage) => Promise<void> }
  ) {
    this.authDir = config.authDir ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.nanobot', 'whatsapp_auth');
  }

  async start(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    this.socket = makeWASocket({
      auth: state,
      logger: this.pinoLogger,
      browser: ['Chrome (Linux)', '', ''],
    });

    this.socket.ev.on('connection.update', async (update: BaileysEventMap['connection.update']) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const err = lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
        const reason = err?.output?.statusCode;
        const isLogout = reason === DisconnectReason.loggedOut;
        logger.warn({ reason, isLogout }, 'WhatsApp connection closed');
        if (!isLogout) {
          await this.start();
        }
      } else if (connection === 'open') {
        logger.info('WhatsApp connection opened');
      }
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('messages.upsert', async (ev) => {
      if (ev.type !== 'notify') return;
      for (const m of ev.messages) {
        if (m.key.fromMe) continue;
        const text = getMessageText(m);
        if (!text) continue;
        const allowFrom = this.config.allowFrom;
        const jid = m.key.remoteJid ?? '';
        if (allowFrom.length > 0 && !allowFrom.some((id) => jid.includes(id))) continue;

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
