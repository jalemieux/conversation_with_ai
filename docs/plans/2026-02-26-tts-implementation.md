# Text-to-Speech Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add on-demand text-to-speech playback to AI roundtable responses using OpenAI's TTS API, with a unique voice per model.

**Architecture:** A speaker icon in each response card header triggers on-demand TTS via a `useTTS` React hook. The hook fetches audio from a `/api/tts` server route that proxies to OpenAI's `gpt-4o-mini-tts` model, mapping each AI model to a distinct voice. Only one response can play at a time (toggle behavior).

**Tech Stack:** OpenAI TTS API (`openai` npm package), React hooks, Web Audio API (`HTMLAudioElement`), Next.js API routes.

---

### Task 1: Install OpenAI SDK

**Files:**
- Modify: `package.json`

**Step 1: Install the openai package**

Run: `npm install openai`

**Step 2: Verify installation**

Run: `npm ls openai`
Expected: `openai@x.x.x` listed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add openai sdk for TTS support"
```

---

### Task 2: TTS Utility — Voice Config & Markdown Stripping

**Files:**
- Create: `src/lib/tts.ts`
- Create: `src/lib/tts.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/lib/tts.test.ts
import { describe, it, expect } from 'vitest'
import { MODEL_VOICES, stripMarkdown, chunkText } from './tts'

describe('MODEL_VOICES', () => {
  it('should have a voice for each model', () => {
    expect(MODEL_VOICES.claude).toBe('coral')
    expect(MODEL_VOICES.gpt).toBe('nova')
    expect(MODEL_VOICES.gemini).toBe('sage')
    expect(MODEL_VOICES.grok).toBe('ash')
  })

  it('should have exactly 4 voice mappings', () => {
    expect(Object.keys(MODEL_VOICES)).toHaveLength(4)
  })
})

describe('stripMarkdown', () => {
  it('should remove heading markers', () => {
    expect(stripMarkdown('# Hello')).toBe('Hello')
    expect(stripMarkdown('## Sub heading')).toBe('Sub heading')
    expect(stripMarkdown('### Deep heading')).toBe('Deep heading')
  })

  it('should remove bold and italic markers', () => {
    expect(stripMarkdown('**bold text**')).toBe('bold text')
    expect(stripMarkdown('*italic text*')).toBe('italic text')
    expect(stripMarkdown('__bold__')).toBe('bold')
    expect(stripMarkdown('_italic_')).toBe('italic')
  })

  it('should remove link syntax but keep text', () => {
    expect(stripMarkdown('[click here](https://example.com)')).toBe('click here')
  })

  it('should remove image syntax', () => {
    expect(stripMarkdown('![alt text](image.png)')).toBe('alt text')
  })

  it('should remove inline code backticks', () => {
    expect(stripMarkdown('use `console.log`')).toBe('use console.log')
  })

  it('should remove code block fences', () => {
    expect(stripMarkdown('```javascript\nconst x = 1\n```')).toBe('const x = 1')
  })

  it('should remove bullet markers', () => {
    expect(stripMarkdown('- item one\n- item two')).toBe('item one\nitem two')
    expect(stripMarkdown('* item one')).toBe('item one')
  })

  it('should remove numbered list markers', () => {
    expect(stripMarkdown('1. first\n2. second')).toBe('first\nsecond')
  })

  it('should remove blockquote markers', () => {
    expect(stripMarkdown('> quoted text')).toBe('quoted text')
  })

  it('should remove horizontal rules', () => {
    expect(stripMarkdown('---')).toBe('')
    expect(stripMarkdown('***')).toBe('')
  })

  it('should handle mixed markdown', () => {
    const input = '## **Bold Heading**\n\n- Item with `code`\n- [Link](url)'
    const result = stripMarkdown(input)
    expect(result).toBe('Bold Heading\n\nItem with code\nLink')
  })

  it('should collapse multiple blank lines', () => {
    expect(stripMarkdown('line one\n\n\n\nline two')).toBe('line one\n\nline two')
  })
})

describe('chunkText', () => {
  it('should return single chunk for short text', () => {
    const text = 'Hello world.'
    expect(chunkText(text, 4096)).toEqual(['Hello world.'])
  })

  it('should split at sentence boundaries', () => {
    const sentence = 'A'.repeat(2050) + '. '
    const text = sentence + 'B'.repeat(100) + '.'
    const chunks = chunkText(text, 4096)
    expect(chunks.length).toBe(1) // fits in one chunk
  })

  it('should split long text into multiple chunks', () => {
    // Create text with multiple sentences that exceeds limit
    const sentences = Array.from({ length: 50 }, (_, i) => `Sentence number ${i} has some content here.`)
    const text = sentences.join(' ')
    const chunks = chunkText(text, 200)
    expect(chunks.length).toBeGreaterThan(1)
    // Each chunk should be within limit (with some tolerance for sentence boundaries)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(250) // some tolerance
    }
    // Joined chunks should reconstruct original
    expect(chunks.join(' ')).toBe(text)
  })

  it('should not split mid-sentence', () => {
    const text = 'First sentence. Second sentence. Third sentence.'
    const chunks = chunkText(text, 30)
    for (const chunk of chunks) {
      // Each chunk should end with a period (complete sentence)
      expect(chunk.trimEnd()).toMatch(/\.$/)
    }
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/tts.test.ts`
Expected: FAIL — module `./tts` not found

**Step 3: Write the implementation**

```typescript
// src/lib/tts.ts

export const MODEL_VOICES: Record<string, string> = {
  claude: 'coral',
  gpt: 'nova',
  gemini: 'sage',
  grok: 'ash',
}

export function stripMarkdown(text: string): string {
  return text
    // Remove code block fences (``` with optional language)
    .replace(/```[\w]*\n?/g, '')
    // Remove horizontal rules
    .replace(/^[-*]{3,}$/gm, '')
    // Remove image syntax ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove link syntax [text](url) → text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove heading markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic (order matters: ** before *)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove blockquote markers
    .replace(/^>\s+/gm, '')
    // Remove unordered list markers
    .replace(/^[-*]\s+/gm, '')
    // Remove ordered list markers
    .replace(/^\d+\.\s+/gm, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function chunkText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  // Split into sentences (keep delimiter attached)
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text]

  let current = ''
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLength && current.length > 0) {
      chunks.push(current.trimEnd())
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current.length > 0) {
    chunks.push(current.trimEnd())
  }

  return chunks
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/tts.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/tts.ts src/lib/tts.test.ts
git commit -m "feat: add TTS voice mapping, markdown stripping, and text chunking utils"
```

---

### Task 3: TTS API Route

**Files:**
- Create: `src/app/api/tts/route.ts`
- Create: `src/app/api/tts/route.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/app/api/tts/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the openai module
vi.mock('openai', () => {
  const mockCreate = vi.fn()
  return {
    default: class {
      audio = { speech: { create: mockCreate } }
    },
    __mockCreate: mockCreate,
  }
})

import { POST } from './route'

// Access the mock
const { __mockCreate: mockCreate } = await import('openai') as any

describe('POST /api/tts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CWAI_OPENAI_API_KEY = 'test-key'
  })

  it('should return 400 if text is missing', async () => {
    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('should return 400 if model is missing', async () => {
    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello world' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('should call OpenAI TTS with correct parameters', async () => {
    const mockArrayBuffer = new ArrayBuffer(8)
    const mockResponse = {
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    }
    mockCreate.mockResolvedValue(mockResponse)

    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '**Hello** world', model: 'claude' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'gpt-4o-mini-tts',
      voice: 'coral',
      input: 'Hello world',
      instructions: 'Read naturally in a conversational tone.',
      response_format: 'mp3',
    })
  })

  it('should default to alloy voice for unknown model', async () => {
    const mockResponse = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }
    mockCreate.mockResolvedValue(mockResponse)

    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', model: 'unknown' }),
    })
    await POST(req)

    expect(mockCreate.mock.calls[0][0].voice).toBe('alloy')
  })

  it('should return 500 on OpenAI error', async () => {
    mockCreate.mockRejectedValue(new Error('API error'))

    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', model: 'claude' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/tts/route.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/app/api/tts/route.ts
import OpenAI from 'openai'
import { MODEL_VOICES, stripMarkdown } from '@/lib/tts'

const openai = new OpenAI({ apiKey: process.env.CWAI_OPENAI_API_KEY })

export async function POST(request: Request) {
  const body = await request.json()
  const { text, model } = body

  if (!text || !model) {
    return new Response(JSON.stringify({ error: 'text and model are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const voice = MODEL_VOICES[model] ?? 'alloy'
  const cleanText = stripMarkdown(text)

  try {
    const response = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: cleanText,
      instructions: 'Read naturally in a conversational tone.',
      response_format: 'mp3',
    })

    const buffer = await response.arrayBuffer()

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

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/tts/route.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/app/api/tts/route.ts src/app/api/tts/route.test.ts
git commit -m "feat: add TTS API route proxying to OpenAI gpt-4o-mini-tts"
```

---

### Task 4: useTTS Hook

**Files:**
- Create: `src/hooks/useTTS.ts`
- Create: `src/hooks/useTTS.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/hooks/useTTS.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTTS } from './useTTS'

// Mock HTMLAudioElement
class MockAudio {
  src = ''
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  play = vi.fn(() => Promise.resolve())
  pause = vi.fn()
  static instances: MockAudio[] = []
  constructor() {
    MockAudio.instances.push(this)
  }
}

// Mock fetch
const mockFetch = vi.fn()

beforeEach(() => {
  MockAudio.instances = []
  vi.stubGlobal('Audio', MockAudio)
  vi.stubGlobal('fetch', mockFetch)
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock-url'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useTTS', () => {
  it('should start with idle state', () => {
    const { result } = renderHook(() => useTTS())
    expect(result.current.playingKey).toBeNull()
    expect(result.current.loadingKey).toBeNull()
  })

  it('should set loadingKey when toggle is called', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello world', 'claude')
    })

    // After fetch resolves, should be playing
    expect(result.current.playingKey).toBe('1-claude')
  })

  it('should stop playing when toggle is called again with same key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    // Start playing
    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    // Toggle off
    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    expect(result.current.playingKey).toBeNull()
    expect(MockAudio.instances[0].pause).toHaveBeenCalled()
  })

  it('should switch to new key when different toggle is called while playing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    await act(async () => {
      result.current.toggle('1-gpt', 'World', 'gpt')
    })

    expect(result.current.playingKey).toBe('1-gpt')
    expect(MockAudio.instances[0].pause).toHaveBeenCalled()
  })

  it('should return to idle when audio ends', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    // Simulate audio ending
    await act(async () => {
      MockAudio.instances[0].onended?.()
    })

    expect(result.current.playingKey).toBeNull()
  })

  it('should set errorKey on fetch failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    expect(result.current.errorKey).toBe('1-claude')
    expect(result.current.playingKey).toBeNull()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useTTS.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/hooks/useTTS.ts
'use client'

import { useState, useRef, useCallback } from 'react'

interface TTSState {
  playingKey: string | null
  loadingKey: string | null
  errorKey: string | null
}

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    playingKey: null,
    loadingKey: null,
    errorKey: null,
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setState({ playingKey: null, loadingKey: null, errorKey: null })
  }, [])

  const toggle = useCallback(async (key: string, text: string, model: string) => {
    // If currently playing this key, stop
    if (state.playingKey === key || state.loadingKey === key) {
      stop()
      return
    }

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    setState({ playingKey: null, loadingKey: key, errorKey: null })

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model }),
      })

      if (!response.ok) {
        setState({ playingKey: null, loadingKey: null, errorKey: key })
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        stop()
      }

      audio.onerror = () => {
        setState({ playingKey: null, loadingKey: null, errorKey: key })
      }

      await audio.play()
      setState({ playingKey: key, loadingKey: null, errorKey: null })
    } catch {
      setState({ playingKey: null, loadingKey: null, errorKey: key })
    }
  }, [state.playingKey, state.loadingKey, stop])

  return {
    playingKey: state.playingKey,
    loadingKey: state.loadingKey,
    errorKey: state.errorKey,
    toggle,
    stop,
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useTTS.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/hooks/useTTS.ts src/hooks/useTTS.test.ts
git commit -m "feat: add useTTS hook for audio playback state management"
```

---

### Task 5: SpeakerButton Component

**Files:**
- Create: `src/components/SpeakerButton.tsx`
- Create: `src/components/__tests__/SpeakerButton.test.tsx`

**Step 1: Write the failing tests**

```tsx
// src/components/__tests__/SpeakerButton.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpeakerButton } from '../SpeakerButton'

describe('SpeakerButton', () => {
  it('should render idle state by default', () => {
    render(<SpeakerButton state="idle" onClick={() => {}} />)
    const button = screen.getByRole('button', { name: /play/i })
    expect(button).toBeInTheDocument()
  })

  it('should render loading state', () => {
    render(<SpeakerButton state="loading" onClick={() => {}} />)
    const button = screen.getByRole('button', { name: /loading/i })
    expect(button).toBeInTheDocument()
  })

  it('should render playing state', () => {
    render(<SpeakerButton state="playing" onClick={() => {}} />)
    const button = screen.getByRole('button', { name: /stop/i })
    expect(button).toBeInTheDocument()
  })

  it('should render error state briefly', () => {
    render(<SpeakerButton state="error" onClick={() => {}} />)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('should call onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<SpeakerButton state="idle" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('should not call onClick when loading', async () => {
    const onClick = vi.fn()
    render(<SpeakerButton state="loading" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/SpeakerButton.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```tsx
// src/components/SpeakerButton.tsx
'use client'

export type SpeakerState = 'idle' | 'loading' | 'playing' | 'error'

interface SpeakerButtonProps {
  state: SpeakerState
  onClick: () => void
}

export function SpeakerButton({ state, onClick }: SpeakerButtonProps) {
  const isLoading = state === 'loading'

  const label =
    state === 'playing' ? 'Stop playback' :
    state === 'loading' ? 'Loading audio' :
    'Play audio'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (!isLoading) onClick()
      }}
      disabled={isLoading}
      aria-label={label}
      className={`ml-auto p-1.5 rounded-lg transition-colors cursor-pointer ${
        state === 'playing'
          ? 'text-amber hover:text-amber/80'
          : state === 'error'
            ? 'text-danger'
            : 'text-ink-faint hover:text-ink-muted'
      } ${isLoading ? 'cursor-wait' : ''}`}
    >
      {state === 'loading' ? (
        <span className="w-4 h-4 border-2 border-ink-faint/30 border-t-amber rounded-full animate-spin inline-block" />
      ) : state === 'playing' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
          <line x1="23" y1="9" x2="17" y2="15" opacity="0.3" />
          <line x1="17" y1="9" x2="23" y2="15" opacity="0.3" />
        </svg>
      )}
    </button>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/SpeakerButton.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/SpeakerButton.tsx src/components/__tests__/SpeakerButton.test.tsx
git commit -m "feat: add SpeakerButton component with idle/loading/playing/error states"
```

---

### Task 6: Integrate TTS into Conversation Page

**Files:**
- Modify: `src/app/conversation/page.tsx:1-10` (imports)
- Modify: `src/app/conversation/page.tsx:139-150` (ResponseCard component)

**Step 1: Add imports at top of file**

Add these imports to the existing import block at line 1-5:

```typescript
import { useTTS } from '@/hooks/useTTS'
import { SpeakerButton } from '@/components/SpeakerButton'
```

**Step 2: Add useTTS hook to ConversationContent component**

Inside `ConversationContent()` function (after line 39 `const startedRef = useRef(false)`), add:

```typescript
const tts = useTTS()
```

**Step 3: Add helper function to get speaker state**

After the `getDot` function (after line 137), add:

```typescript
const getSpeakerState = (key: string): 'idle' | 'loading' | 'playing' | 'error' => {
  if (tts.playingKey === key) return 'playing'
  if (tts.loadingKey === key) return 'loading'
  if (tts.errorKey === key) return 'error'
  return 'idle'
}
```

**Step 4: Add SpeakerButton to ResponseCard**

In the `ResponseCard` component's `<summary>` element (line 141-144), add the SpeakerButton after the provider/modelId span:

Current:
```tsx
<summary className="px-5 py-4 cursor-pointer select-none hover:bg-card-hover transition-colors flex items-center gap-3">
  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDot(r.model, r.round)}`} />
  <span className={`font-medium ${getAccent(r.model, r.round)}`}>{r.modelName}</span>
  <span className="text-xs text-ink-faint">{r.provider} / {r.modelId}</span>
</summary>
```

New:
```tsx
<summary className="px-5 py-4 cursor-pointer select-none hover:bg-card-hover transition-colors flex items-center gap-3">
  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDot(r.model, r.round)}`} />
  <span className={`font-medium ${getAccent(r.model, r.round)}`}>{r.modelName}</span>
  <span className="text-xs text-ink-faint">{r.provider} / {r.modelId}</span>
  <SpeakerButton
    state={getSpeakerState(`${r.round}-${r.model}`)}
    onClick={() => tts.toggle(`${r.round}-${r.model}`, r.content, r.model)}
  />
</summary>
```

**Step 5: Verify manually**

Run: `npm run dev`
- Navigate to a completed conversation
- Verify speaker icon appears in each response card header
- Click a speaker, verify it starts loading then playing
- Click again to stop

**Step 6: Commit**

```bash
git add src/app/conversation/page.tsx
git commit -m "feat: integrate TTS speaker button into live conversation page"
```

---

### Task 7: Integrate TTS into Conversation Detail Page

**Files:**
- Modify: `src/app/conversation/[id]/page.tsx:1-7` (imports)
- Modify: `src/app/conversation/[id]/page.tsx:89-99` (round 1 details)
- Modify: `src/app/conversation/[id]/page.tsx:115-125` (round 2 details)

**Step 1: Add imports**

Add to existing imports at top:

```typescript
import { useTTS } from '@/hooks/useTTS'
import { SpeakerButton } from '@/components/SpeakerButton'
```

**Step 2: Add useTTS hook**

Inside `ConversationDetailPage()` (after line 26), add:

```typescript
const tts = useTTS()
```

**Step 3: Add helper function**

After the `getModelConfig` function (after line 53), add:

```typescript
const getSpeakerState = (key: string): 'idle' | 'loading' | 'playing' | 'error' => {
  if (tts.playingKey === key) return 'playing'
  if (tts.loadingKey === key) return 'loading'
  if (tts.errorKey === key) return 'error'
  return 'idle'
}
```

**Step 4: Add SpeakerButton to Round 1 response cards**

In the round 1 `<summary>` (lines 91-94), add after the provider span:

```tsx
<summary className="px-5 py-4 cursor-pointer select-none hover:bg-card-hover transition-colors flex items-center gap-3">
  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
  <span className={`font-medium ${accent}`}>{config.name}</span>
  <span className="text-xs text-ink-faint">{config.provider} / {config.modelId}</span>
  <SpeakerButton
    state={getSpeakerState(`${r.round}-${r.model}`)}
    onClick={() => tts.toggle(`${r.round}-${r.model}`, r.content, r.model)}
  />
</summary>
```

**Step 5: Add SpeakerButton to Round 2 response cards**

In the round 2 `<summary>` (lines 117-120), add after the provider span:

```tsx
<summary className="px-5 py-4 cursor-pointer select-none hover:bg-card-hover transition-colors flex items-center gap-3">
  <span className="w-2 h-2 rounded-full flex-shrink-0 bg-round2" />
  <span className="font-medium text-round2">{config.name}</span>
  <span className="text-xs text-ink-faint">{config.provider} / {config.modelId}</span>
  <SpeakerButton
    state={getSpeakerState(`${r.round}-${r.model}`)}
    onClick={() => tts.toggle(`${r.round}-${r.model}`, r.content, r.model)}
  />
</summary>
```

**Step 6: Verify manually**

Run: `npm run dev`
- Navigate to `/conversation/<id>` for an existing conversation
- Verify speaker icons appear on all response cards
- Test toggle play/stop behavior

**Step 7: Commit**

```bash
git add src/app/conversation/\\[id\\]/page.tsx
git commit -m "feat: integrate TTS speaker button into conversation detail page"
```

---

### Task 8: Run Full Test Suite & Update Docs

**Files:**
- Modify: `docs/architecture.md`
- Modify: `README.md`

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (existing + new)

**Step 2: Update architecture.md**

Add to the component table:
- `useTTS` hook — `src/hooks/useTTS.ts` — Manages TTS playback state
- `SpeakerButton` — `src/components/SpeakerButton.tsx` — Speaker icon with state
- `/api/tts` — `src/app/api/tts/route.ts` — TTS proxy to OpenAI
- `tts utils` — `src/lib/tts.ts` — Voice mapping, markdown stripping, chunking

Add to data flow diagram: TTS flow from SpeakerButton → useTTS → /api/tts → OpenAI.

Add changelog entry.

**Step 3: Update README.md**

Add TTS to features list.

**Step 4: Commit**

```bash
git add docs/architecture.md README.md
git commit -m "docs: add TTS feature to architecture docs and README"
```
