# Streaming LLM Responses Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stream LLM discussion responses token-by-token to the UI so users see text appearing in real-time instead of waiting for full completion.

**Architecture:** Replace `generateText()` with `streamText()` from Vercel AI SDK. Send `token` SSE events per chunk. Frontend accumulates chunks per model in a Map, renders partial text live. DB save happens after stream completion.

**Tech Stack:** Vercel AI SDK (`streamText`, `textStream`), Next.js SSE, React state

---

### Task 1: Backend — Switch to streamText with token SSE events

**Files:**
- Modify: `src/app/api/conversation/route.ts`

**Step 1: Update import**

Change line 1 from:
```typescript
import { generateText } from 'ai'
```
to:
```typescript
import { streamText } from 'ai'
```

**Step 2: Replace Round 1 generateText with streamText**

Replace the Round 1 model mapping (lines 42-63) with:

```typescript
const round1Results: Round1Response[] = await Promise.all(
  models.map(async (modelKey: string) => {
    const config = MODEL_CONFIGS[modelKey]
    const prompt = buildRound1Prompt(augmentedPrompt, config.name)

    const result = streamText({
      model: getModelProvider(modelKey),
      prompt,
      maxOutputTokens: 1500,
    })

    let fullText = ''
    for await (const chunk of result.textStream) {
      fullText += chunk
      send('token', { round: 1, model: modelKey, modelName: config.name, chunk })
    }

    const respId = randomUUID()
    await db.insert(responses).values({
      id: respId,
      conversationId,
      round: 1,
      model: modelKey,
      content: fullText,
    })

    send('response', { round: 1, model: modelKey, modelName: config.name, content: fullText })
    return { model: config.name, content: fullText }
  })
)
```

**Step 3: Replace Round 2 generateText with streamText**

Replace the Round 2 model mapping (lines 71-93) with the same pattern but `round: 2`:

```typescript
await Promise.all(
  models.map(async (modelKey: string) => {
    const config = MODEL_CONFIGS[modelKey]
    const prompt = buildRound2Prompt(augmentedPrompt, config.name, round1Results)

    const result = streamText({
      model: getModelProvider(modelKey),
      prompt,
      maxOutputTokens: 1500,
    })

    let fullText = ''
    for await (const chunk of result.textStream) {
      fullText += chunk
      send('token', { round: 2, model: modelKey, modelName: config.name, chunk })
    }

    const respId = randomUUID()
    await db.insert(responses).values({
      id: respId,
      conversationId,
      round: 2,
      model: modelKey,
      content: fullText,
    })

    send('response', { round: 2, model: modelKey, modelName: config.name, content: fullText })
  })
)
```

**Step 4: Verify the app builds**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx next build`
Expected: Build succeeds (no type errors)

**Step 5: Run existing tests**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx vitest run`
Expected: All 17 tests pass (none test the route directly)

**Step 6: Commit**

```bash
git add src/app/api/conversation/route.ts
git commit -m "feat: switch from generateText to streamText for token-level streaming"
```

---

### Task 2: Frontend — Handle token events and render streaming text

**Files:**
- Modify: `src/app/conversation/page.tsx`

**Step 1: Add streaming state**

After the existing state declarations (line 20), add:

```typescript
const [streamingResponses, setStreamingResponses] = useState<Map<string, ModelResponse>>(new Map())
```

**Step 2: Handle the `token` SSE event**

In the switch statement (after the `round_start` case, around line 64), add:

```typescript
case 'token': {
  const key = `${data.round}-${data.model}`
  setStreamingResponses((prev) => {
    const next = new Map(prev)
    const existing = next.get(key)
    if (existing) {
      next.set(key, { ...existing, content: existing.content + data.chunk })
    } else {
      next.set(key, { round: data.round, model: data.model, modelName: data.modelName, content: data.chunk })
    }
    return next
  })
  break
}
```

**Step 3: Clean up streaming entry on response completion**

Update the existing `response` case to also remove from streaming map:

```typescript
case 'response':
  setStreamingResponses((prev) => {
    const next = new Map(prev)
    next.delete(`${data.round}-${data.model}`)
    return next
  })
  setResponses((prev) => [...prev, data])
  break
```

**Step 4: Render streaming responses alongside completed ones**

Replace the round1/round2 rendering sections. After `const round1 = ...` and `const round2 = ...` (lines 88-89), add:

```typescript
const streaming1 = Array.from(streamingResponses.values()).filter((r) => r.round === 1)
const streaming2 = Array.from(streamingResponses.values()).filter((r) => r.round === 2)
```

Then update the Round 1 section condition (line 101) from:
```tsx
{round1.length > 0 && (
```
to:
```tsx
{(round1.length > 0 || streaming1.length > 0) && (
```

And after the round1.map block (after line 111's closing `)}`) but before the closing `</div>`, add:

```tsx
{streaming1.map((r) => (
  <div key={`streaming-${r.model}`} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
    <h3 className="font-medium text-blue-400 mb-2">{r.modelName}</h3>
    <div className="text-gray-300 whitespace-pre-wrap">{r.content}<span className="animate-pulse">▍</span></div>
  </div>
))}
```

Do the same for Round 2 — update condition to include `streaming2.length > 0`, and add the streaming cards with `text-purple-400` for the model name.

**Step 5: Verify build**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx next build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/app/conversation/page.tsx
git commit -m "feat: render streaming tokens in real-time with cursor indicator"
```

---

### Task 3: Manual smoke test

**Step 1: Start dev server**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npm run dev`

**Step 2: Test the full flow**

1. Open http://localhost:3000
2. Enter a topic and select models
3. Confirm the augmented prompt on the review page
4. On the conversation page, verify:
   - Model cards appear as soon as first token arrives (not after full completion)
   - Text streams in token-by-token with the ▍ cursor
   - Cursor disappears when model completes
   - Both rounds stream correctly
   - Export buttons work after completion

**Step 3: Commit any fixes if needed**

---

### Task 4: Update documentation

**Files:**
- Modify: `docs/architecture.md`

**Step 1: Update architecture doc**

Add to the SSE protocol section that `token` is a new event type. Update any mention of `generateText` to `streamText`. Add a changelog entry noting the streaming enhancement.

**Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: update architecture for streaming responses"
```
