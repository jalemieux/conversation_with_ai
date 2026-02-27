# Optional Round 2 with Parallel Model Calls — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single SSE stream with parallel per-model fetch calls, making Round 2 optional and user-triggered.

**Architecture:** Split current `POST /api/conversation` into two endpoints: one that saves metadata and returns an ID, and one that calls a single model for a given round. The client fires N parallel calls per round. Round 2 is triggered by a button click after Round 1 completes.

**Tech Stack:** Next.js API routes, Vercel AI SDK (`generateText`), Drizzle ORM, React state

---

### Task 1: Simplify `POST /api/conversation` to metadata-only

**Files:**
- Modify: `src/app/api/conversation/route.ts`

**Step 1: Rewrite the route to save metadata and return JSON**

Replace the entire file with:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations } from '@/db/schema'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  const { rawInput, augmentedPrompt, topicType, framework, models } = await request.json()

  if (!augmentedPrompt || !models || !Array.isArray(models) || models.length === 0) {
    return NextResponse.json({ error: 'augmentedPrompt and models are required' }, { status: 400 })
  }

  const conversationId = randomUUID()

  await db.insert(conversations).values({
    id: conversationId,
    rawInput: rawInput ?? '',
    augmentedPrompt,
    topicType: topicType ?? 'open_question',
    framework: framework ?? 'multiple_angles',
    models: JSON.stringify(models),
  })

  return NextResponse.json({ conversationId })
}
```

**Step 2: Verify it works**

Run: `npx next build` (or start dev server and POST manually)
Expected: Returns `{ conversationId: "..." }` with 200 status

**Step 3: Commit**

```bash
git add src/app/api/conversation/route.ts
git commit -m "refactor: simplify conversation route to metadata-only"
```

---

### Task 2: Create `POST /api/conversation/respond` endpoint

**Files:**
- Create: `src/app/api/conversation/respond/route.ts`

**Step 1: Create the respond route**

```typescript
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations, responses } from '@/db/schema'
import { getModelProvider, MODEL_CONFIGS } from '@/lib/models'
import { buildRound1Prompt, buildRound2Prompt } from '@/lib/orchestrator'
import { buildSystemPrompt } from '@/lib/system-prompt'
import type { Round1Response } from '@/lib/orchestrator'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  const { conversationId, model: modelKey, round, essayMode } = await request.json()

  if (!conversationId || !modelKey || !round) {
    return NextResponse.json({ error: 'conversationId, model, and round are required' }, { status: 400 })
  }

  const config = MODEL_CONFIGS[modelKey]
  if (!config) {
    return NextResponse.json({ error: `Unknown model: ${modelKey}` }, { status: 400 })
  }

  // Build prompt based on round
  let prompt: string
  if (round === 1) {
    // Fetch conversation to get augmentedPrompt
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId))
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    prompt = buildRound1Prompt(conv.augmentedPrompt, config.name)
  } else if (round === 2) {
    // Fetch conversation + round 1 responses
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId))
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    const round1Rows = await db.select().from(responses).where(
      and(eq(responses.conversationId, conversationId), eq(responses.round, 1))
    )
    const round1Responses: Round1Response[] = round1Rows.map((r) => ({
      model: MODEL_CONFIGS[r.model]?.name ?? r.model,
      content: r.content,
    }))
    prompt = buildRound2Prompt(conv.augmentedPrompt, config.name, round1Responses)
  } else {
    return NextResponse.json({ error: 'round must be 1 or 2' }, { status: 400 })
  }

  const { text } = await generateText({
    model: getModelProvider(modelKey),
    ...(essayMode !== false && { system: buildSystemPrompt(round as 1 | 2) }),
    prompt,
    ...(config.providerOptions && { providerOptions: config.providerOptions }),
  })

  // Save response to DB
  const respId = randomUUID()
  await db.insert(responses).values({
    id: respId,
    conversationId,
    round,
    model: modelKey,
    content: text,
  })

  return NextResponse.json({
    content: text,
    model: modelKey,
    modelName: config.name,
    provider: config.provider,
    modelId: config.modelId,
    round,
  })
}
```

**Step 2: Verify it builds**

Run: `npx next build`
Expected: No build errors

**Step 3: Commit**

```bash
git add src/app/api/conversation/respond/route.ts
git commit -m "feat: add per-model respond endpoint for parallel calls"
```

---

### Task 3: Rewrite conversation streaming page to use parallel fetches

**Files:**
- Modify: `src/app/conversation/page.tsx`

**Step 1: Rewrite the page**

Replace the entire `ConversationContent` component. Key changes:
- Remove all SSE/streaming logic
- Add `round1Done` and `round2Done` state booleans
- Add per-model loading/error/response state
- On mount: POST to `/api/conversation` for ID, then fire parallel `/api/conversation/respond` calls
- After all Round 1 calls resolve: show "Start Round 2" button
- On button click: fire parallel Round 2 calls

```tsx
'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import MarkdownContent from '@/components/MarkdownContent'
import { useTTS } from '@/hooks/useTTS'
import { SpeakerButton } from '@/components/SpeakerButton'
import { CopyButton } from '@/components/CopyButton'

interface ModelResponse {
  round: number
  model: string
  modelName: string
  provider: string
  modelId: string
  content: string
}

interface ModelState {
  loading: boolean
  error: string | null
  response: ModelResponse | null
}

const MODEL_ACCENT: Record<string, string> = {
  claude: 'text-claude',
  gpt: 'text-gpt',
  gemini: 'text-gemini',
  grok: 'text-grok',
}

const MODEL_DOT: Record<string, string> = {
  claude: 'bg-claude',
  gpt: 'bg-gpt',
  gemini: 'bg-gemini',
  grok: 'bg-grok',
}

function ConversationContent() {
  const searchParams = useSearchParams()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [round1States, setRound1States] = useState<Record<string, ModelState>>({})
  const [round2States, setRound2States] = useState<Record<string, ModelState>>({})
  const [round2Started, setRound2Started] = useState(false)
  const [topic, setTopic] = useState('')
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)
  const tts = useTTS()

  const models = (searchParams.get('models') ?? '').split(',').filter(Boolean)
  const essayMode = searchParams.get('essayMode') !== 'false'

  const callModel = useCallback(async (convId: string, modelKey: string, round: number): Promise<ModelResponse> => {
    const res = await fetch('/api/conversation/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: convId, model: modelKey, round, essayMode }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Request failed')
    }
    return res.json()
  }, [essayMode])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const rawInput = searchParams.get('rawInput') ?? ''
    const augmentedPrompt = searchParams.get('augmentedPrompt') ?? ''
    const topicType = searchParams.get('topicType') ?? ''
    const framework = searchParams.get('framework') ?? ''

    setTopic(augmentedPrompt || rawInput)

    if (!augmentedPrompt || models.length === 0) return

    // Initialize round 1 loading states
    const initialStates: Record<string, ModelState> = {}
    models.forEach((m) => { initialStates[m] = { loading: true, error: null, response: null } })
    setRound1States(initialStates)

    // Create conversation, then fire parallel model calls
    fetch('/api/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput, augmentedPrompt, topicType, framework, models }),
    })
      .then((res) => res.json())
      .then(({ conversationId: convId }) => {
        setConversationId(convId)

        // Fire all Round 1 calls in parallel
        models.forEach((modelKey) => {
          callModel(convId, modelKey, 1)
            .then((response) => {
              setRound1States((prev) => ({ ...prev, [modelKey]: { loading: false, error: null, response } }))
            })
            .catch((err) => {
              setRound1States((prev) => ({ ...prev, [modelKey]: { loading: false, error: err.message, response: null } }))
            })
        })
      })
      .catch((err) => setError(err.message))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startRound2 = () => {
    if (!conversationId) return
    setRound2Started(true)

    const initialStates: Record<string, ModelState> = {}
    models.forEach((m) => { initialStates[m] = { loading: true, error: null, response: null } })
    setRound2States(initialStates)

    models.forEach((modelKey) => {
      callModel(conversationId, modelKey, 2)
        .then((response) => {
          setRound2States((prev) => ({ ...prev, [modelKey]: { loading: false, error: null, response } }))
        })
        .catch((err) => {
          setRound2States((prev) => ({ ...prev, [modelKey]: { loading: false, error: err.message, response: null } }))
        })
    })
  }

  const round1Responses = Object.values(round1States).filter((s) => s.response).map((s) => s.response!)
  const round1Loading = Object.values(round1States).some((s) => s.loading)
  const round1Done = Object.keys(round1States).length > 0 && !round1Loading
  const round2Responses = Object.values(round2States).filter((s) => s.response).map((s) => s.response!)
  const round2Loading = Object.values(round2States).some((s) => s.loading)
  const round2Done = round2Started && !round2Loading
  const allDone = round1Done && (!round2Started || round2Done)

  const getAccent = (model: string, round: number) => {
    if (round === 2) return 'text-round2'
    return MODEL_ACCENT[model] ?? 'text-amber'
  }

  const getDot = (model: string, round: number) => {
    if (round === 2) return 'bg-round2'
    return MODEL_DOT[model] ?? 'bg-amber'
  }

  const getSpeakerState = (key: string): 'idle' | 'loading' | 'playing' | 'error' => {
    if (tts.playingKey === key) return 'playing'
    if (tts.loadingKey === key) return 'loading'
    if (tts.errorKey === key) return 'error'
    return 'idle'
  }

  const ResponseCard = ({ r }: { r: ModelResponse }) => (
    <details open className="bg-card border border-border rounded-xl overflow-hidden animate-fade-up">
      <summary className="px-5 py-4 cursor-pointer select-none hover:bg-card-hover transition-colors flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDot(r.model, r.round)}`} />
        <span className={`font-medium ${getAccent(r.model, r.round)}`}>{r.modelName}</span>
        <span className="text-xs text-ink-faint">{r.provider} / {r.modelId}</span>
        <span className="ml-auto flex items-center">
          <CopyButton content={r.content} />
          <SpeakerButton
            state={getSpeakerState(`${r.round}-${r.model}`)}
            onClick={() => tts.toggle(`${r.round}-${r.model}`, r.content, r.model)}
          />
        </span>
      </summary>
      <div className="px-5 pb-5 border-t border-border pt-4">
        <MarkdownContent content={r.content} />
      </div>
    </details>
  )

  const LoadingCard = ({ modelKey, round }: { modelKey: string; round: number }) => (
    <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-up px-5 py-4 flex items-center gap-3">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDot(modelKey, round)}`} />
      <span className={`font-medium ${getAccent(modelKey, round)}`}>{modelKey}</span>
      <span className="ml-auto w-4 h-4 border-2 border-ink-faint/30 border-t-amber rounded-full animate-spin" />
    </div>
  )

  const ErrorCard = ({ modelKey, message, round }: { modelKey: string; message: string; round: number }) => (
    <div className="bg-danger/5 border border-danger/20 rounded-xl overflow-hidden animate-fade-up px-5 py-4 flex items-center gap-3">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDot(modelKey, round)}`} />
      <span className={`font-medium ${getAccent(modelKey, round)}`}>{modelKey}</span>
      <span className="text-danger text-sm ml-2">{message}</span>
    </div>
  )

  return (
    <div>
      <a href="/" className="text-ink-faint hover:text-amber text-sm mb-6 inline-flex items-center gap-1.5 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        New Conversation
      </a>

      {topic && (
        <div className="mb-10 animate-fade-up">
          <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-2">Topic</p>
          <div className="border-l-2 border-amber pl-5 py-1">
            <p className="text-ink leading-relaxed">{topic}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl p-4 mb-6 text-danger animate-fade-up">
          {error}
        </div>
      )}

      {Object.keys(round1States).length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5 animate-fade-up">
            <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Round 1 — Initial Responses</p>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-3">
            {models.map((modelKey) => {
              const state = round1States[modelKey]
              if (!state) return null
              if (state.response) return <ResponseCard key={modelKey} r={state.response} />
              if (state.error) return <ErrorCard key={modelKey} modelKey={modelKey} message={state.error} round={1} />
              return <LoadingCard key={modelKey} modelKey={modelKey} round={1} />
            })}
          </div>
        </div>
      )}

      {round2Started && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5 animate-fade-up">
            <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Round 2 — Reactions</p>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-3">
            {models.map((modelKey) => {
              const state = round2States[modelKey]
              if (!state) return null
              if (state.response) return <ResponseCard key={modelKey} r={state.response} />
              if (state.error) return <ErrorCard key={modelKey} modelKey={modelKey} message={state.error} round={2} />
              return <LoadingCard key={modelKey} modelKey={modelKey} round={2} />
            })}
          </div>
        </div>
      )}

      {round1Loading && (
        <div className="text-center py-10 animate-fade-in">
          <div className="inline-flex items-center gap-3 text-ink-muted">
            <span className="w-5 h-5 border-2 border-ink-faint/30 border-t-amber rounded-full animate-spin" />
            Round 1 in progress... ({round1Responses.length} of {models.length} responses received)
          </div>
        </div>
      )}

      {allDone && (
        <div className="mt-8 animate-fade-up flex flex-wrap gap-2">
          {round1Done && !round2Started && (
            <button
              onClick={startRound2}
              className="px-5 py-2.5 bg-amber text-cream hover:bg-amber-dark rounded-xl font-medium transition-all duration-200 text-sm shadow-[0_2px_8px_rgba(26,26,26,0.15)] hover:shadow-[0_2px_12px_rgba(26,26,26,0.25)] cursor-pointer"
            >
              Start Round 2
            </button>
          )}
          <button
            onClick={() => { window.location.href = '/' }}
            className="px-5 py-2.5 bg-ink text-cream hover:bg-ink-light rounded-xl font-medium transition-all duration-200 text-sm shadow-[0_2px_8px_rgba(26,26,26,0.15)] hover:shadow-[0_2px_12px_rgba(26,26,26,0.25)] cursor-pointer"
          >
            New Conversation
          </button>
          <button
            onClick={() => {
              if (!conversationId) return
              fetch(`/api/conversations/${conversationId}`)
                .then((r) => r.json())
                .then((data) => {
                  import('@/lib/export').then(({ exportMarkdown }) => {
                    navigator.clipboard.writeText(exportMarkdown(data))
                  })
                })
            }}
            className="px-5 py-2.5 bg-card border border-border hover:border-border-strong hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] rounded-xl font-medium transition-all duration-200 text-sm text-ink-muted hover:text-ink cursor-pointer"
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
            className="px-5 py-2.5 bg-card border border-border hover:border-border-strong hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] rounded-xl font-medium transition-all duration-200 text-sm text-ink-muted hover:text-ink cursor-pointer"
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
            className="px-5 py-2.5 bg-card border border-border hover:border-border-strong hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] rounded-xl font-medium transition-all duration-200 text-sm text-ink-muted hover:text-ink cursor-pointer"
          >
            Copy X Thread
          </button>
        </div>
      )}
    </div>
  )
}

export default function ConversationPage() {
  return (
    <Suspense fallback={<div className="text-ink-faint">Loading...</div>}>
      <ConversationContent />
    </Suspense>
  )
}
```

**Step 2: Verify it builds**

Run: `npx next build`
Expected: No build errors

**Step 3: Commit**

```bash
git add src/app/conversation/page.tsx
git commit -m "feat: replace SSE with parallel per-model fetches, optional Round 2"
```

---

### Task 4: Clean up unused SSE type

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Remove the `SSEEvent` interface**

Remove the `SSEEvent` interface from `src/lib/types.ts` since SSE is no longer used. Keep `ConversationResponse` and `Conversation`.

**Step 2: Check for any remaining references**

Run: `grep -r "SSEEvent" src/`
Expected: No matches

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "chore: remove unused SSEEvent type"
```

---

### Task 5: Update documentation

**Files:**
- Modify: `docs/architecture.md`
- Modify: `README.md`

**Step 1: Update architecture.md**

Update the API routes section to reflect the new endpoints and the optional Round 2 flow. Add a changelog entry.

**Step 2: Update README.md**

Update features list to mention optional Round 2.

**Step 3: Commit**

```bash
git add docs/architecture.md README.md
git commit -m "docs: update architecture and README for optional round 2"
```

---

### Task 6: Manual smoke test

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test Round 1 only flow**

- Enter a topic, select models, run conversation
- Verify all Round 1 cards load independently
- Verify "Start Round 2" button appears after all complete
- Navigate away without clicking Round 2
- Verify conversation appears in history with only Round 1 responses

**Step 3: Test Round 2 flow**

- Run a new conversation
- After Round 1 completes, click "Start Round 2"
- Verify Round 2 cards load independently
- Verify export buttons work with both rounds
