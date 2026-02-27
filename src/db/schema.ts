import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  rawInput: text('raw_input').notNull(),
  augmentedPrompt: text('augmented_prompt').notNull(),
  topicType: text('topic_type').notNull(),
  framework: text('framework').notNull(),
  models: text('models').notNull(), // JSON array of model names
})

export const responses = sqliteTable('responses', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  round: integer('round').notNull(), // 1 or 2
  model: text('model').notNull(),
  content: text('content').notNull(),
  sources: text('sources'), // JSON array of { url, title }, nullable
})
