import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'conversations.db')

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

// Create tables if they don't exist
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

export const db = drizzle(sqlite, { schema })
