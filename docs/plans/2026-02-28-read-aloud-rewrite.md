# Read-Aloud Text Rewriting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an LLM rewriting pass to the TTS pipeline that transforms written responses into natural spoken-word form before audio generation.

**Architecture:** New `rewriteForAudio()` function in `src/lib/tts.ts` calls the same model that wrote the response to rewrite it for spoken delivery. The TTS API route gains a rewrite step between audio cache check and TTS generation, with filesystem caching for rewritten scripts.

**Tech Stack:** Vercel AI SDK (`generateText`), existing model providers from `src/lib/models.ts`, vitest for testing.

---

### Task 1: Add `REWRITE_SYSTEM_PROMPT` to tts.ts

**Files:**
- Modify: `src/lib/tts.ts`
- Test: `src/lib/tts.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/tts.test.ts`:

```typescript
describe('REWRITE_SYSTEM_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(REWRITE_SYSTEM_PROMPT).toBeTruthy()
    expect(typeof REWRITE_SYSTEM_PROMPT).toBe('string')
  })

  it('should instruct to preserve substance and tone', () => {
    expect(REWRITE_SYSTEM_PROMPT).toMatch(/preserve/i)
  })

  it('should instruct to output plain text only', () => {
    expect(REWRITE_SYSTEM_PROMPT).toMatch(/no markdown/i)
  })
})
```

Update the import at top of test file to include `REWRITE_SYSTEM_PROMPT`.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tts.test.ts`
Expected: FAIL — `REWRITE_SYSTEM_PROMPT` is not exported

**Step 3: Write the implementation**

Add to `src/lib/tts.ts`:

```typescript
export const REWRITE_SYSTEM_PROMPT = `You are rewriting a written response so it sounds natural when read aloud by a text-to-speech system.

Rules:
- Preserve ALL substance, nuance, arguments, and tone from the original. Do not summarize or cut content.
- Maintain approximately the same length as the original.
- Remove structural artifacts: convert bullet points, numbered lists, and headers into flowing prose with natural spoken transitions.
- Replace visual references ("as shown above", "the following list", "see below") with spoken equivalents ("as I mentioned", "here are a few points", "let me walk through this").
- Spell out abbreviations on first use (e.g., "API" becomes "A.P.I." or "application programming interface" depending on context).
- Convert parenthetical asides into natural spoken digressions ("by the way", "it's worth noting").
- Keep the original author's personality and voice intact — if the original is witty, stay witty; if serious, stay serious.
- Output pure plain text. No markdown, no bullet points, no numbered lists, no headers, no formatting of any kind.
- Do not add any preamble like "Here is the rewritten version". Just output the rewritten text directly.`
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tts.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/tts.ts src/lib/tts.test.ts
git commit -m "feat(tts): add REWRITE_SYSTEM_PROMPT for read-aloud text transformation"
```

---

### Task 2: Add `rewriteForAudio()` function to tts.ts

**Files:**
- Modify: `src/lib/tts.ts`
- Test: `src/lib/tts.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/tts.test.ts`:

```typescript
// At the top, add mock for AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@/lib/models', () => ({
  getModelProvider: vi.fn(),
}))

import { generateText } from 'ai'
import { getModelProvider } from '@/lib/models'

const mockGenerateText = vi.mocked(generateText)
const mockGetModelProvider = vi.mocked(getModelProvider)

describe('rewriteForAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call generateText with the correct model and prompt', async () => {
    const mockModel = {} as any
    mockGetModelProvider.mockReturnValue(mockModel)
    mockGenerateText.mockResolvedValue({ text: 'rewritten text' } as any)

    const result = await rewriteForAudio('original text', 'claude')

    expect(mockGetModelProvider).toHaveBeenCalledWith('claude')
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: mockModel,
        system: REWRITE_SYSTEM_PROMPT,
        prompt: 'original text',
      })
    )
    expect(result).toBe('rewritten text')
  })

  it('should not pass providerOptions (no thinking/reasoning)', async () => {
    const mockModel = {} as any
    mockGetModelProvider.mockReturnValue(mockModel)
    mockGenerateText.mockResolvedValue({ text: 'rewritten' } as any)

    await rewriteForAudio('text', 'gpt')

    const callArgs = mockGenerateText.mock.calls[0][0]
    expect(callArgs).not.toHaveProperty('providerOptions')
    expect(callArgs).not.toHaveProperty('tools')
  })

  it('should propagate errors from generateText', async () => {
    const mockModel = {} as any
    mockGetModelProvider.mockReturnValue(mockModel)
    mockGenerateText.mockRejectedValue(new Error('Model error'))

    await expect(rewriteForAudio('text', 'claude')).rejects.toThrow('Model error')
  })
})
```

Update the import to include `rewriteForAudio`.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tts.test.ts`
Expected: FAIL — `rewriteForAudio` is not exported

**Step 3: Write the implementation**

Add to `src/lib/tts.ts`:

```typescript
import { generateText } from 'ai'
import { getModelProvider } from '@/lib/models'

export async function rewriteForAudio(text: string, modelKey: string): Promise<string> {
  const model = getModelProvider(modelKey)
  const { text: rewritten } = await generateText({
    model,
    system: REWRITE_SYSTEM_PROMPT,
    prompt: text,
  })
  return rewritten
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tts.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/tts.ts src/lib/tts.test.ts
git commit -m "feat(tts): add rewriteForAudio() function"
```

---

### Task 3: Add script caching helpers to TTS route

**Files:**
- Modify: `src/app/api/tts/route.ts`
- Test: `src/app/api/tts/route.test.ts`

**Step 1: Write the failing test**

Add a new test to `src/app/api/tts/route.test.ts` that verifies script cache path:

```typescript
it('should check for cached script when audio cache misses', async () => {
  // Audio cache miss
  mockReadFile.mockImplementation((path: any) => {
    if (String(path).endsWith('.mp3')) return Promise.reject(new Error('ENOENT'))
    if (String(path).endsWith('.script.txt')) return Promise.reject(new Error('ENOENT'))
    return Promise.reject(new Error('unexpected path'))
  })
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)

  // Mock rewriteForAudio
  mockRewriteForAudio.mockResolvedValue('rewritten text for audio')

  const mockArrayBuffer = new ArrayBuffer(8)
  mockCreate.mockResolvedValue({
    arrayBuffer: () => Promise.resolve(mockArrayBuffer),
  })

  const req = new Request('http://localhost/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: '**Hello** world',
      model: 'claude',
      conversationId: 'conv-789',
      round: 1,
    }),
  })
  const res = await POST(req)

  expect(res.status).toBe(200)
  // Should have tried to read both .mp3 and .script.txt
  const readPaths = mockReadFile.mock.calls.map(c => String(c[0]))
  expect(readPaths.some(p => p.endsWith('.mp3'))).toBe(true)
  expect(readPaths.some(p => p.endsWith('.script.txt'))).toBe(true)
})
```

Also add the `rewriteForAudio` mock at the top of the test file:

```typescript
vi.mock('@/lib/tts', () => ({
  MODEL_VOICES: { claude: 'coral', gpt: 'nova', gemini: 'sage', grok: 'ash' },
  stripMarkdown: vi.fn((t: string) => t.replace(/\*\*/g, '')),
  rewriteForAudio: vi.fn(),
}))

import { rewriteForAudio } from '@/lib/tts'
const mockRewriteForAudio = vi.mocked(rewriteForAudio)
```

**Note:** This requires updating the existing mock of `@/lib/tts` — currently the tests import `MODEL_VOICES` and `stripMarkdown` directly. Replace those imports with the mock above, and update the existing import to come from the mocked module.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/tts/route.test.ts`
Expected: FAIL — route doesn't read `.script.txt` yet

**Step 3: Write the implementation**

Modify `src/app/api/tts/route.ts` — add a `getScriptCachePath` helper and update the POST handler:

```typescript
import { MODEL_VOICES, stripMarkdown, rewriteForAudio } from '@/lib/tts'

function getScriptCachePath(conversationId: string, round: number, model: string): string {
  const safeId = conversationId.replace(/[^a-zA-Z0-9_-]/g, '')
  const safeModel = model.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(process.cwd(), 'data', 'audio', safeId, `${round}-${safeModel}.script.txt`)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/tts/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/tts/route.ts src/app/api/tts/route.test.ts
git commit -m "feat(tts): add script cache path helper and mock setup"
```

---

### Task 4: Integrate rewrite step into TTS route

**Files:**
- Modify: `src/app/api/tts/route.ts`
- Test: `src/app/api/tts/route.test.ts`

**Step 1: Write the failing tests**

Add to `src/app/api/tts/route.test.ts`:

```typescript
it('should call rewriteForAudio and use rewritten text for TTS', async () => {
  // Both caches miss
  mockReadFile.mockRejectedValue(new Error('ENOENT'))
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
  mockRewriteForAudio.mockResolvedValue('rewritten for speaking')

  const mockArrayBuffer = new ArrayBuffer(8)
  mockCreate.mockResolvedValue({
    arrayBuffer: () => Promise.resolve(mockArrayBuffer),
  })

  const req = new Request('http://localhost/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: '## Heading\n\n- bullet one\n- bullet two',
      model: 'claude',
      conversationId: 'conv-rewrite',
      round: 1,
    }),
  })
  const res = await POST(req)

  expect(res.status).toBe(200)
  expect(mockRewriteForAudio).toHaveBeenCalledWith(
    '## Heading\n\n- bullet one\n- bullet two',
    'claude'
  )
  // TTS should receive the rewritten text (after stripMarkdown)
  expect(mockCreate.mock.calls[0][0].input).toContain('rewritten')
})

it('should use cached script text and skip rewrite', async () => {
  // Audio cache miss, script cache hit
  mockReadFile.mockImplementation((path: any) => {
    if (String(path).endsWith('.mp3')) return Promise.reject(new Error('ENOENT'))
    if (String(path).endsWith('.script.txt')) return Promise.resolve(Buffer.from('cached script text'))
    return Promise.reject(new Error('unexpected'))
  })
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)

  const mockArrayBuffer = new ArrayBuffer(8)
  mockCreate.mockResolvedValue({
    arrayBuffer: () => Promise.resolve(mockArrayBuffer),
  })

  const req = new Request('http://localhost/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'original text',
      model: 'gpt',
      conversationId: 'conv-cached',
      round: 1,
    }),
  })
  const res = await POST(req)

  expect(res.status).toBe(200)
  expect(mockRewriteForAudio).not.toHaveBeenCalled()
  // TTS should use the cached script
  expect(mockCreate.mock.calls[0][0].input).toContain('cached script')
})

it('should save rewritten script to disk', async () => {
  mockReadFile.mockRejectedValue(new Error('ENOENT'))
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
  mockRewriteForAudio.mockResolvedValue('rewritten script content')

  const mockArrayBuffer = new ArrayBuffer(8)
  mockCreate.mockResolvedValue({
    arrayBuffer: () => Promise.resolve(mockArrayBuffer),
  })

  const req = new Request('http://localhost/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'original',
      model: 'claude',
      conversationId: 'conv-save',
      round: 1,
    }),
  })
  await POST(req)

  await new Promise((r) => setTimeout(r, 0))
  const writePaths = mockWriteFile.mock.calls.map(c => String(c[0]))
  expect(writePaths.some(p => p.endsWith('.script.txt'))).toBe(true)
})

it('should skip rewrite when caching is disabled (no conversationId)', async () => {
  const mockArrayBuffer = new ArrayBuffer(8)
  mockCreate.mockResolvedValue({
    arrayBuffer: () => Promise.resolve(mockArrayBuffer),
  })

  const req = new Request('http://localhost/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hello **world**', model: 'claude' }),
  })
  const res = await POST(req)

  expect(res.status).toBe(200)
  expect(mockRewriteForAudio).not.toHaveBeenCalled()
  // Should still strip markdown from original text
  expect(mockCreate).toHaveBeenCalled()
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/tts/route.test.ts`
Expected: FAIL — route doesn't call `rewriteForAudio` yet

**Step 3: Write the implementation**

Update the POST handler in `src/app/api/tts/route.ts`. The new flow:

```typescript
export async function POST(request: Request) {
  const body = await request.json()
  const { text, model, conversationId, round } = body

  if (!text || !model) {
    return new Response(JSON.stringify({ error: 'text and model are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const cachingEnabled = conversationId && round !== undefined && round !== null

  // 1. Check audio cache
  if (cachingEnabled) {
    const cachePath = getCachePath(conversationId, round, model)
    try {
      const cached = await readFile(cachePath)
      return new Response(cached, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': cached.byteLength.toString(),
        },
      })
    } catch {
      // Cache miss — fall through
    }
  }

  // 2. Get text for TTS: rewrite if caching enabled, otherwise use original
  let ttsText: string
  if (cachingEnabled) {
    const scriptPath = getScriptCachePath(conversationId, round, model)
    try {
      const cachedScript = await readFile(scriptPath, 'utf-8')
      ttsText = cachedScript
    } catch {
      // Script cache miss — rewrite
      const rewritten = await rewriteForAudio(text, model)
      ttsText = rewritten
      // Fire-and-forget: save script
      const dir = path.dirname(scriptPath)
      mkdir(dir, { recursive: true })
        .then(() => writeFile(scriptPath, rewritten, 'utf-8'))
        .catch(() => {})
    }
  } else {
    ttsText = text
  }

  const voice = MODEL_VOICES[model] ?? 'alloy'
  const cleanText = stripMarkdown(ttsText)

  try {
    const response = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: cleanText,
      instructions: 'Read naturally in a conversational tone.',
      response_format: 'mp3',
    })

    const buffer = await response.arrayBuffer()

    // Fire-and-forget: save audio to cache
    if (cachingEnabled) {
      const cachePath = getCachePath(conversationId, round, model)
      const dir = path.dirname(cachePath)
      mkdir(dir, { recursive: true })
        .then(() => writeFile(cachePath, Buffer.from(buffer)))
        .catch(() => {})
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.byteLength.toString(),
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'TTS generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
```

**Step 4: Run all tests to verify they pass**

Run: `npx vitest run src/app/api/tts/route.test.ts`
Expected: ALL PASS

Also run the tts.ts tests:
Run: `npx vitest run src/lib/tts.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/app/api/tts/route.ts src/app/api/tts/route.test.ts
git commit -m "feat(tts): integrate read-aloud rewrite step into TTS pipeline"
```

---

### Task 5: Run full test suite and manual verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS — no regressions

**Step 2: Manual smoke test**

1. Start dev server: `npm run dev`
2. Open a conversation with existing responses
3. Click a speaker icon
4. Verify: audio plays with naturally spoken text (not robotic list reading)
5. Check `data/audio/{conversationId}/` — should have both `.mp3` and `.script.txt` files
6. Click the same speaker icon again — should play instantly from cache
7. Delete the `.mp3` but keep `.script.txt` — click again, should regenerate audio without re-calling the LLM

**Step 3: Commit any fixes and final commit**

```bash
git add -A
git commit -m "feat(tts): complete read-aloud text rewriting feature"
```

---

### Task 6: Update documentation

**Files:**
- Modify: `docs/architecture.md`
- Modify: `README.md`

**Step 1: Update architecture.md**

Add the rewrite step to the TTS section. Add a new ADR entry for the read-aloud rewriting decision.

**Step 2: Update README.md**

Add "Read-aloud optimized audio" to the features list.

**Step 3: Commit**

```bash
git add docs/architecture.md README.md
git commit -m "docs: update architecture and README for read-aloud rewrite feature"
```
