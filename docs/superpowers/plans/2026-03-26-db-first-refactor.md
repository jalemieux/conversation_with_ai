# DB-First Navigation & Codebase Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate URL-search-params-as-state-bus by persisting conversation state to the database before navigation, and harden the codebase with input validation, consistent auth, and proper error handling.

**Architecture:** The augment API creates a draft conversation in the DB and returns its ID. The review page becomes `/review/[id]` reading from DB. The conversation page reads config from DB on mount instead of search params. All API routes get Zod validation. Auth enforcement is made consistent across routes.

**Tech Stack:** Next.js 16, Drizzle ORM (SQLite), Zod, React 19, Vitest

---

## File Map

### New Files
- `src/lib/validation.ts` — Zod schemas for all API request bodies
- `src/lib/validation.test.ts` — Tests for validation schemas
- `src/app/review/[id]/page.tsx` — New review page reading from DB
- `src/components/ResponseCard.tsx` — Extracted response card component
- `src/components/LoadingCard.tsx` — Extracted loading card component
- `src/components/ErrorCard.tsx` — Extracted error card component
- `src/components/RoundSection.tsx` — Shared round rendering logic
- `src/hooks/useConversationRunner.ts` — Extracted conversation orchestration hook
- `src/hooks/useConversationRunner.test.ts` — Tests for the hook

### Modified Files
- `src/db/schema.ts` — Add `status`, `essayMode`, `responseLength`, `augmentations` columns
- `src/db/index.ts` — Add migration for new columns
- `src/app/api/augment/route.ts` — Create draft conversation, return ID
- `src/app/api/conversation/route.ts` — Add PATCH for updating draft config
- `src/app/api/conversation/respond/route.ts` — Add Zod validation, read config from DB
- `src/app/api/conversations/[id]/route.ts` — Add auth guard for public reads
- `src/app/page.tsx` — Navigate to `/review/{id}` instead of passing params
- `src/app/conversation/page.tsx` — Read from DB, extract components
- `src/app/review/page.tsx` — Redirect to new route or remove
- `src/lib/augmenter.ts` — Add safe JSON parsing with fallback
- `src/lib/orchestrator.ts` — Fix essayMode default

### Deleted Files
- `src/app/review/page.tsx` — Replaced by `src/app/review/[id]/page.tsx`
- `src/app/review/__tests__/page.test.tsx` — Will be rewritten for new route

---

## Task 1: Add Zod and Validation Schemas

**Files:**
- Create: `src/lib/validation.ts`
- Create: `src/lib/validation.test.ts`

- [ ] **Step 1: Install zod (already a transitive dep, verify it's available)**

Run: `cd /Users/jac/Dev/src/conversation_with_ai-refactor && grep '"zod"' node_modules/zod/package.json`
Expected: version string (zod is already installed as a dep of ai-sdk)

If not found:
```bash
npm install zod
```

- [ ] **Step 2: Write validation schema tests**

```typescript
// src/lib/validation.test.ts
import { describe, it, expect } from 'vitest'
import {
  AugmentRequestSchema,
  CreateConversationSchema,
  UpdateConversationSchema,
  RespondRequestSchema,
} from './validation'

describe('AugmentRequestSchema', () => {
  it('accepts valid input', () => {
    const result = AugmentRequestSchema.safeParse({ rawInput: 'Will AI replace jobs?' })
    expect(result.success).toBe(true)
  })

  it('rejects empty string', () => {
    const result = AugmentRequestSchema.safeParse({ rawInput: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects missing rawInput', () => {
    const result = AugmentRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('UpdateConversationSchema', () => {
  it('accepts valid update', () => {
    const result = UpdateConversationSchema.safeParse({
      selectedType: 'prediction',
      augmentedPrompt: 'some prompt',
      models: ['claude', 'gpt'],
      essayMode: true,
      responseLength: 'standard',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid responseLength', () => {
    const result = UpdateConversationSchema.safeParse({
      selectedType: 'prediction',
      augmentedPrompt: 'prompt',
      models: ['claude'],
      essayMode: false,
      responseLength: 'enormous',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty models array', () => {
    const result = UpdateConversationSchema.safeParse({
      selectedType: 'prediction',
      augmentedPrompt: 'prompt',
      models: [],
      essayMode: false,
      responseLength: 'standard',
    })
    expect(result.success).toBe(false)
  })
})

describe('RespondRequestSchema', () => {
  it('accepts valid request', () => {
    const result = RespondRequestSchema.safeParse({
      conversationId: 'abc-123',
      model: 'claude',
      round: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects round 3', () => {
    const result = RespondRequestSchema.safeParse({
      conversationId: 'abc-123',
      model: 'claude',
      round: 3,
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional essayMode and responseLength', () => {
    const result = RespondRequestSchema.safeParse({
      conversationId: 'abc-123',
      model: 'claude',
      round: 1,
      essayMode: true,
      responseLength: 'detailed',
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/jac/Dev/src/conversation_with_ai-refactor && npx vitest run src/lib/validation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement validation schemas**

```typescript
// src/lib/validation.ts
import { z } from 'zod'
import { TOPIC_TYPES } from './augmenter'

export const AugmentRequestSchema = z.object({
  rawInput: z.string().trim().min(1, 'rawInput is required'),
})

export const UpdateConversationSchema = z.object({
  selectedType: z.enum(TOPIC_TYPES),
  augmentedPrompt: z.string().min(1),
  models: z.array(z.string()).min(1, 'At least one model is required'),
  essayMode: z.boolean(),
  responseLength: z.enum(['brief', 'standard', 'detailed']),
})

export const RespondRequestSchema = z.object({
  conversationId: z.string().min(1),
  model: z.string().min(1),
  round: z.union([z.literal(1), z.literal(2)]),
  essayMode: z.boolean().optional(),
  responseLength: z.enum(['brief', 'standard', 'detailed']).optional(),
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/jac/Dev/src/conversation_with_ai-refactor && npx vitest run src/lib/validation.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation.ts src/lib/validation.test.ts
git commit -m "feat: add Zod validation schemas for API routes"
```

---

## Task 2: Schema Migration — Add Draft Conversation Support

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/index.ts`

- [ ] **Step 1: Add new columns to schema definition**

In `src/db/schema.ts`, add to the `conversations` table:

```typescript
// Add these columns to the conversations sqliteTable definition:
status: text('status').notNull().default('draft'), // 'draft' | 'running' | 'completed'
essayMode: integer('essay_mode', { mode: 'boolean' }).notNull().default(false),
responseLength: text('response_length').notNull().default('standard'),
augmentations: text('augmentations'), // JSON blob of all 4 augmentation variants
```

Also make `augmentedPrompt`, `topicType`, `framework`, `models` default to empty values since drafts won't have them yet:

Change `augmentedPrompt` default to `''`, `topicType` default to `'open_question'`, `framework` default to `''`, `models` default to `'[]'`.

- [ ] **Step 2: Add migration in db/index.ts**

Add migration block after existing migrations:

```typescript
// Migration: add draft conversation support columns
const hasDraftCols = db.run(sql`SELECT sql FROM sqlite_master WHERE name='conversations' AND sql LIKE '%status%'`)
if (!hasDraftCols || !String(hasDraftCols).includes('status')) {
  try {
    db.run(sql`ALTER TABLE conversations ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'`)
    db.run(sql`ALTER TABLE conversations ADD COLUMN essay_mode INTEGER NOT NULL DEFAULT 0`)
    db.run(sql`ALTER TABLE conversations ADD COLUMN response_length TEXT NOT NULL DEFAULT 'standard'`)
    db.run(sql`ALTER TABLE conversations ADD COLUMN augmentations TEXT`)
    // Mark all existing conversations as completed (they were created pre-draft)
    db.run(sql`UPDATE conversations SET status = 'completed' WHERE status = 'draft'`)
  } catch (e) {
    // Column may already exist
  }
}
```

- [ ] **Step 3: Verify the app still starts**

Run: `cd /Users/jac/Dev/src/conversation_with_ai-refactor && npx next build 2>&1 | tail -5`
Expected: Build succeeds (or at least no schema errors)

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts src/db/index.ts
git commit -m "feat: add draft conversation columns to schema"
```

---

## Task 3: Rewire Augment API to Create Draft Conversations

**Files:**
- Modify: `src/app/api/augment/route.ts`
- Modify: `src/lib/augmenter.ts` (harden JSON parsing)

- [ ] **Step 1: Harden augmenter JSON parsing**

In `src/lib/augmenter.ts`, wrap `parseMultiAugmenterResponse` with try/catch and validation:

```typescript
export function parseMultiAugmenterResponse(text: string): MultiAugmenterResult {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Failed to parse augmenter response as JSON')
  }

  if (!parsed.augmentations || typeof parsed.augmentations !== 'object') {
    throw new Error('Augmenter response missing augmentations object')
  }

  const augmentations: AugmentationsMap = {} as AugmentationsMap
  for (const type of TOPIC_TYPES) {
    const entry = (parsed.augmentations as Record<string, { framework?: string; augmented_prompt?: string }>)[type]
    if (!entry || !entry.framework || !entry.augmented_prompt) {
      throw new Error(`Augmenter response missing or incomplete entry for type: ${type}`)
    }
    augmentations[type] = {
      framework: entry.framework,
      augmentedPrompt: entry.augmented_prompt,
    }
  }

  const recommended = parsed.recommended as string
  if (!TOPIC_TYPES.includes(recommended as TopicType)) {
    throw new Error(`Invalid recommended type: ${recommended}`)
  }

  return {
    recommended: recommended as TopicType,
    augmentations,
  }
}
```

- [ ] **Step 2: Run existing augmenter tests**

Run: `cd /Users/jac/Dev/src/conversation_with_ai-refactor && npx vitest run src/lib/augmenter.test.ts`
Expected: PASS (existing behavior preserved)

- [ ] **Step 3: Rewire augment route to create draft conversation**

Replace `src/app/api/augment/route.ts`:

```typescript
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { buildAugmenterPrompt, parseMultiAugmenterResponse } from '@/lib/augmenter'
import { AugmentRequestSchema } from '@/lib/validation'
import { db } from '@/db'
import { conversations } from '@/db/schema'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth-config'

const anthropic = createAnthropic({
  apiKey: process.env.CWAI_ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = AugmentRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { rawInput } = parsed.data
  const prompt = buildAugmenterPrompt(rawInput)

  let text: string
  try {
    const result = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt,
      maxOutputTokens: 2000,
    })
    text = result.text
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[augment] LLM call failed:', msg)
    return NextResponse.json({ error: 'Failed to augment prompt' }, { status: 502 })
  }

  let result
  try {
    result = parseMultiAugmenterResponse(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[augment] Parse failed:', msg, 'Raw:', text.slice(0, 500))
    return NextResponse.json({ error: 'Failed to parse augmented prompt' }, { status: 502 })
  }

  // Create draft conversation in DB
  const session = await auth()
  const conversationId = randomUUID()

  await db.insert(conversations).values({
    id: conversationId,
    rawInput,
    augmentedPrompt: result.augmentations[result.recommended].augmentedPrompt,
    topicType: result.recommended,
    framework: result.augmentations[result.recommended].framework,
    models: '[]',
    status: 'draft',
    augmentations: JSON.stringify(result.augmentations),
    userId: session?.user?.id ?? null,
  })

  return NextResponse.json({
    conversationId,
    rawInput,
    recommended: result.recommended,
    augmentations: result.augmentations,
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/augment/route.ts src/lib/augmenter.ts
git commit -m "feat: augment API creates draft conversation in DB"
```

---

## Task 4: Add PATCH Endpoint for Updating Draft Conversations

**Files:**
- Modify: `src/app/api/conversation/route.ts`

- [ ] **Step 1: Add PATCH handler alongside existing POST**

Replace `src/app/api/conversation/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations } from '@/db/schema'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth-config'
import { UpdateConversationSchema } from '@/lib/validation'
import { eq, and } from 'drizzle-orm'

// Legacy POST — still used by old clients; creates a conversation directly
export async function POST(request: Request) {
  const { rawInput, augmentedPrompt, topicType, framework, models } = await request.json()

  if (!augmentedPrompt || !models || !Array.isArray(models) || models.length === 0) {
    return NextResponse.json({ error: 'augmentedPrompt and models are required' }, { status: 400 })
  }

  const session = await auth()
  const conversationId = randomUUID()

  await db.insert(conversations).values({
    id: conversationId,
    rawInput: rawInput ?? '',
    augmentedPrompt,
    topicType: topicType ?? 'open_question',
    framework: framework ?? 'multiple_angles',
    models: JSON.stringify(models),
    status: 'running',
    userId: session?.user?.id ?? null,
  })

  return NextResponse.json({ conversationId })
}

// PATCH — update a draft conversation with final config and mark as running
export async function PATCH(request: Request) {
  const body = await request.json()
  const { conversationId, ...rest } = body

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
  }

  const parsed = UpdateConversationSchema.safeParse(rest)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [conv] = await db.select().from(conversations).where(
    and(eq(conversations.id, conversationId), eq(conversations.userId, session.user.id))
  )
  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }
  if (conv.status !== 'draft') {
    return NextResponse.json({ error: 'Conversation is not in draft state' }, { status: 409 })
  }

  const { selectedType, augmentedPrompt, models, essayMode, responseLength } = parsed.data

  // Read framework from stored augmentations
  let framework = ''
  try {
    const augs = JSON.parse(conv.augmentations ?? '{}')
    framework = augs[selectedType]?.framework ?? ''
  } catch { /* use empty */ }

  await db.update(conversations)
    .set({
      topicType: selectedType,
      augmentedPrompt,
      framework,
      models: JSON.stringify([...new Set(models.map((m: string) => {
        const idx = m.indexOf(':')
        return idx === -1 ? m : m.slice(0, idx)
      }))]),
      essayMode,
      responseLength,
      status: 'running',
    })
    .where(eq(conversations.id, conversationId))

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/conversation/route.ts
git commit -m "feat: add PATCH endpoint for updating draft conversations"
```

---

## Task 5: Update Respond Route — Read Config from DB, Add Validation

**Files:**
- Modify: `src/app/api/conversation/respond/route.ts`
- Modify: `src/lib/orchestrator.ts` (fix essayMode default)

- [ ] **Step 1: Fix essayMode default in orchestrator**

In `src/lib/orchestrator.ts`, the `buildSystemPrompt` signature is fine, but document the boolean clearly. No code change needed here — the fix is in the respond route where it's called.

- [ ] **Step 2: Update respond route with validation and DB config**

Replace the parameter extraction and essayMode logic in `src/app/api/conversation/respond/route.ts`. Change:

```typescript
// Old line ~15:
const { conversationId, model: modelKey, round, essayMode, responseLength } = await request.json()
```

To:

```typescript
import { RespondRequestSchema } from '@/lib/validation'

// ... inside POST handler:
const body = await request.json()
const parsed = RespondRequestSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
}
const { conversationId, model: modelKey, round } = parsed.data
```

And change the essayMode/responseLength resolution to read from DB if not provided in the request:

```typescript
// After fetching conv from DB (~line 29):
const essayMode = parsed.data.essayMode ?? conv.essayMode ?? false
const responseLength = parsed.data.responseLength ?? conv.responseLength ?? undefined
```

And fix the buildSystemPrompt call:

```typescript
// Old:
system: buildSystemPrompt(round as 1 | 2, essayMode !== false, config.systemPrompt, responseLength),
// New:
system: buildSystemPrompt(round as 1 | 2, essayMode === true, config.systemPrompt, responseLength),
```

- [ ] **Step 3: Remove the redundant round validation block**

The Zod schema already validates `round` is 1 or 2, so remove lines 61-63:

```typescript
// DELETE these lines:
if (round !== 1 && round !== 2) {
  return NextResponse.json({ error: 'round must be 1 or 2' }, { status: 400 })
}
```

- [ ] **Step 4: Run existing tests**

Run: `cd /Users/jac/Dev/src/conversation_with_ai-refactor && npx vitest run src/lib/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/conversation/respond/route.ts src/lib/orchestrator.ts
git commit -m "fix: add Zod validation to respond route, fix essayMode default"
```

---

## Task 6: Rewire Home Page to Navigate by Conversation ID

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update handleSubmit to navigate by ID**

In `src/app/page.tsx`, replace the `handleSubmit` function:

```typescript
const handleSubmit = async () => {
  if (!rawInput.trim()) return
  setLoading(true)

  try {
    const res = await fetch('/api/augment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: rawInput.trim() }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }))
      setError(data.error ?? 'Failed to prepare conversation')
      return
    }

    const data = await res.json()

    trackEvent('conversation_started', {
      topic_type: data.recommended ?? '',
      framework: data.augmentations?.[data.recommended]?.framework ?? '',
    })

    window.location.href = `/review/${data.conversationId}`
  } catch {
    setError('Network error. Please try again.')
  } finally {
    setLoading(false)
  }
}
```

Also add an `error` state variable and render it:

```typescript
const [error, setError] = useState<string | null>(null)
```

And add error display above the submit button:

```tsx
{error && (
  <p className="text-danger text-sm mb-3">{error}</p>
)}
```

- [ ] **Step 2: Fix silent error swallowing on useEffects**

Replace the two `.catch(() => {})` calls:

```typescript
// User access check — redirect on failure means API is down, show error
useEffect(() => {
  fetch('/api/user')
    .then(r => r.json())
    .then(data => {
      if (data.subscriptionStatus !== 'active' && (!data.providers || data.providers.length === 0)) {
        window.location.href = '/setup'
      }
    })
    .catch(() => {
      console.warn('[home] Failed to check user access')
    })
}, [])

// Recent conversations — log on failure
useEffect(() => {
  fetch('/api/conversations')
    .then((r) => r.json())
    .then(setRecent)
    .catch(() => {
      console.warn('[home] Failed to load recent conversations')
    })
}, [])
```

And in `handleDelete`:

```typescript
} catch {
  console.warn('[home] Failed to delete conversation, refreshing list')
  fetch('/api/conversations')
    .then((r) => r.json())
    .then(setRecent)
    .catch(() => {
      console.warn('[home] Failed to reload conversations after delete failure')
    })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: home page navigates by conversation ID, fix error handling"
```

---

## Task 7: Create New Review Page at /review/[id]

**Files:**
- Create: `src/app/review/[id]/page.tsx`
- Delete: `src/app/review/page.tsx` (old search-params version)
- Delete: `src/app/review/__tests__/page.test.tsx` (old tests)

- [ ] **Step 1: Create the new review page**

Create `src/app/review/[id]/page.tsx` that loads conversation from DB:

```tsx
'use client'

import { Suspense, useState, useEffect, use } from 'react'
import { TOPIC_TYPES, type TopicType, type AugmentationsMap } from '@/lib/augmenter'
import type { ResponseLength } from '@/lib/orchestrator'
import { MODEL_CONFIGS } from '@/lib/models'
import { trackEvent } from '@/lib/analytics'

const MODEL_COLORS: Record<string, { dot: string; activeBg: string; activeBorder: string; activeText: string }> = {
  claude:  { dot: 'bg-claude',  activeBg: 'bg-claude-faint',  activeBorder: 'border-claude/30',  activeText: 'text-claude' },
  gpt:     { dot: 'bg-gpt',     activeBg: 'bg-gpt-faint',     activeBorder: 'border-gpt/30',     activeText: 'text-gpt' },
  gemini:  { dot: 'bg-gemini',  activeBg: 'bg-gemini-faint',  activeBorder: 'border-gemini/30',  activeText: 'text-gemini' },
  grok:    { dot: 'bg-grok',    activeBg: 'bg-grok-faint',    activeBorder: 'border-grok/30',    activeText: 'text-grok' },
}

const RESPONSE_LENGTHS: { value: ResponseLength; label: string; description: string }[] = [
  { value: 'brief', label: 'Brief', description: 'Quick takes' },
  { value: 'standard', label: 'Standard', description: 'Moderate depth' },
  { value: 'detailed', label: 'Detailed', description: 'Deep dives' },
]

const TOPIC_DESCRIPTIONS: Record<TopicType, string> = {
  prediction: 'Explores possible futures through scenario analysis and cascading effects',
  opinion: 'Stress-tests a position by building the strongest case for and against it',
  trend_analysis: 'Places the topic on a timeline with recent context and trajectory',
  open_question: 'Examines the question from multiple angles and surfaces trade-offs',
}

function ReviewContent({ conversationId }: { conversationId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rawInput, setRawInput] = useState('')
  const [augmentations, setAugmentations] = useState<AugmentationsMap>({} as AugmentationsMap)
  const [selectedType, setSelectedType] = useState<TopicType>('open_question')
  const [augmentedPrompt, setAugmentedPrompt] = useState('')
  const [isEdited, setIsEdited] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [essayMode, setEssayMode] = useState(false)
  const [responseLength, setResponseLength] = useState<ResponseLength>('standard')
  const [submitting, setSubmitting] = useState(false)

  const [availableModels, setAvailableModels] = useState<string[]>(Object.keys(MODEL_CONFIGS))
  const defaultCounts: Record<string, number> = {}
  for (const key of Object.keys(MODEL_CONFIGS)) defaultCounts[key] = 1
  const [modelCounts, setModelCounts] = useState<Record<string, number>>(defaultCounts)

  // Load conversation from DB
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}`)
      .then(r => {
        if (!r.ok) throw new Error('Conversation not found')
        return r.json()
      })
      .then(data => {
        setRawInput(data.rawInput)
        const augs: AugmentationsMap = data.augmentations
          ? (typeof data.augmentations === 'string' ? JSON.parse(data.augmentations) : data.augmentations)
          : ({} as AugmentationsMap)
        setAugmentations(augs)
        setSelectedType(data.topicType as TopicType)
        setAugmentedPrompt(augs[data.topicType as TopicType]?.augmentedPrompt ?? data.augmentedPrompt)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [conversationId])

  // Load available models based on user access
  useEffect(() => {
    fetch('/api/user')
      .then(r => r.json())
      .then(data => {
        if (data.subscriptionStatus === 'active') {
          setAvailableModels(Object.keys(MODEL_CONFIGS))
          const counts: Record<string, number> = {}
          for (const key of Object.keys(MODEL_CONFIGS)) counts[key] = 1
          setModelCounts(counts)
        } else if (data.providers?.length > 0) {
          const providerToModels: Record<string, string[]> = {}
          for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
            if (!providerToModels[config.provider]) providerToModels[config.provider] = []
            providerToModels[config.provider].push(key)
          }
          const available = [...new Set<string>(data.providers.flatMap((p: string) => providerToModels[p] || []))]
          setAvailableModels(available)
          const counts: Record<string, number> = {}
          for (const key of available) counts[key] = 1
          setModelCounts(counts)
        }
      })
      .catch(() => console.warn('[review] Failed to check user access'))
  }, [])

  const MAX_PER_MODEL = 3
  const adjustCount = (key: string, delta: number) => {
    setModelCounts((prev) => {
      const current = prev[key] ?? 0
      const next = Math.max(0, Math.min(MAX_PER_MODEL, current + delta))
      return { ...prev, [key]: next }
    })
  }

  const totalSelected = Object.values(modelCounts).reduce((sum, n) => sum + n, 0)
  const currentFramework = augmentations[selectedType]?.framework ?? ''

  const handleTagClick = (type: TopicType) => {
    if (type === selectedType) return
    if (isEdited) {
      const confirmed = window.confirm('You have unsaved edits. Switching will discard them. Continue?')
      if (!confirmed) return
    }
    setSelectedType(type)
    setAugmentedPrompt(augmentations[type]?.augmentedPrompt ?? '')
    setIsEdited(false)
  }

  const handlePromptChange = (value: string) => {
    setAugmentedPrompt(value)
    setIsEdited(value !== augmentations[selectedType]?.augmentedPrompt)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch('/api/augment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      })
      const data = await res.json()
      if (data.augmentations) {
        setAugmentations(data.augmentations)
        setAugmentedPrompt(data.augmentations[selectedType]?.augmentedPrompt ?? '')
        setIsEdited(false)
      }
    } finally {
      setRegenerating(false)
    }
  }

  const handleRun = async () => {
    setSubmitting(true)
    // Expand counts into instance keys
    const instanceKeys: string[] = []
    for (const [key, count] of Object.entries(modelCounts)) {
      for (let i = 0; i < count; i++) {
        instanceKeys.push(`${key}:${i}`)
      }
    }

    try {
      const res = await fetch('/api/conversation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          selectedType,
          augmentedPrompt,
          models: instanceKeys,
          essayMode,
          responseLength,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        setError(data.error ?? 'Failed to start conversation')
        setSubmitting(false)
        return
      }

      trackEvent('conversation_started', {
        topic_type: selectedType,
        framework: currentFramework,
      })

      window.location.href = `/conversation/${conversationId}`
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) return <div className="text-ink-faint">Loading...</div>
  if (error) return <div className="text-danger">{error}</div>

  return (
    <div>
      <a href="/" className="text-ink-faint hover:text-amber text-sm mb-8 inline-flex items-center gap-1.5 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back
      </a>

      <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight mb-8 animate-fade-up">
        Review <span className="text-amber italic">Prompt</span>
      </h1>

      <div className="animate-fade-up stagger-1 mb-6">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-2">Your Input</p>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          className="w-full bg-card border border-border rounded-xl px-5 py-4 text-ink-light leading-relaxed focus:outline-none focus:border-amber transition-colors resize-none text-base"
          rows={3}
        />
      </div>

      <div className="animate-fade-up stagger-2 mb-4">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-3">Framing</p>
        <div className="flex gap-3 flex-wrap mb-3">
          {TOPIC_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleTagClick(type)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                type === selectedType
                  ? 'bg-amber-faint text-amber ring-2 ring-amber/40 shadow-sm'
                  : 'bg-card text-ink-muted ring-1 ring-border hover:ring-amber/30 hover:text-ink hover:shadow-sm'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-muted mt-2">
          <span className="font-medium text-ink-faint">{currentFramework}</span> — {TOPIC_DESCRIPTIONS[selectedType]}
        </p>
      </div>

      <div className="animate-fade-up stagger-3 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Panel</p>
          <span className="text-xs text-ink-faint">{totalSelected} response{totalSelected !== 1 ? 's' : ''} total</span>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          {Object.entries(MODEL_CONFIGS).map(([key, config]) => {
            const available = availableModels.includes(key)
            const count = modelCounts[key] ?? 0
            const active = available && count > 0
            const colors = MODEL_COLORS[key] ?? { dot: 'bg-amber', activeBg: 'bg-amber-faint', activeBorder: 'border-amber/30', activeText: 'text-amber' }
            return (
              <div
                key={key}
                className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
                  !available
                    ? 'bg-cream-dark/20 border-border/50 text-ink-faint/40 opacity-50'
                    : active
                      ? `${colors.activeBg} ${colors.activeBorder} ${colors.activeText}`
                      : 'bg-cream-dark/40 border-border text-ink-faint'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${colors.dot} ${active ? 'opacity-100' : 'opacity-20'}`} />
                <span className="flex flex-col items-start leading-tight">
                  <span>{config.name}</span>
                  <span className={`text-[10px] font-normal ${active ? 'opacity-60' : 'opacity-40'}`}>{config.modelId}</span>
                </span>
                {available && (
                  <span className="inline-flex items-center gap-1 ml-1">
                    <button
                      aria-label={`Decrease ${config.name} count`}
                      onClick={() => adjustCount(key, -1)}
                      disabled={count <= 0}
                      className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-card border border-border hover:border-border-strong disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-xs tabular-nums" data-testid={`count-${key}`}>{count}</span>
                    <button
                      aria-label={`Increase ${config.name} count`}
                      onClick={() => adjustCount(key, 1)}
                      disabled={count >= MAX_PER_MODEL}
                      className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-card border border-border hover:border-border-strong disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      +
                    </button>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="animate-fade-up stagger-4 mb-8">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-2">Augmented Prompt</p>
        <textarea
          value={augmentedPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          className="w-full h-44 bg-card border border-border rounded-xl p-5 text-ink focus:outline-none focus:border-amber transition-colors resize-none text-base leading-relaxed"
        />
      </div>

      <div className="animate-fade-up stagger-5 mb-8 flex flex-wrap items-start gap-x-10 gap-y-4">
        <div className="flex items-center gap-3">
          <label htmlFor="essay-mode" className="text-xs font-medium tracking-widest uppercase text-ink-faint cursor-pointer">
            Essay Mode
          </label>
          <button
            id="essay-mode"
            role="checkbox"
            aria-checked={essayMode}
            aria-label="Essay mode"
            onClick={() => setEssayMode(!essayMode)}
            className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
              essayMode ? 'bg-amber' : 'bg-border-strong'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                essayMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Length</p>
          <div className="flex gap-2">
            {RESPONSE_LENGTHS.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => setResponseLength(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  value === responseLength
                    ? 'bg-amber-faint text-amber ring-1 ring-amber/40'
                    : 'bg-card text-ink-muted ring-1 ring-border hover:ring-amber/30 hover:text-ink'
                }`}
                title={description}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="animate-fade-up stagger-6 flex gap-3">
        <button
          onClick={() => window.history.back()}
          className="px-5 py-3 bg-card border border-border hover:border-border-strong rounded-xl font-medium transition-all duration-200 text-ink-muted hover:text-ink"
        >
          Back
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-5 py-3 bg-ink text-cream hover:bg-ink-light disabled:bg-cream-dark disabled:text-ink-faint rounded-xl font-medium transition-all duration-200"
        >
          {regenerating ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
              Regenerating...
            </span>
          ) : (
            'Regenerate'
          )}
        </button>
        <button
          onClick={handleRun}
          disabled={totalSelected === 0 || submitting}
          className="flex-1 py-3 bg-amber text-white hover:bg-amber-light disabled:bg-cream-dark disabled:text-ink-faint rounded-xl font-medium transition-all duration-200 active:scale-[0.995]"
        >
          {submitting ? 'Starting...' : 'Run Conversation'}
        </button>
      </div>
    </div>
  )
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense fallback={<div className="text-ink-faint">Loading...</div>}>
      <ReviewContent conversationId={id} />
    </Suspense>
  )
}
```

- [ ] **Step 2: Remove old review page and its tests**

```bash
rm src/app/review/page.tsx
rm -rf src/app/review/__tests__
```

- [ ] **Step 3: Commit**

```bash
git add src/app/review/[id]/page.tsx
git rm src/app/review/page.tsx src/app/review/__tests__/page.test.tsx
git commit -m "feat: review page reads from DB via /review/[id] route"
```

---

## Task 8: Rewire Conversation Page to Load from DB

**Files:**
- Modify: `src/app/conversation/page.tsx`

- [ ] **Step 1: Rewrite conversation page to load config from DB**

The conversation page currently reads everything from search params. Change it to:
1. Accept a `conversationId` search param (for backwards compat) OR be navigated from review
2. Fetch conversation from DB
3. Fire model calls using the stored config

Replace the initialization logic in `ConversationContent`. Change the `useEffect` that reads search params to instead fetch from the API:

In `src/app/conversation/page.tsx`, replace the state initialization and main useEffect (lines 57-159):

```tsx
function ConversationContent() {
  const searchParams = useSearchParams()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [round1States, setRound1States] = useState<Record<string, ModelState>>({})
  const [round2States, setRound2States] = useState<Record<string, ModelState>>({})
  const [round2Started, setRound2Started] = useState(false)
  const [topic, setTopic] = useState('')
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)
  const modelsRef = useRef<string[]>([])
  const tts = useTTS()
  const [essayMode, setEssayMode] = useState(false)
  const [responseLength, setResponseLength] = useState<string | undefined>(undefined)

  const callModel = useCallback(async (convId: string, instanceKey: string, round: number, essay: boolean, respLength?: string, attempt = 0): Promise<ModelResponse> => {
    const modelKey = baseModel(instanceKey)
    const MAX_RETRIES = 1
    try {
      const res = await fetch('/api/conversation/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, model: modelKey, round, essayMode: essay, responseLength: respLength }),
      })
      if (!res.ok) {
        let message = `Request failed (${res.status})`
        try {
          const err = await res.json()
          if (err.error) message = err.error
        } catch {
          const text = await res.text().catch(() => '')
          if (text) console.error(`[callModel] Non-JSON ${res.status} for ${modelKey}:`, text.slice(0, 200))
        }
        throw new Error(message)
      }
      return await res.json()
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.warn(`[callModel] Retrying ${modelKey} round ${round} (attempt ${attempt + 1}):`, err instanceof Error ? err.message : err)
        await new Promise(r => setTimeout(r, 3000))
        return callModel(convId, instanceKey, round, essay, respLength, attempt + 1)
      }
      throw err
    }
  }, [])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    // Get conversation ID from search params (legacy) or from the URL path
    const paramId = searchParams.get('id')
    if (!paramId) {
      setError('No conversation ID provided')
      return
    }

    // Fetch conversation from DB
    fetch(`/api/conversations/${paramId}`)
      .then(r => {
        if (!r.ok) throw new Error('Conversation not found')
        return r.json()
      })
      .then(conv => {
        setConversationId(conv.id)
        setTopic(conv.augmentedPrompt)
        setEssayMode(conv.essayMode ?? false)
        setResponseLength(conv.responseLength ?? undefined)

        // If conversation already has responses, display them (reload-safe)
        if (conv.responses && conv.responses.length > 0) {
          const r1: Record<string, ModelState> = {}
          const r2: Record<string, ModelState> = {}
          const instanceKeysSet = new Set<string>()

          for (const resp of conv.responses) {
            const instanceKey = `${resp.model}:0`
            instanceKeysSet.add(instanceKey)
            const state: ModelState = {
              loading: false,
              error: null,
              response: {
                round: resp.round,
                model: resp.model,
                modelName: resp.model,
                provider: '',
                modelId: '',
                content: resp.content,
                sources: resp.sources,
                usage: resp.usage,
              },
            }
            if (resp.round === 1) r1[instanceKey] = state
            else r2[instanceKey] = state
          }

          modelsRef.current = [...instanceKeysSet]
          setRound1States(r1)
          if (Object.keys(r2).length > 0) {
            setRound2States(r2)
            setRound2Started(true)
          }
          return
        }

        // No responses yet — need to fire model calls
        // Build instance keys from the conversation's model list
        const models = conv.models ?? []
        const instanceKeys: string[] = []
        const modelCounts: Record<string, number> = {}
        for (const m of models) {
          const count = modelCounts[m] ?? 0
          instanceKeys.push(`${m}:${count}`)
          modelCounts[m] = count + 1
        }

        modelsRef.current = instanceKeys

        const initialStates: Record<string, ModelState> = {}
        instanceKeys.forEach((m) => { initialStates[m] = { loading: true, error: null, response: null } })
        setRound1States(initialStates)

        // Fire all Round 1 calls in parallel
        instanceKeys.forEach((instanceKey) => {
          callModel(conv.id, instanceKey, 1, conv.essayMode ?? false, conv.responseLength ?? undefined)
            .then((response) => {
              setRound1States((prev) => ({ ...prev, [instanceKey]: { loading: false, error: null, response } }))
              trackEvent('model_response', {
                model: baseModel(instanceKey),
                round: 1,
                input_tokens: response.usage?.inputTokens ?? 0,
                output_tokens: response.usage?.outputTokens ?? 0,
                cost: response.usage?.cost ?? 0,
              })
            })
            .catch((err) => {
              setRound1States((prev) => ({ ...prev, [instanceKey]: { loading: false, error: err.message, response: null } }))
            })
        })
      })
      .catch(err => setError(err.message))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

**Key change:** The conversation page now navigates to `/conversation?id={conversationId}` OR `/conversation/{conversationId}` (the dynamic route already exists). We'll use the existing dynamic route at `/conversation/[id]/page.tsx` as the primary entry point.

**Actually, simpler approach:** Since `/conversation/[id]/page.tsx` already exists for viewing saved conversations, we should enhance THAT page to also handle the "live" flow. But that's a bigger change. Instead, let's make the conversation page accept an `id` search param and load from DB.

Wait — the better approach is: the review page now navigates to `/conversation/{id}` which is the existing `[id]` dynamic route page. We just need that page to also handle firing model calls when responses don't exist yet.

- [ ] **Step 2: Update `/conversation/[id]/page.tsx` to handle both live and saved conversations**

This is the key unification. Read `src/app/conversation/[id]/page.tsx` and merge the live conversation logic into it. The page should:
1. Fetch conversation from DB
2. If responses exist → display them (current behavior)
3. If no responses and status is 'running' → fire model calls (new behavior)

This replaces the need for `/conversation/page.tsx` entirely.

- [ ] **Step 3: Remove or redirect `/conversation/page.tsx`**

Replace `src/app/conversation/page.tsx` with a redirect:

```tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function Redirect() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  if (id) {
    window.location.href = `/conversation/${id}`
  }
  return <div className="text-ink-faint">Redirecting...</div>
}

export default function ConversationPage() {
  return (
    <Suspense fallback={<div className="text-ink-faint">Loading...</div>}>
      <Redirect />
    </Suspense>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/conversation/page.tsx src/app/conversation/[id]/page.tsx
git commit -m "feat: conversation page loads from DB, handles live and saved views"
```

---

## Task 9: Fix Auth Consistency

**Files:**
- Modify: `src/app/api/conversations/[id]/route.ts` (GET should check ownership for non-public data)
- Modify: `src/app/api/augment/route.ts` (reject unauthenticated users)

- [ ] **Step 1: Add auth check to augment route**

The augment route already calls `auth()` (added in Task 3). Verify it rejects unauthenticated users. Add before conversation creation:

```typescript
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

- [ ] **Step 2: Document the intentional public read on conversations/[id]**

The GET on `/api/conversations/[id]` is intentionally public (for shared links). Add a comment:

```typescript
// Public read — shared conversation links work without auth.
// The `isOwner` flag controls what the UI shows.
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/augment/route.ts src/app/api/conversations/[id]/route.ts
git commit -m "fix: consistent auth enforcement across API routes"
```

---

## Task 10: Merge Live + Saved Conversation View in [id]/page.tsx

**Files:**
- Modify: `src/app/conversation/[id]/page.tsx`

This is the critical task that unifies the two conversation views. The existing `[id]/page.tsx` only shows saved conversations. We need it to also handle the "live" flow where model calls haven't been made yet.

- [ ] **Step 1: Read current [id]/page.tsx and plan the merge**

The existing page fetches from `/api/conversations/{id}` and renders responses. We need to add:
- Detection of "no responses yet" state
- Model call firing logic (from the old `conversation/page.tsx`)
- Round 2 support

- [ ] **Step 2: Implement the unified page**

The full implementation should:
1. Fetch conversation
2. If `responses.length > 0` → render saved responses (existing behavior)
3. If `responses.length === 0 && status === 'running'` → fire model calls, show live state
4. Support Round 2 in both modes

This is a significant file — implement it by combining the model-calling logic from `conversation/page.tsx` with the display logic from `[id]/page.tsx`.

- [ ] **Step 3: Test manually**

Run: `cd /Users/jac/Dev/src/conversation_with_ai-refactor && npm run dev`
Test the full flow: Home → Review → Conversation

- [ ] **Step 4: Commit**

```bash
git add src/app/conversation/[id]/page.tsx
git commit -m "feat: unified conversation page handles live and saved views"
```

---

## Task 11: Return Augmentations in Conversation Detail API

**Files:**
- Modify: `src/app/api/conversations/[id]/route.ts`

- [ ] **Step 1: Include augmentations in GET response**

The review page needs the augmentations data. Add it to the response:

```typescript
return NextResponse.json({
  ...conv[0],
  models: JSON.parse(conv[0].models),
  augmentations: conv[0].augmentations ? JSON.parse(conv[0].augmentations) : null,
  isOwner,
  responses: resps.map(/* ... existing mapping ... */),
})
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/conversations/[id]/route.ts
git commit -m "feat: include augmentations in conversation detail API"
```

---

## Task 12: Run Full Test Suite and Fix Breakage

- [ ] **Step 1: Run all tests**

Run: `cd /Users/jac/Dev/src/conversation_with_ai-refactor && npx vitest run`

- [ ] **Step 2: Fix any test failures**

Update tests that reference old URL-param patterns or deleted files.

- [ ] **Step 3: Run build to check for type errors**

Run: `cd /Users/jac/Dev/src/conversation_with_ai-refactor && npx next build 2>&1 | tail -20`

- [ ] **Step 4: Fix any build errors**

- [ ] **Step 5: Commit fixes**

```bash
git add -A
git commit -m "fix: update tests and fix build errors after refactor"
```

---

## Summary of Changes

| Problem | Fix |
|---------|-----|
| URL params as state bus | DB-first: augment creates draft, review updates it, conversation reads it |
| No input validation | Zod schemas on all API routes |
| Silent error swallowing | Replace `.catch(() => {})` with `console.warn` + user-visible errors |
| Inconsistent auth | Auth check on augment route, documented public read |
| Unguarded LLM parsing | try/catch with field validation in `parseMultiAugmenterResponse` |
| `essayMode !== false` bug | Changed to `essayMode === true` |
| Fragile page reload | Conversation page loads from DB — refresh just re-fetches |
| Two separate conversation views | Unified `/conversation/[id]` handles both live and saved |
