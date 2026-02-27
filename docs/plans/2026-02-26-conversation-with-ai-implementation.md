# Conversation With AI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app where users type a topic, it gets augmented with an analytical framework, then 4 frontier AI models discuss it in two rounds, producing a publishable conversation transcript.

**Architecture:** Next.js App Router with API routes for prompt augmentation (Claude Haiku) and conversation orchestration (4 models in parallel). SQLite via Drizzle ORM for persistence. Vercel AI SDK for unified model access. Three-screen SPA: Home → Review → Conversation.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Drizzle ORM, better-sqlite3, Vercel AI SDK (@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/google, @ai-sdk/xai), Vitest

---

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `tsconfig.json` (via create-next-app)
- Create: `tailwind.config.ts` (via create-next-app)
- Create: `.env.local`
- Create: `.gitignore`

**Step 1: Scaffold Next.js project**

Run from the parent directory (`/Users/jac/Dev/src/`):
```bash
cd /Users/jac/Dev/src/conversation_with_ai
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. If it asks about overwriting, say yes (the directory only has docs/).

Expected: Project scaffolded with `src/app/`, `package.json`, etc.

**Step 2: Install dependencies**

```bash
npm install drizzle-orm better-sqlite3 @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google @ai-sdk/xai ai uuid
npm install -D drizzle-kit @types/better-sqlite3 @types/uuid vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

**Step 3: Create .env.local**

Create `.env.local`:
```
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
XAI_API_KEY=your-key-here
```

**Step 4: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Create `src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest'
```

**Step 5: Add test script to package.json**

Add to `package.json` scripts:
```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 6: Verify setup**

```bash
npm run build
```
Expected: Build succeeds

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize Next.js project with dependencies"
```

---

### Task 2: Database Schema & Access Layer

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`
- Create: `src/db/schema.test.ts`
- Create: `drizzle.config.ts`

**Step 1: Write the failing test**

Create `src/db/schema.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
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
        content TEXT NOT NULL
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
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/db/schema.test.ts
```
Expected: FAIL — `./schema` module not found

**Step 3: Write the schema**

Create `src/db/schema.ts`:
```typescript
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
})
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/db/schema.test.ts
```
Expected: PASS

**Step 5: Write the database singleton**

Create `src/db/index.ts`:
```typescript
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
```

**Step 6: Create drizzle config**

Create `drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/conversations.db',
  },
})
```

**Step 7: Add `data/` to .gitignore**

Append to `.gitignore`:
```
# Database
data/
```

**Step 8: Commit**

```bash
git add src/db/ drizzle.config.ts .gitignore
git commit -m "feat: add database schema and access layer (conversations + responses)"
```

---

### Task 3: Model Configuration & Provider Registry

**Files:**
- Create: `src/lib/models.ts`
- Create: `src/lib/models.test.ts`

**Step 1: Write the failing test**

Create `src/lib/models.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { MODEL_CONFIGS, getModelProvider, getDefaultModels } from './models'

describe('Model Configuration', () => {
  it('should have 4 model configs', () => {
    expect(Object.keys(MODEL_CONFIGS)).toHaveLength(4)
  })

  it('should have required fields for each model', () => {
    for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
      expect(config.id).toBe(key)
      expect(config.name).toBeTruthy()
      expect(config.provider).toBeTruthy()
      expect(config.modelId).toBeTruthy()
    }
  })

  it('should return a provider instance for each model', () => {
    for (const key of Object.keys(MODEL_CONFIGS)) {
      const provider = getModelProvider(key)
      expect(provider).toBeDefined()
    }
  })

  it('should return all 4 default models', () => {
    const defaults = getDefaultModels()
    expect(defaults).toHaveLength(4)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/models.test.ts
```
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/lib/models.ts`:
```typescript
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import { xai } from '@ai-sdk/xai'
import type { LanguageModelV1 } from 'ai'

export interface ModelConfig {
  id: string
  name: string
  provider: string
  modelId: string
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6',
  },
  gpt4: {
    id: 'gpt4',
    name: 'GPT-4',
    provider: 'openai',
    modelId: 'gpt-4o',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    provider: 'google',
    modelId: 'gemini-2.5-pro-preview-06-05',
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    provider: 'xai',
    modelId: 'grok-3',
  },
}

const PROVIDERS: Record<string, (modelId: string) => LanguageModelV1> = {
  anthropic: (modelId) => anthropic(modelId),
  openai: (modelId) => openai(modelId),
  google: (modelId) => google(modelId),
  xai: (modelId) => xai(modelId),
}

export function getModelProvider(modelKey: string): LanguageModelV1 {
  const config = MODEL_CONFIGS[modelKey]
  if (!config) throw new Error(`Unknown model: ${modelKey}`)
  return PROVIDERS[config.provider](config.modelId)
}

export function getDefaultModels(): string[] {
  return Object.keys(MODEL_CONFIGS)
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/models.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/models.ts src/lib/models.test.ts
git commit -m "feat: add model configuration and provider registry"
```

---

### Task 4: Prompt Augmenter Logic

**Files:**
- Create: `src/lib/augmenter.ts`
- Create: `src/lib/augmenter.test.ts`

**Step 1: Write the failing test**

Create `src/lib/augmenter.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { buildAugmenterPrompt, parseAugmenterResponse } from './augmenter'

describe('Prompt Augmenter', () => {
  describe('buildAugmenterPrompt', () => {
    it('should create a system prompt for topic classification and augmentation', () => {
      const prompt = buildAugmenterPrompt('Future of software')
      expect(prompt).toContain('Future of software')
      expect(prompt).toContain('topic_type')
      expect(prompt).toContain('framework')
      expect(prompt).toContain('augmented_prompt')
    })
  })

  describe('parseAugmenterResponse', () => {
    it('should parse a valid JSON response', () => {
      const json = JSON.stringify({
        topic_type: 'prediction',
        framework: 'scenario_analysis',
        augmented_prompt: 'Analyze the future of software engineering...',
      })

      const result = parseAugmenterResponse(json)
      expect(result.topicType).toBe('prediction')
      expect(result.framework).toBe('scenario_analysis')
      expect(result.augmentedPrompt).toContain('future of software')
    })

    it('should handle JSON wrapped in markdown code blocks', () => {
      const wrapped = '```json\n{"topic_type":"comparison","framework":"strongest_case","augmented_prompt":"Compare Rust and Go..."}\n```'
      const result = parseAugmenterResponse(wrapped)
      expect(result.topicType).toBe('comparison')
    })

    it('should throw on invalid JSON', () => {
      expect(() => parseAugmenterResponse('not json')).toThrow()
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/augmenter.test.ts
```
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/lib/augmenter.ts`:
```typescript
export const TOPIC_TYPES = [
  'prediction',
  'opinion',
  'comparison',
  'trend_analysis',
  'open_question',
] as const

export type TopicType = (typeof TOPIC_TYPES)[number]

export interface AugmenterResult {
  topicType: TopicType
  framework: string
  augmentedPrompt: string
}

export function buildAugmenterPrompt(rawInput: string): string {
  return `You are a prompt augmenter. Given a user's raw topic or question, you must:

1. Classify it into one topic_type: prediction, opinion, comparison, trend_analysis, open_question
2. Select the appropriate analytical framework:
   - prediction → scenario analysis, 1st/2nd order effects
   - opinion → steel man vs straw man
   - comparison → strongest case for each side
   - trend_analysis → timeline framing, recent context
   - open_question → multiple angles, trade-offs
3. Rewrite the prompt to be clear and structured, adding at most 1-2 sentences of analytical framing

Principles:
- Add structure and depth, not fluff
- Keep it concise
- Preserve the user's nuance and framing
- Don't over-constrain with too many sub-questions

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "topic_type": "one of: prediction, opinion, comparison, trend_analysis, open_question",
  "framework": "brief name of the framework applied",
  "augmented_prompt": "the rewritten prompt"
}

User's raw input: "${rawInput}"`
}

export function parseAugmenterResponse(text: string): AugmenterResult {
  // Strip markdown code blocks if present
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const parsed = JSON.parse(cleaned)

  return {
    topicType: parsed.topic_type,
    framework: parsed.framework,
    augmentedPrompt: parsed.augmented_prompt,
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/augmenter.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/augmenter.ts src/lib/augmenter.test.ts
git commit -m "feat: add prompt augmenter logic (classify + rewrite)"
```

---

### Task 5: Conversation Orchestrator Logic

**Files:**
- Create: `src/lib/orchestrator.ts`
- Create: `src/lib/orchestrator.test.ts`

**Step 1: Write the failing test**

Create `src/lib/orchestrator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildRound1Prompt, buildRound2Prompt } from './orchestrator'

describe('Conversation Orchestrator', () => {
  describe('buildRound1Prompt', () => {
    it('should format the augmented prompt for a model', () => {
      const prompt = buildRound1Prompt('Analyze the future of software...', 'Claude')
      expect(prompt).toContain('Analyze the future of software...')
      expect(prompt).toContain('Claude')
    })
  })

  describe('buildRound2Prompt', () => {
    it('should include all other models responses', () => {
      const round1Responses = [
        { model: 'Claude', content: 'Claude says...' },
        { model: 'GPT-4', content: 'GPT-4 says...' },
        { model: 'Gemini', content: 'Gemini says...' },
        { model: 'Grok', content: 'Grok says...' },
      ]

      const prompt = buildRound2Prompt(
        'Analyze the future of software...',
        'Claude',
        round1Responses
      )

      // Should contain other models' responses but indicate this is Claude's turn
      expect(prompt).toContain('Claude')
      expect(prompt).toContain('GPT-4 says...')
      expect(prompt).toContain('Gemini says...')
      expect(prompt).toContain('Grok says...')
    })

    it('should not include the current model in "other responses"', () => {
      const round1Responses = [
        { model: 'Claude', content: 'Claude says...' },
        { model: 'GPT-4', content: 'GPT-4 says...' },
      ]

      const prompt = buildRound2Prompt(
        'Some topic',
        'Claude',
        round1Responses
      )

      // The prompt should present other models' responses separately from Claude's own
      expect(prompt).toContain('GPT-4')
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/orchestrator.test.ts
```
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/lib/orchestrator.ts`:
```typescript
export interface Round1Response {
  model: string
  content: string
}

export function buildRound1Prompt(augmentedPrompt: string, modelName: string): string {
  return `You are ${modelName}, participating in a roundtable discussion with other frontier AI models. A moderator has posed the following topic for discussion.

Give your genuine, thoughtful perspective. Be substantive and specific — this will be published as a conversation transcript.

Topic:
${augmentedPrompt}`
}

export function buildRound2Prompt(
  augmentedPrompt: string,
  modelName: string,
  round1Responses: Round1Response[]
): string {
  const otherResponses = round1Responses
    .filter((r) => r.model !== modelName)
    .map((r) => `### ${r.model}\n${r.content}`)
    .join('\n\n')

  const ownResponse = round1Responses.find((r) => r.model === modelName)

  return `You are ${modelName}, continuing a roundtable discussion. The original topic was:

${augmentedPrompt}

Your initial response was:
${ownResponse?.content ?? '(no initial response)'}

Here are the other models' initial responses:

${otherResponses}

Now react to what the others said. You may agree, disagree, build on ideas, or offer new perspectives. Be direct and substantive — avoid generic praise. This is Round 2 of a published conversation.`
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/orchestrator.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/orchestrator.ts src/lib/orchestrator.test.ts
git commit -m "feat: add conversation orchestrator prompt builders"
```

---

### Task 6: Augment API Route

**Files:**
- Create: `src/app/api/augment/route.ts`

**Step 1: Write the API route**

Create `src/app/api/augment/route.ts`:
```typescript
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { buildAugmenterPrompt, parseAugmenterResponse } from '@/lib/augmenter'

export async function POST(request: Request) {
  const { rawInput } = await request.json()

  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })
  }

  const prompt = buildAugmenterPrompt(rawInput.trim())

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    prompt,
    maxTokens: 500,
  })

  const result = parseAugmenterResponse(text)

  return NextResponse.json({
    rawInput: rawInput.trim(),
    topicType: result.topicType,
    framework: result.framework,
    augmentedPrompt: result.augmentedPrompt,
  })
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/augment/route.ts
git commit -m "feat: add /api/augment endpoint for prompt augmentation"
```

---

### Task 7: Conversation API Route (Round 1 + Round 2 with Streaming)

**Files:**
- Create: `src/app/api/conversation/route.ts`

This is the most complex endpoint. It orchestrates two rounds of parallel model calls and streams progress back to the client as Server-Sent Events (SSE).

**Step 1: Write the API route**

Create `src/app/api/conversation/route.ts`:
```typescript
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations, responses } from '@/db/schema'
import { getModelProvider, MODEL_CONFIGS } from '@/lib/models'
import { buildRound1Prompt, buildRound2Prompt } from '@/lib/orchestrator'
import type { Round1Response } from '@/lib/orchestrator'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  const { rawInput, augmentedPrompt, topicType, framework, models } = await request.json()

  if (!augmentedPrompt || !models || !Array.isArray(models) || models.length === 0) {
    return NextResponse.json({ error: 'augmentedPrompt and models are required' }, { status: 400 })
  }

  const conversationId = randomUUID()

  // Save conversation
  await db.insert(conversations).values({
    id: conversationId,
    rawInput: rawInput ?? '',
    augmentedPrompt,
    topicType: topicType ?? 'open_question',
    framework: framework ?? 'multiple_angles',
    models: JSON.stringify(models),
  })

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Round 1: All models in parallel
        send('round_start', { round: 1 })

        const round1Results: Round1Response[] = await Promise.all(
          models.map(async (modelKey: string) => {
            const config = MODEL_CONFIGS[modelKey]
            const prompt = buildRound1Prompt(augmentedPrompt, config.name)

            const { text } = await generateText({
              model: getModelProvider(modelKey),
              prompt,
              maxTokens: 1500,
            })

            const respId = randomUUID()
            await db.insert(responses).values({
              id: respId,
              conversationId,
              round: 1,
              model: modelKey,
              content: text,
            })

            send('response', { round: 1, model: modelKey, modelName: config.name, content: text })
            return { model: config.name, content: text }
          })
        )

        send('round_complete', { round: 1 })

        // Round 2: All models react in parallel
        send('round_start', { round: 2 })

        await Promise.all(
          models.map(async (modelKey: string) => {
            const config = MODEL_CONFIGS[modelKey]
            const prompt = buildRound2Prompt(augmentedPrompt, config.name, round1Results)

            const { text } = await generateText({
              model: getModelProvider(modelKey),
              prompt,
              maxTokens: 1500,
            })

            const respId = randomUUID()
            await db.insert(responses).values({
              id: respId,
              conversationId,
              round: 2,
              model: modelKey,
              content: text,
            })

            send('response', { round: 2, model: modelKey, modelName: config.name, content: text })
          })
        )

        send('round_complete', { round: 2 })
        send('done', { conversationId })
      } catch (error) {
        send('error', { message: error instanceof Error ? error.message : 'Unknown error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/conversation/route.ts
git commit -m "feat: add /api/conversation endpoint with SSE streaming (round 1 + round 2)"
```

---

### Task 8: Conversation Data Fetching API

**Files:**
- Create: `src/app/api/conversations/route.ts`
- Create: `src/app/api/conversations/[id]/route.ts`

**Step 1: Write the list endpoint**

Create `src/app/api/conversations/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations } from '@/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  const result = await db
    .select({
      id: conversations.id,
      createdAt: conversations.createdAt,
      rawInput: conversations.rawInput,
      topicType: conversations.topicType,
    })
    .from(conversations)
    .orderBy(desc(conversations.createdAt))
    .limit(20)

  return NextResponse.json(result)
}
```

**Step 2: Write the detail endpoint**

Create `src/app/api/conversations/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations, responses } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const conv = await db.select().from(conversations).where(eq(conversations.id, id))
  if (conv.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const resps = await db.select().from(responses).where(eq(responses.conversationId, id))

  return NextResponse.json({
    ...conv[0],
    models: JSON.parse(conv[0].models),
    responses: resps,
  })
}
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: No type errors

**Step 4: Commit**

```bash
git add src/app/api/conversations/
git commit -m "feat: add conversation list and detail API endpoints"
```

---

### Task 9: Shared Types & Export Utilities

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/export.ts`
- Create: `src/lib/export.test.ts`

**Step 1: Write the shared types**

Create `src/lib/types.ts`:
```typescript
export interface ConversationResponse {
  id: string
  round: number
  model: string
  content: string
}

export interface Conversation {
  id: string
  createdAt: string
  rawInput: string
  augmentedPrompt: string
  topicType: string
  framework: string
  models: string[]
  responses: ConversationResponse[]
}

export interface SSEEvent {
  event: string
  data: {
    round?: number
    model?: string
    modelName?: string
    content?: string
    conversationId?: string
    message?: string
  }
}
```

**Step 2: Write the failing export test**

Create `src/lib/export.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { exportMarkdown, exportText, exportXThread } from './export'
import type { Conversation } from './types'

const mockConversation: Conversation = {
  id: '123',
  createdAt: '2026-02-26T12:00:00Z',
  rawInput: 'Future of software',
  augmentedPrompt: 'Analyze the future of software engineering...',
  topicType: 'prediction',
  framework: 'scenario_analysis',
  models: ['claude', 'gpt4'],
  responses: [
    { id: '1', round: 1, model: 'claude', content: 'Claude Round 1 response' },
    { id: '2', round: 1, model: 'gpt4', content: 'GPT-4 Round 1 response' },
    { id: '3', round: 2, model: 'claude', content: 'Claude Round 2 response' },
    { id: '4', round: 2, model: 'gpt4', content: 'GPT-4 Round 2 response' },
  ],
}

describe('Export Utilities', () => {
  describe('exportMarkdown', () => {
    it('should produce valid markdown with headers', () => {
      const md = exportMarkdown(mockConversation)
      expect(md).toContain('# Future of software')
      expect(md).toContain('## Round 1')
      expect(md).toContain('### Claude')
      expect(md).toContain('## Round 2')
      expect(md).toContain('Claude Round 1 response')
    })
  })

  describe('exportText', () => {
    it('should produce plain text', () => {
      const text = exportText(mockConversation)
      expect(text).toContain('Future of software')
      expect(text).toContain('Round 1')
      expect(text).toContain('Claude Round 1 response')
      expect(text).not.toContain('#')
    })
  })

  describe('exportXThread', () => {
    it('should produce an array of tweets under 280 chars', () => {
      const tweets = exportXThread(mockConversation)
      expect(tweets.length).toBeGreaterThan(0)
      for (const tweet of tweets) {
        expect(tweet.length).toBeLessThanOrEqual(280)
      }
    })

    it('should start with the topic', () => {
      const tweets = exportXThread(mockConversation)
      expect(tweets[0]).toContain('Future of software')
    })
  })
})
```

**Step 3: Run test to verify it fails**

```bash
npx vitest run src/lib/export.test.ts
```
Expected: FAIL — module not found

**Step 4: Write the export implementation**

Create `src/lib/export.ts`:
```typescript
import type { Conversation } from './types'
import { MODEL_CONFIGS } from './models'

function getModelName(modelKey: string): string {
  return MODEL_CONFIGS[modelKey]?.name ?? modelKey
}

export function exportMarkdown(conversation: Conversation): string {
  const lines: string[] = []

  lines.push(`# ${conversation.rawInput}`)
  lines.push('')
  lines.push(`> ${conversation.augmentedPrompt}`)
  lines.push('')

  for (const round of [1, 2]) {
    lines.push(`## Round ${round}`)
    lines.push('')

    const roundResponses = conversation.responses.filter((r) => r.round === round)
    for (const resp of roundResponses) {
      lines.push(`### ${getModelName(resp.model)}`)
      lines.push('')
      lines.push(resp.content)
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function exportText(conversation: Conversation): string {
  const lines: string[] = []

  lines.push(conversation.rawInput.toUpperCase())
  lines.push('')
  lines.push(conversation.augmentedPrompt)
  lines.push('')

  for (const round of [1, 2]) {
    lines.push(`--- Round ${round} ---`)
    lines.push('')

    const roundResponses = conversation.responses.filter((r) => r.round === round)
    for (const resp of roundResponses) {
      lines.push(`[${getModelName(resp.model)}]`)
      lines.push(resp.content)
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function exportXThread(conversation: Conversation): string[] {
  const tweets: string[] = []
  const MAX_LEN = 280

  // Opening tweet
  tweets.push(`${conversation.rawInput} — AI Roundtable Discussion (thread)`.slice(0, MAX_LEN))

  // Each model's Round 1 response, chunked
  const round1 = conversation.responses.filter((r) => r.round === 1)
  for (const resp of round1) {
    const name = getModelName(resp.model)
    const prefix = `${name}:\n`
    const maxContent = MAX_LEN - prefix.length
    const chunks = chunkText(resp.content, maxContent)
    for (const chunk of chunks) {
      tweets.push(`${prefix}${chunk}`.slice(0, MAX_LEN))
    }
  }

  // Round 2 header
  tweets.push('Round 2 — Reactions:'.slice(0, MAX_LEN))

  const round2 = conversation.responses.filter((r) => r.round === 2)
  for (const resp of round2) {
    const name = getModelName(resp.model)
    const prefix = `${name} reacts:\n`
    const maxContent = MAX_LEN - prefix.length
    const chunks = chunkText(resp.content, maxContent)
    for (const chunk of chunks) {
      tweets.push(`${prefix}${chunk}`.slice(0, MAX_LEN))
    }
  }

  return tweets
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }
    // Find last space within limit
    let splitAt = remaining.lastIndexOf(' ', maxLen)
    if (splitAt === -1) splitAt = maxLen
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }
  return chunks
}
```

**Step 5: Run test to verify it passes**

```bash
npx vitest run src/lib/export.test.ts
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/export.ts src/lib/export.test.ts
git commit -m "feat: add shared types and export utilities (markdown, text, X-thread)"
```

---

### Task 10: Home Screen (Frontend)

**Files:**
- Replace: `src/app/page.tsx`
- Replace: `src/app/layout.tsx`
- Replace: `src/app/globals.css`

**Step 1: Update globals.css for minimal Tailwind setup**

Replace `src/app/globals.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 2: Update layout.tsx**

Replace `src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Conversation With AI',
  description: 'Moderate a roundtable discussion between frontier AI models',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <main className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
```

**Step 3: Build the Home page**

Replace `src/app/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { MODEL_CONFIGS } from '@/lib/models'

interface RecentConversation {
  id: string
  createdAt: string
  rawInput: string
  topicType: string
}

export default function Home() {
  const [rawInput, setRawInput] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>(Object.keys(MODEL_CONFIGS))
  const [recent, setRecent] = useState<RecentConversation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/conversations')
      .then((r) => r.json())
      .then(setRecent)
      .catch(() => {})
  }, [])

  const toggleModel = (key: string) => {
    setSelectedModels((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    )
  }

  const handleSubmit = async () => {
    if (!rawInput.trim() || selectedModels.length === 0) return
    setLoading(true)

    try {
      const res = await fetch('/api/augment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: rawInput.trim() }),
      })

      const data = await res.json()

      // Navigate to review page with data in URL params
      const params = new URLSearchParams({
        rawInput: data.rawInput,
        augmentedPrompt: data.augmentedPrompt,
        topicType: data.topicType,
        framework: data.framework,
        models: selectedModels.join(','),
      })
      window.location.href = `/review?${params.toString()}`
    } catch {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Conversation With AI</h1>
      <p className="text-gray-400 mb-8">
        Moderate a roundtable discussion between frontier AI models
      </p>

      <div className="mb-6">
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="Enter a topic or question... e.g. 'Future of software engineering'"
          className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Models</h3>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(MODEL_CONFIGS).map(([key, config]) => (
            <button
              key={key}
              onClick={() => toggleModel(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedModels.includes(key)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {config.name}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !rawInput.trim() || selectedModels.length === 0}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
      >
        {loading ? 'Augmenting...' : 'Start Conversation'}
      </button>

      {recent.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-medium mb-4">Recent Conversations</h2>
          <div className="space-y-2">
            {recent.map((conv) => (
              <a
                key={conv.id}
                href={`/conversation/${conv.id}`}
                className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors"
              >
                <div className="font-medium">{conv.rawInput}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {conv.topicType} — {new Date(conv.createdAt).toLocaleDateString()}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Verify it compiles**

```bash
npm run build
```
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: build home screen with topic input, model selector, recent conversations"
```

---

### Task 11: Review Prompt Screen

**Files:**
- Create: `src/app/review/page.tsx`

**Step 1: Build the Review page**

Create `src/app/review/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function ReviewPage() {
  const searchParams = useSearchParams()

  const rawInput = searchParams.get('rawInput') ?? ''
  const [augmentedPrompt, setAugmentedPrompt] = useState(searchParams.get('augmentedPrompt') ?? '')
  const topicType = searchParams.get('topicType') ?? ''
  const framework = searchParams.get('framework') ?? ''
  const models = searchParams.get('models') ?? ''
  const [regenerating, setRegenerating] = useState(false)

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch('/api/augment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      })
      const data = await res.json()
      setAugmentedPrompt(data.augmentedPrompt)
    } finally {
      setRegenerating(false)
    }
  }

  const handleRun = () => {
    const params = new URLSearchParams({
      rawInput,
      augmentedPrompt,
      topicType,
      framework,
      models,
    })
    window.location.href = `/conversation?${params.toString()}`
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Review Augmented Prompt</h1>

      <div className="mb-4">
        <label className="text-sm font-medium text-gray-400">Your Input</label>
        <p className="mt-1 text-gray-300">{rawInput}</p>
      </div>

      <div className="mb-2 flex gap-2">
        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">{topicType}</span>
        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">{framework}</span>
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium text-gray-400">Augmented Prompt</label>
        <textarea
          value={augmentedPrompt}
          onChange={(e) => setAugmentedPrompt(e.target.value)}
          className="w-full h-40 mt-1 bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-100 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => window.history.back()}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
        >
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
        <button
          onClick={handleRun}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          Run Conversation
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Verify it compiles**

```bash
npm run build
```
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/review/page.tsx
git commit -m "feat: add review prompt screen with edit/regenerate/run"
```

---

### Task 12: Conversation Screen (Streaming)

**Files:**
- Create: `src/app/conversation/page.tsx`

**Step 1: Build the Conversation page (live streaming)**

Create `src/app/conversation/page.tsx`:
```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { MODEL_CONFIGS } from '@/lib/models'

interface ModelResponse {
  round: number
  model: string
  modelName: string
  content: string
}

export default function ConversationPage() {
  const searchParams = useSearchParams()
  const [responses, setResponses] = useState<ModelResponse[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const rawInput = searchParams.get('rawInput') ?? ''
    const augmentedPrompt = searchParams.get('augmentedPrompt') ?? ''
    const topicType = searchParams.get('topicType') ?? ''
    const framework = searchParams.get('framework') ?? ''
    const models = (searchParams.get('models') ?? '').split(',').filter(Boolean)

    if (!augmentedPrompt || models.length === 0) return

    fetch('/api/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput, augmentedPrompt, topicType, framework, models }),
    }).then((res) => {
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) return

      let buffer = ''

      const read = async () => {
        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break

          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          let eventType = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7)
            } else if (line.startsWith('data: ') && eventType) {
              const data = JSON.parse(line.slice(6))

              switch (eventType) {
                case 'round_start':
                  setCurrentRound(data.round)
                  break
                case 'response':
                  setResponses((prev) => [...prev, data])
                  break
                case 'done':
                  setConversationId(data.conversationId)
                  setDone(true)
                  break
                case 'error':
                  setError(data.message)
                  break
              }
              eventType = ''
            }
          }
        }
      }

      read()
    })
  }, [searchParams])

  const round1 = responses.filter((r) => r.round === 1)
  const round2 = responses.filter((r) => r.round === 2)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Conversation</h1>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6 text-red-300">
          {error}
        </div>
      )}

      {round1.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-400 mb-4">Round 1 — Initial Responses</h2>
          <div className="space-y-4">
            {round1.map((r, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h3 className="font-medium text-blue-400 mb-2">{r.modelName}</h3>
                <div className="text-gray-300 whitespace-pre-wrap">{r.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {round2.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-400 mb-4">Round 2 — Reactions</h2>
          <div className="space-y-4">
            {round2.map((r, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h3 className="font-medium text-purple-400 mb-2">{r.modelName}</h3>
                <div className="text-gray-300 whitespace-pre-wrap">{r.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!done && !error && (
        <div className="text-center py-8 text-gray-500">
          {currentRound > 0
            ? `Round ${currentRound} in progress... (${
                currentRound === 1 ? round1.length : round2.length
              } responses received)`
            : 'Starting conversation...'}
        </div>
      )}

      {done && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              window.location.href = '/'
            }}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
          >
            New Conversation
          </button>
          <button
            onClick={() => {
              // Copy markdown to clipboard — uses the conversation detail endpoint
              if (!conversationId) return
              fetch(`/api/conversations/${conversationId}`)
                .then((r) => r.json())
                .then((data) => {
                  import('@/lib/export').then(({ exportMarkdown }) => {
                    navigator.clipboard.writeText(exportMarkdown(data))
                  })
                })
            }}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
          >
            Copy Markdown
          </button>
          <button
            onClick={() => {
              if (!conversationId) return
              fetch(`/api/conversations/${conversationId}`)
                .then((r) => r.json())
                .then((data) => {
                  import('@/lib/export').then(({ exportText }) => {
                    navigator.clipboard.writeText(exportText(data))
                  })
                })
            }}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
          >
            Copy Text
          </button>
          <button
            onClick={() => {
              if (!conversationId) return
              fetch(`/api/conversations/${conversationId}`)
                .then((r) => r.json())
                .then((data) => {
                  import('@/lib/export').then(({ exportXThread }) => {
                    const tweets = exportXThread(data)
                    navigator.clipboard.writeText(tweets.join('\n\n---\n\n'))
                  })
                })
            }}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
          >
            Copy X Thread
          </button>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify it compiles**

```bash
npm run build
```
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/conversation/page.tsx
git commit -m "feat: add conversation screen with SSE streaming and export buttons"
```

---

### Task 13: Conversation Detail Page (View Past Conversations)

**Files:**
- Create: `src/app/conversation/[id]/page.tsx`

**Step 1: Build the detail page**

Create `src/app/conversation/[id]/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { MODEL_CONFIGS } from '@/lib/models'
import type { Conversation } from '@/lib/types'

export default function ConversationDetailPage() {
  const params = useParams()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/conversations/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then(setConversation)
      .catch((e) => setError(e.message))
  }, [params.id])

  if (error) {
    return <div className="text-red-400">Error: {error}</div>
  }

  if (!conversation) {
    return <div className="text-gray-500">Loading...</div>
  }

  const round1 = conversation.responses.filter((r) => r.round === 1)
  const round2 = conversation.responses.filter((r) => r.round === 2)

  const getModelName = (key: string) => MODEL_CONFIGS[key]?.name ?? key

  return (
    <div>
      <a href="/" className="text-blue-400 hover:underline text-sm mb-4 block">
        Back to Home
      </a>

      <h1 className="text-2xl font-bold mb-2">{conversation.rawInput}</h1>
      <p className="text-gray-400 mb-6">{conversation.augmentedPrompt}</p>

      <div className="mb-2 flex gap-2">
        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
          {conversation.topicType}
        </span>
        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
          {conversation.framework}
        </span>
      </div>

      {round1.length > 0 && (
        <div className="mb-8 mt-6">
          <h2 className="text-lg font-medium text-gray-400 mb-4">Round 1</h2>
          <div className="space-y-4">
            {round1.map((r) => (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h3 className="font-medium text-blue-400 mb-2">{getModelName(r.model)}</h3>
                <div className="text-gray-300 whitespace-pre-wrap">{r.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {round2.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-400 mb-4">Round 2</h2>
          <div className="space-y-4">
            {round2.map((r) => (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h3 className="font-medium text-purple-400 mb-2">{getModelName(r.model)}</h3>
                <div className="text-gray-300 whitespace-pre-wrap">{r.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => {
            import('@/lib/export').then(({ exportMarkdown }) => {
              navigator.clipboard.writeText(exportMarkdown(conversation))
            })
          }}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
        >
          Copy Markdown
        </button>
        <button
          onClick={() => {
            import('@/lib/export').then(({ exportText }) => {
              navigator.clipboard.writeText(exportText(conversation))
            })
          }}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
        >
          Copy Text
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Verify it compiles**

```bash
npm run build
```
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/conversation/\[id\]/page.tsx
git commit -m "feat: add conversation detail page for viewing past conversations"
```

---

### Task 14: Integration Test & Smoke Check

**Step 1: Run all unit tests**

```bash
npx vitest run
```
Expected: All tests pass

**Step 2: Run the dev server and smoke test**

```bash
npm run dev
```

Manual checks:
- Visit http://localhost:3000 — Home page loads
- Model toggles work
- Type a topic — (won't call API without keys, but should not crash)

**Step 3: Run build**

```bash
npm run build
```
Expected: Build succeeds with no errors

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: integration fixes from smoke testing"
```

---

### Task 15: Documentation

**Files:**
- Modify: `README.md` (create if not exists)
- Create: `docs/architecture.md`

**Step 1: Write README**

Create `README.md`:
```markdown
# Conversation With AI

Moderate a roundtable discussion between frontier AI models. Type a topic, get it augmented with an analytical framework, then watch 4 AI models discuss it in two rounds.

## Features

- Automatic prompt augmentation with topic classification
- 4 frontier models: Claude, GPT-4, Gemini, Grok
- Two-round discussion (initial + reactions)
- Real-time SSE streaming
- Export to Markdown, plain text, or X thread format
- SQLite persistence for conversation history

## Setup

1. Clone and install:
   ```bash
   npm install
   ```

2. Create `.env.local` with your API keys:
   ```
   ANTHROPIC_API_KEY=...
   OPENAI_API_KEY=...
   GOOGLE_GENERATIVE_AI_API_KEY=...
   XAI_API_KEY=...
   ```

3. Run:
   ```bash
   npm run dev
   ```

4. Visit http://localhost:3000

## Tech Stack

Next.js 15, TypeScript, Tailwind CSS, Drizzle ORM, SQLite, Vercel AI SDK

## Tests

```bash
npm test        # watch mode
npm run test:run # single run
```

4 test suites, covering schema, models, augmenter, orchestrator, and exports.
```

**Step 2: Write architecture doc**

Create `docs/architecture.md` with the architecture diagrams from the design doc plus component descriptions.

**Step 3: Commit**

```bash
git add README.md docs/architecture.md
git commit -m "docs: add README and architecture documentation"
```

---

## Summary

```
Task  1: Initialize Next.js project         ← scaffolding
Task  2: Database schema & access layer      ← data layer (TDD)
Task  3: Model config & provider registry    ← AI config (TDD)
Task  4: Prompt augmenter logic              ← core logic (TDD)
Task  5: Conversation orchestrator logic     ← core logic (TDD)
Task  6: Augment API route                   ← API endpoint
Task  7: Conversation API route (SSE)        ← API endpoint
Task  8: Conversation data fetching API      ← API endpoints
Task  9: Shared types & export utilities     ← utilities (TDD)
Task 10: Home screen                         ← frontend
Task 11: Review prompt screen                ← frontend
Task 12: Conversation screen (streaming)     ← frontend
Task 13: Conversation detail page            ← frontend
Task 14: Integration test & smoke check      ← verification
Task 15: Documentation                       ← docs
```

```
                    ┌─────────┐
                    │ Task 1  │ Initialize project
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌────────┐ ┌────────┐ ┌────────┐
         │ Task 2 │ │ Task 3 │ │ Task 9 │
         │ DB     │ │ Models │ │ Export  │
         └───┬────┘ └───┬────┘ └───┬────┘
             │          │          │
         ┌───▼──────────▼───┐     │
         │ Task 4: Augmenter│     │
         │ Task 5: Orchestr.│     │
         └───┬──────────────┘     │
             │                    │
    ┌────────┼────────┐           │
    ▼        ▼        ▼           │
┌───────┐┌───────┐┌───────┐      │
│Task 6 ││Task 7 ││Task 8 │      │
│Augment││Conv   ││List/  │      │
│API    ││API SSE││Detail │      │
└───┬───┘└───┬───┘└───┬───┘      │
    │        │        │           │
    └────────┼────────┘           │
             │                    │
    ┌────────┼────────┐           │
    ▼        ▼        ▼           │
┌───────┐┌───────┐┌───────┐      │
│Task10 ││Task11 ││Task12 │◄─────┘
│Home   ││Review ││Conv   │
│Screen ││Screen ││Stream │
└───┬───┘└───┬───┘└───┬───┘
    │        │        │
    │        │   ┌────▼────┐
    │        │   │ Task 13 │
    │        │   │ Detail  │
    │        │   └────┬────┘
    └────────┼────────┘
             ▼
        ┌────────┐
        │Task 14 │ Integration test
        └────┬───┘
             ▼
        ┌────────┐
        │Task 15 │ Documentation
        └────────┘
```
