/**
 * WhatsApp 授权命令
 * 用于 WhatsApp 二维码或配对码登录
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import readline from 'readline';
import makeWASocket, { DisconnectReason, useMultiFileAuthState, Browsers } from 'baileys';
import qrcode from 'qrcode-terminal';
import { success, error, info } from './ui';
import { loadConfig } from '../../../shared/src';
import { expandHome } from '@nanobot/utils';
import { createLogger } from '../../../logger/src';

// 静默 logger 供 baileys 使用，不输出库内日志
const logger = createLogger(undefined, { level: 'silent' });

const MAX_RETRIES = 5;
const RETRY_DELAY = 3000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkWhatsAppStatus(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    error('No config found. Run "nanobot init" first.');
    process.exit(1);
  }

  const authDir = expandHome('~/.nanobot/whatsapp_auth');
  try {
    const { state } = await useMultiFileAuthState(authDir);
    if (state.creds.registered) {
      success('WhatsApp is authenticated!');
      info(`Auth directory: ${authDir}`);
      if (state.creds.me) {
        info(`User ID: ${state.creds.me.id}`);
        info(`User name: ${state.creds.me.name || 'Not set'}`);
      }
    } else {
      info('WhatsApp is not authenticated.');
      info('Run "nanobot whatsapp:auth" to authenticate.');
    }
  } catch (err) {
    info('WhatsApp is not authenticated.');
    info('Run "nanobot whatsapp:auth" to authenticate.');
  }
}

async function clearWhatsAppAuth(): Promise<void> {
  const authDir = expandHome('~/.nanobot/whatsapp_auth');

  try {
    const { state } = await useMultiFileAuthState(authDir);
    if (!state.creds.registered) {
      info('WhatsApp is not authenticated. Nothing to clear.');
      process.exit(0);
    }
  } catch {
    info('WhatsApp is not authenticated. Nothing to clear.');
    process.exit(0);
  }

  const answer = await askQuestion(
    'Are you sure you want to clear WhatsApp authentication? (yes/no): ',
  );

  if (answer.toLowerCase() !== 'yes') {
    info('Operation cancelled.');
    process.exit(0);
  }

  try {
    await fs.remove(authDir);
    success('WhatsApp authentication cleared successfully!');
    info(`Removed directory: ${authDir}`);
  } catch (err) {
    error(`Failed to clear authentication: ${err}`);
    process.exit(1);
  }
}

async function askQuestion(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function authWhatsApp(
  usePairingCode: boolean,
  phoneNumber?: string,
  force?: boolean,
  retryCount = 0,
): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    error('No config found. Run "nanobot init" first.');
    process.exit(1);
  }

  const authDir = expandHome('~/.nanobot/whatsapp_auth');
  await fs.ensureDir(authDir);

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  if (state.creds.registered && !force) {
    info('WhatsApp already authenticated!');
    info(`Auth directory: ${authDir}`);
    info('To re-authenticate, use --force flag or delete auth directory.');
    process.exit(0);
  }

  if (state.creds.registered && force) {
    info('Forcing re-authentication...');
    try {
      await fs.remove(authDir);
      await fs.ensureDir(authDir);
      const newState = await useMultiFileAuthState(authDir);
      state.creds = newState.state.creds;
      state.keys = newState.state.keys;
    } catch (err) {
      error(`Failed to clear auth directory: ${err}`);
      process.exit(1);
    }
  }

  let phone = phoneNumber;
  if (usePairingCode && !phone) {
    phone = await askQuestion(
      'Enter your phone number (with country code, no + or spaces, e.g. 86123456789): ',
    );
  }

  info('Starting WhatsApp authentication...\n');

  if (retryCount > 0) {
    info(`Retry attempt ${retryCount}/${MAX_RETRIES}`);
  }

  const sock = makeWASocket({
    auth: state,
    logger,
    browser: Browsers.macOS('Chrome'),
    printQRInTerminal: false,
  });

  if (usePairingCode && phone && !state.creds.me) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phone);
        console.log(`\n🔗 WhatsApp 配对码: ${code}\n`);
        console.log('  1. 打开手机 WhatsApp');
        console.log('  2. 设置 → 已连接的设备 → 连接设备');
        console.log('  3. 点击"使用手机号码连接"');
        console.log(`  4. 输入配对码: ${code}\n`);
      } catch (err: any) {
        error(`Failed to request pairing code: ${err.message}`);
        process.exit(1);
      }
    }, 3000);
  }

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 扫描此二维码登录 WhatsApp:\n');
      console.log('  1. 打开手机 WhatsApp');
      console.log('  2. 设置 → 已连接的设备 → 连接设备');
      console.log('  3. 使用相机扫描下方二维码\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const reason = (lastDisconnect?.error as any)?.output?.statusCode;

      if (reason === DisconnectReason.loggedOut) {
        error('Logged out. Delete auth directory and try again.');
        process.exit(1);
      } else if (reason === DisconnectReason.timedOut) {
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
      } else if (reason === 515) {
        if (retryCount < MAX_RETRIES) {
          info('Stream error (515) after pairing — reconnecting...');
          await sleep(1000);
          await authWhatsApp(usePairingCode, phone, force, retryCount + 1);
          return;
        } else {
          error(`Connection failed after ${MAX_RETRIES} retries. Please try again later.`);
          process.exit(1);
        }
      } else {
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAY * (retryCount + 1);
          console.warn(
            `\n⚠️  连接失败 (${reason})，${delay / 1000} 秒后重试 (${retryCount + 1}/${MAX_RETRIES})...\n`,
          );
          await sleep(delay);
          await authWhatsApp(usePairingCode, phone, force, retryCount + 1);
          return;
        } else {
          error(
            `Connection failed (${reason}) after ${MAX_RETRIES} retries. Please try again later.`,
          );
          process.exit(1);
        }
      }
    }

    if (connection === 'open') {
      success('Successfully authenticated with WhatsApp!');
      info(`Credentials saved to ${authDir}`);
      info('You can now enable WhatsApp in your config and run "nanobot gateway".\n');

      setTimeout(() => process.exit(0), 1000);
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

export function registerWhatsAppAuthCommand(program: Command): void {
  program
    .command('whatsapp:auth')
    .description('Authenticate with WhatsApp (QR code or pairing code)')
    .option('-p, --pairing-code', 'Use pairing code instead of QR code')
    .option('--phone <number>', 'Phone number for pairing code (e.g. 86123456789)')
    .option('-f, --force', 'Force re-authentication (clears existing credentials)')
    .action(async (opts: { pairingCode?: boolean; phone?: string; force?: boolean }) => {
      await authWhatsApp(opts.pairingCode ?? false, opts.phone, opts.force);
    });

  program
    .command('whatsapp:status')
    .description('Check WhatsApp authentication status')
    .action(async () => {
      await checkWhatsAppStatus();
    });

  program
    .command('whatsapp:logout')
    .description('Clear WhatsApp authentication credentials')
    .action(async () => {
      await clearWhatsAppAuth();
    });
}
