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
      content TEXT NOT NULL
    );
  `)

  _db = drizzle(sqlite, { schema })
  return _db
}

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    return (initDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
