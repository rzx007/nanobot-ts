/**
 * Feishu 渠道 (@larksuiteoapi/node-sdk)
 * WebSocket 接收消息，API 发送消息
 */

import * as lark from '@larksuiteoapi/node-sdk';
import type { InboundMessage, OutboundMessage } from '../bus/events';
import type { BaseChannel } from './base';
import type { FeishuConfig } from '../config/schema';
import { logger } from '../utils/logger';
import { MessageBus } from '@/bus/queue';

/** 仅当消息 @ 了以下名称之一的机器人时才回复（与飞书 mentions[].name 匹配，不区分大小写） */
const REPLY_AT_BOT_NAMES = ['cicibot', 'nanobot'];

/** 飞书消息中的 @ 提及项 */
interface FeishuMention {
  key?: string;
  name?: string;
}

export interface FeishuChannelConfig extends FeishuConfig { }

export class FeishuChannel implements BaseChannel {
  private client: lark.Client | null = null;
  private wsClient: lark.WSClient | null = null;

  constructor(
    private readonly config: FeishuChannelConfig,
    private readonly bus: MessageBus
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
        message?: {
          chat_id?: string;
          chat_type?: string
          content?: string;
          create_time?: string;
          sender?: { sender_id?: { user_id?: string } };
          mentions?: FeishuMention[];
        };
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
        const isGroupChat = msg.chat_type === 'group';
        // 仅当消息 @ 了配置的机器人时处理（按飞书 mentions[].name 判断）
        const mentions = msg.mentions ?? [];
        const isAtBot = mentions.some(
          (m) => m.name && REPLY_AT_BOT_NAMES.includes(m.name.toLowerCase())
        );
        // 群聊中只有@了机器人才处理
        if (!isAtBot && isGroupChat) return;
        // 去掉正文中的 @ 占位符（如 @_user_1），只保留实际内容
        let contentText = text;
        for (const m of mentions) {
          if (m.key) contentText = contentText.replace(m.key, '').trim();
        }
        contentText = contentText.replace(/\s+/g, ' ').trim();
        if (!contentText) return;
        const senderId = msg.sender?.sender_id?.user_id ?? msg.chat_id;
        if (allowFrom.length > 0 && !allowFrom.includes(senderId)) return;

        const inbound: InboundMessage = {
          channel: 'feishu',
          senderId,
          chatId: msg.chat_id,
          content: contentText,
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
