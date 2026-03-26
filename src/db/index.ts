import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.CWAI_DB_PATH || path.join(process.cwd(), 'data', 'conversations.db')

let _db: BetterSQLite3Database<typeof schema> | null = null

function initDb(): BetterSQLite3Database<typeof schema> {
  if (_db) return _db

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      raw_input TEXT NOT NULL,
      augmented_prompt TEXT NOT NULL,
      topic_type TEXT NOT NULL,
      framework TEXT NOT NULL,
      models TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      round INTEGER NOT NULL,
      model TEXT NOT NULL,
      content TEXT NOT NULL,
      sources TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost TEXT
    );
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL UNIQUE,
      email_verified TEXT,
      image TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'none',
      subscription_current_period_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT
    );
    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, provider)
    );
  `)

  // Migration: add sources column if missing (for existing databases)
  const hasSourcesColumn = sqlite.prepare(
    `SELECT COUNT(*) as cnt FROM pragma_table_info('responses') WHERE name = 'sources'`
  ).get() as { cnt: number }
  if (hasSourcesColumn.cnt === 0) {
    sqlite.exec(`ALTER TABLE responses ADD COLUMN sources TEXT`)
  }

  // Migration: add token tracking columns if missing
  const hasInputTokens = sqlite.prepare(
    `SELECT COUNT(*) as cnt FROM pragma_table_info('responses') WHERE name = 'input_tokens'`
  ).get() as { cnt: number }
  if (hasInputTokens.cnt === 0) {
    sqlite.exec(`ALTER TABLE responses ADD COLUMN input_tokens INTEGER`)
    sqlite.exec(`ALTER TABLE responses ADD COLUMN output_tokens INTEGER`)
    sqlite.exec(`ALTER TABLE responses ADD COLUMN cost TEXT`)
  }

  // Migration: add user_id column to conversations if missing
  const hasUserId = sqlite.prepare(
    `SELECT COUNT(*) as cnt FROM pragma_table_info('conversations') WHERE name = 'user_id'`
  ).get() as { cnt: number }
  if (hasUserId.cnt === 0) {
    sqlite.exec(`ALTER TABLE conversations ADD COLUMN user_id TEXT REFERENCES users(id)`)
  }

  // Migration: add draft conversation support columns if missing
  const hasStatus = sqlite.prepare(
    `SELECT COUNT(*) as cnt FROM pragma_table_info('conversations') WHERE name = 'status'`
  ).get() as { cnt: number }
  if (hasStatus.cnt === 0) {
    sqlite.exec(`ALTER TABLE conversations ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'`)
    sqlite.exec(`ALTER TABLE conversations ADD COLUMN essay_mode INTEGER NOT NULL DEFAULT 0`)
    sqlite.exec(`ALTER TABLE conversations ADD COLUMN response_length TEXT NOT NULL DEFAULT 'standard'`)
    sqlite.exec(`ALTER TABLE conversations ADD COLUMN augmentations TEXT`)
    sqlite.exec(`UPDATE conversations SET status = 'completed'`)
  }

  _db = drizzle(sqlite, { schema })
  return _db
}

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    return (initDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
