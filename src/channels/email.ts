/**
 * Email 渠道 (imapflow + nodemailer)
 * IMAP 轮询接收，SMTP 发送
 */

import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import type { InboundMessage, OutboundMessage } from '../bus/events';
import type { BaseChannel } from './base';
import type { EmailConfig } from '../config/schema';
import { logger } from '../utils/logger';

export interface EmailChannelConfig extends EmailConfig {}

const EMAIL_POLL_INTERVAL_MS = 60_000;

export class EmailChannel implements BaseChannel {
  private imap: ImapFlow | null = null;
  private smtp: nodemailer.Transporter | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastCount = 0;

  constructor(
    private readonly config: EmailChannelConfig,
    private readonly bus: { publishInbound: (msg: InboundMessage) => Promise<void> }
  ) {}

  async start(): Promise<void> {
    const {
      imapHost,
      imapPort,
      imapUsername,
      imapPassword,
      imapMailbox,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      allowFrom,
    } = this.config;

    this.imap = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: imapPort === 993,
      auth: { user: imapUsername, pass: imapPassword },
      logger: false,
    });

    await this.imap.connect();
    logger.info('Email IMAP connected');

    const status = await this.imap.status(imapMailbox, { messages: true });
    this.lastCount = status.messages ?? 0;

    this.smtp = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUsername, pass: smtpPassword },
    });

    this.pollTimer = setInterval(() => {
      this.pollNewMessages(imapMailbox, allowFrom).catch((err) => {
        logger.error({ err }, 'Email poll error');
      });
    }, EMAIL_POLL_INTERVAL_MS);
    logger.info('Email channel started (polling every %s s)', EMAIL_POLL_INTERVAL_MS / 1000);
  }

  private async pollNewMessages(mailbox: string, allowFrom: string[]): Promise<void> {
    if (!this.imap) return;
    const status = await this.imap.status(mailbox, { messages: true });
    const count = status.messages ?? 0;
    if (count <= this.lastCount) return;
    const fromSeq = this.lastCount + 1;
    this.lastCount = count;
    const lock = await this.imap.getMailboxLock(mailbox);
    try {
      await this.handleNewMessages(fromSeq, count, allowFrom);
    } finally {
      lock.release();
    }
  }

  private async handleNewMessages(
    fromSeq: number,
    toCount: number,
    allowFrom: string[]
  ): Promise<void> {
    if (!this.imap) return;
    const range = `${fromSeq}:${toCount}`;
    for await (const msg of this.imap.fetch(
      range,
      { envelope: true, source: true },
      { uid: false }
    )) {
      const env = msg.envelope;
      const fromAddr = env?.from?.[0]?.address ?? '';
      if (allowFrom.length > 0 && !allowFrom.some((a) => fromAddr.includes(a) || a.includes(fromAddr))) continue;

      let text = '';
      if (msg.source) {
        const raw = typeof msg.source === 'string' ? msg.source : msg.source.toString('utf-8');
        const bodyMatch = raw.match(/\n\n([\s\S]*)$/);
        text = (bodyMatch?.[1] ?? raw).trim().slice(0, 50_000);
      }

      const inbound: InboundMessage = {
        channel: 'email',
        senderId: fromAddr,
        chatId: fromAddr,
        content: text || '(no text)',
        timestamp: new Date(env?.date ?? Date.now()),
        metadata: { subject: env?.subject },
      };
      await this.bus.publishInbound(inbound);
    }
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.imap) {
      await this.imap.logout();
      this.imap.close();
      this.imap = null;
    }
    if (this.smtp) {
      this.smtp.close();
      this.smtp = null;
    }
    logger.info('Email channel stopped');
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.smtp) {
      throw new Error('SMTP not configured');
    }
    const subject = (msg.metadata?.subject as string) || 'Re: ';
    await this.smtp.sendMail({
      from: this.config.fromAddress,
      to: msg.chatId,
      subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      text: msg.content,
    });
  }
}
