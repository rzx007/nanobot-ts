/**
 * Database initialization script
 *
 * 创建数据库表结构
 */

import path from 'path';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { sql } from 'drizzle-orm';
import * as schema from './schema';
import { logger } from '@nanobot/logger';

export async function initializeDatabase(workspace: string): Promise<void> {
  const dbPath = path.join(path.resolve(workspace), 'sessions.db');

  logger.info(`Initializing database at: ${dbPath}`);

  // 创建数据库连接
  const sqlite = new Database(dbPath);
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');

  const db = drizzle(sqlite, { schema });

  // 创建表（如果不存在）
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      key TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      last_consolidated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS session_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      message_id TEXT UNIQUE,
      parts TEXT,
      metadata TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      model TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (session_key) REFERENCES sessions(key) ON DELETE CASCADE
    )
  `);

  // 创建索引
  await db.run(sql`CREATE INDEX IF NOT EXISTS sessions_channel_idx ON sessions(channel)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS sessions_chat_id_idx ON sessions(chat_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS sessions_channel_chat_id_idx ON sessions(channel, chat_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS sessions_updated_at_idx ON sessions(updated_at)`);

  await db.run(sql`CREATE INDEX IF NOT EXISTS session_messages_session_key_idx ON session_messages(session_key)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS session_messages_timestamp_idx ON session_messages(timestamp)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS session_messages_session_key_timestamp_idx ON session_messages(session_key, timestamp)`);

  logger.info('Database initialized successfully');

  // 关闭连接
  sqlite.close();
}

// CLI 运行
if (import.meta.main) {
  const workspace = process.argv[2] || './workspace';
  initializeDatabase(workspace).catch(err => {
    logger.error({ err }, 'Failed to initialize database');
    process.exit(1);
  });
}
