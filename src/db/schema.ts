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
  userId: text('user_id').references(() => users.id),
})

export const responses = sqliteTable('responses', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  round: integer('round').notNull(), // 1 or 2
  model: text('model').notNull(),
  content: text('content').notNull(),
  sources: text('sources'), // JSON array of { url, title }, nullable
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cost: text('cost'),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: text('email_verified'),
  image: text('image'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: text('subscription_status').notNull().default('none'),
  subscriptionCurrentPeriodEnd: text('subscription_current_period_end'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
})

export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: text('expires').notNull(),
})

export const userApiKeys = sqliteTable('user_api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})
