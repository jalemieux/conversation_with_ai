import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { conversations, responses } from './schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

describe('Database Schema', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle>

  beforeEach(() => {
    sqlite = new Database(':memory:')
    db = drizzle(sqlite)

    // Create tables directly for testing
    sqlite.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        raw_input TEXT NOT NULL,
        augmented_prompt TEXT NOT NULL,
        topic_type TEXT NOT NULL,
        framework TEXT NOT NULL,
        models TEXT NOT NULL
      );
      CREATE TABLE responses (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        round INTEGER NOT NULL,
        model TEXT NOT NULL,
        content TEXT NOT NULL,
        sources TEXT
      );
    `)
  })

  afterEach(() => {
    sqlite.close()
  })

  it('should insert and retrieve a conversation', async () => {
    const id = randomUUID()
    await db.insert(conversations).values({
      id,
      rawInput: 'Future of software',
      augmentedPrompt: 'Analyze the future of software...',
      topicType: 'prediction',
      framework: 'scenario_analysis',
      models: JSON.stringify(['claude', 'gpt4', 'gemini', 'grok']),
    })

    const result = await db.select().from(conversations).where(eq(conversations.id, id))
    expect(result).toHaveLength(1)
    expect(result[0].rawInput).toBe('Future of software')
    expect(result[0].topicType).toBe('prediction')
  })

  it('should have sources column on responses table', () => {
    const columns = Object.keys(responses)
    expect(columns).toContain('sources')
  })

  it('should insert and retrieve responses linked to a conversation', async () => {
    const convId = randomUUID()
    await db.insert(conversations).values({
      id: convId,
      rawInput: 'Test',
      augmentedPrompt: 'Test augmented',
      topicType: 'open_question',
      framework: 'multiple_angles',
      models: JSON.stringify(['claude', 'gpt4']),
    })

    const respId = randomUUID()
    await db.insert(responses).values({
      id: respId,
      conversationId: convId,
      round: 1,
      model: 'claude',
      content: 'Here is my response...',
    })

    const result = await db.select().from(responses).where(eq(responses.conversationId, convId))
    expect(result).toHaveLength(1)
    expect(result[0].round).toBe(1)
    expect(result[0].model).toBe('claude')
  })
})
