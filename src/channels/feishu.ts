/**
 * Feishu 渠道 (@larksuiteoapi/node-sdk)
 * WebSocket 接收消息，API 发送消息
 */

import * as lark from '@larksuiteoapi/node-sdk';
import type { InboundMessage, OutboundMessage } from '../bus/events';
import type { BaseChannel } from './base';
import type { FeishuConfig } from '../config/schema';
import { logger } from '../utils/logger';

export interface FeishuChannelConfig extends FeishuConfig { }

export class FeishuChannel implements BaseChannel {
  private client: lark.Client | null = null;
  private wsClient: lark.WSClient | null = null;

  constructor(
    private readonly config: FeishuChannelConfig,
    private readonly bus: { publishInbound: (msg: InboundMessage) => Promise<void> }
  ) { }

  async start(): Promise<void> {
    const { appId, appSecret, encryptKey, verificationToken, allowFrom } = this.config;

    this.client = new lark.Client({
      appId,
      appSecret,
      disableTokenCache: false,
    });

    const eventDispatcher = new lark.EventDispatcher({
      encryptKey: encryptKey,
      verificationToken: verificationToken,
    }).register({
      'im.message.receive_v1': async (data: {
        message?: { chat_id?: string; content?: string; create_time?: string; sender?: { sender_id?: { user_id?: string } } };
      }) => {
        const msg = data?.message;
        if (!msg?.chat_id) return;
        let text = '';
        try {
          const content = msg.content ? JSON.parse(msg.content) : {};
          text = content.text ?? '';
        } catch {
          text = String(msg.content ?? '');
        }
        if (!text) return;
        const senderId = msg.sender?.sender_id?.user_id ?? msg.chat_id;
        if (allowFrom.length > 0 && !allowFrom.includes(senderId)) return;

        const inbound: InboundMessage = {
          channel: 'feishu',
          senderId,
          chatId: msg.chat_id,
          content: text,
          timestamp: new Date(Number(msg.create_time) || Date.now()),
        };
        await this.bus.publishInbound(inbound);
      },
    });

    this.wsClient = new lark.WSClient({
      appId,
      appSecret,
      loggerLevel: lark.LoggerLevel.info,
    });
    await this.wsClient.start({ eventDispatcher });
    logger.info('Feishu channel started (WebSocket)');
  }

  async stop(): Promise<void> {
    if (this.wsClient) {
      try {
        await this.wsClient.close();
      } catch (e) {
        logger.warn({ err: e }, 'Feishu WS stop error');
      }
      this.wsClient = null;
    }
    this.client = null;
    logger.info('Feishu channel stopped');
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.client) {
      throw new Error('Feishu client not connected');
    }
    await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: msg.chatId,
        content: JSON.stringify({ text: msg.content }),
        msg_type: 'text',
      },
    });
  }
}
