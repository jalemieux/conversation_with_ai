# TTS Audio Caching + Inline Mini-Player Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cache generated TTS audio to disk and add an inline mini-player with seek/skip controls.

**Architecture:** Server-side file cache at `data/audio/{conversationId}/{round}-{model}.mp3`. The API route checks for cached files before calling OpenAI. The frontend gets a new `AudioPlayer` component that appears inline in response cards, with play/pause, -10s/+10s skip, seekable progress bar, and time display. The `useTTS` hook is extended with progress tracking and seek methods.

**Tech Stack:** Next.js API routes, Node.js `fs/promises`, React hooks, HTMLAudioElement API

---

### Task 1: Add server-side audio caching to TTS API route

**Files:**
- Modify: `src/app/api/tts/route.ts`
- Test: `src/app/api/tts/route.test.ts`

**Step 1: Write the failing tests for cache behavior**

Add these tests to `src/app/api/tts/route.test.ts`:

```typescript
// Add at top of file, after existing mocks:
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}))

import { readFile, writeFile, mkdir } from 'fs/promises'
const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)
const mockMkdir = vi.mocked(mkdir)
```

Add these test cases:

```typescript
it('should return cached audio when file exists', async () => {
  const cachedBuffer = Buffer.from('cached-audio-data')
  mockReadFile.mockResolvedValue(cachedBuffer)

  const req = new Request('http://localhost/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hello', model: 'claude', conversationId: 'conv-123', round: 1 }),
  })
  const res = await POST(req)

  expect(res.status).toBe(200)
  expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
  expect(mockCreate).not.toHaveBeenCalled()
})

it('should save audio to disk on cache miss', async () => {
  mockReadFile.mockRejectedValue(new Error('ENOENT'))
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
  const mockArrayBuffer = new ArrayBuffer(8)
  mockCreate.mockResolvedValue({
    arrayBuffer: () => Promise.resolve(mockArrayBuffer),
  })

  const req = new Request('http://localhost/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hello', model: 'claude', conversationId: 'conv-123', round: 1 }),
  })
  const res = await POST(req)

  expect(res.status).toBe(200)
  expect(mockCreate).toHaveBeenCalled()
  expect(mockMkdir).toHaveBeenCalled()
  expect(mockWriteFile).toHaveBeenCalled()
})

it('should still work without conversationId (no caching)', async () => {
  const mockArrayBuffer = new ArrayBuffer(8)
  mockCreate.mockResolvedValue({
    arrayBuffer: () => Promise.resolve(mockArrayBuffer),
  })

  const req = new Request('http://localhost/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hello', model: 'claude' }),
  })
  const res = await POST(req)

  expect(res.status).toBe(200)
  expect(mockReadFile).not.toHaveBeenCalled()
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/tts/route.test.ts`
Expected: FAIL — new tests fail because caching logic doesn't exist yet

**Step 3: Implement caching in the API route**

Replace `src/app/api/tts/route.ts` with:

```typescript
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import OpenAI from 'openai'
import { MODEL_VOICES, stripMarkdown } from '@/lib/tts'

const openai = new OpenAI({ apiKey: process.env.CWAI_OPENAI_API_KEY })

function getCachePath(conversationId: string, round: number, model: string): string {
  return join(process.cwd(), 'data', 'audio', conversationId, `${round}-${model}.mp3`)
}

async function readCached(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path)
  } catch {
    return null
  }
}

async function writeCache(path: string, data: Buffer): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { text, model, conversationId, round } = body

  if (!text || !model) {
    return new Response(JSON.stringify({ error: 'text and model are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Try cache first
  if (conversationId && round) {
    const cachePath = getCachePath(conversationId, round, model)
    const cached = await readCached(cachePath)
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': cached.byteLength.toString(),
        },
      })
    }
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

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Cache to disk if we have conversation context
    if (conversationId && round) {
      const cachePath = getCachePath(conversationId, round, model)
      writeCache(cachePath, buffer).catch(() => {}) // fire and forget
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

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/tts/route.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/app/api/tts/route.ts src/app/api/tts/route.test.ts
git commit -m "feat(tts): add server-side audio file caching"
```

---

### Task 2: Extend useTTS hook with progress tracking and seek controls

**Files:**
- Modify: `src/hooks/useTTS.ts`
- Test: `src/hooks/useTTS.test.ts`

**Step 1: Write failing tests for new hook capabilities**

Add these tests to `src/hooks/useTTS.test.ts`:

```typescript
it('should pass conversationId and round in fetch body', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
  })

  const { result } = renderHook(() => useTTS())

  await act(async () => {
    result.current.toggle('1-claude', 'Hello', 'claude', 'conv-123', 1)
  })

  expect(mockFetch).toHaveBeenCalledWith('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hello', model: 'claude', conversationId: 'conv-123', round: 1 }),
  })
})

it('should expose currentTime and duration', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
  })

  const { result } = renderHook(() => useTTS())

  await act(async () => {
    result.current.toggle('1-claude', 'Hello', 'claude', 'conv-123', 1)
  })

  expect(result.current.currentTime).toBe(0)
  expect(result.current.duration).toBe(0)
})

it('should seek forward by 10 seconds', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
  })

  const { result } = renderHook(() => useTTS())

  await act(async () => {
    result.current.toggle('1-claude', 'Hello', 'claude', 'conv-123', 1)
  })

  // Mock audio element properties
  const audio = MockAudio.instances[0] as any
  audio.currentTime = 5
  audio.duration = 60

  act(() => {
    result.current.skipForward()
  })

  expect(audio.currentTime).toBe(15)
})

it('should seek backward by 10 seconds', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
  })

  const { result } = renderHook(() => useTTS())

  await act(async () => {
    result.current.toggle('1-claude', 'Hello', 'claude', 'conv-123', 1)
  })

  const audio = MockAudio.instances[0] as any
  audio.currentTime = 25
  audio.duration = 60

  act(() => {
    result.current.skipBack()
  })

  expect(audio.currentTime).toBe(15)
})

it('should clamp skipBack to 0', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
  })

  const { result } = renderHook(() => useTTS())

  await act(async () => {
    result.current.toggle('1-claude', 'Hello', 'claude', 'conv-123', 1)
  })

  const audio = MockAudio.instances[0] as any
  audio.currentTime = 3
  audio.duration = 60

  act(() => {
    result.current.skipBack()
  })

  expect(audio.currentTime).toBe(0)
})

it('should allow seeking to a specific time', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
  })

  const { result } = renderHook(() => useTTS())

  await act(async () => {
    result.current.toggle('1-claude', 'Hello', 'claude', 'conv-123', 1)
  })

  const audio = MockAudio.instances[0] as any
  audio.duration = 60

  act(() => {
    result.current.seek(30)
  })

  expect(audio.currentTime).toBe(30)
})

it('should pause without resetting when pauseToggle is called while playing', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
  })

  const { result } = renderHook(() => useTTS())

  await act(async () => {
    result.current.toggle('1-claude', 'Hello', 'claude', 'conv-123', 1)
  })

  expect(result.current.playingKey).toBe('1-claude')

  act(() => {
    result.current.pauseToggle()
  })

  // Should be paused but not fully stopped (pausedKey set)
  expect(result.current.playingKey).toBeNull()
  expect(result.current.pausedKey).toBe('1-claude')

  // Resume
  act(() => {
    result.current.pauseToggle()
  })

  expect(result.current.playingKey).toBe('1-claude')
  expect(result.current.pausedKey).toBeNull()
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useTTS.test.ts`
Expected: FAIL

**Step 3: Implement extended hook**

Replace `src/hooks/useTTS.ts` with:

```typescript
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface TTSState {
  playingKey: string | null
  loadingKey: string | null
  errorKey: string | null
  pausedKey: string | null
  currentTime: number
  duration: number
}

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    playingKey: null,
    loadingKey: null,
    errorKey: null,
    pausedKey: null,
    currentTime: 0,
    duration: 0,
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const animFrameRef = useRef<number | null>(null)

  const stopProgressLoop = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }, [])

  const startProgressLoop = useCallback(() => {
    const tick = () => {
      if (audioRef.current) {
        setState((prev) => ({
          ...prev,
          currentTime: audioRef.current?.currentTime ?? 0,
          duration: audioRef.current?.duration ?? 0,
        }))
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    return () => stopProgressLoop()
  }, [stopProgressLoop])

  const stop = useCallback(() => {
    stopProgressLoop()
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
    setState({ playingKey: null, loadingKey: null, errorKey: null, pausedKey: null, currentTime: 0, duration: 0 })
  }, [stopProgressLoop])

  const toggle = useCallback(async (
    key: string,
    text: string,
    model: string,
    conversationId?: string,
    round?: number,
  ) => {
    // If currently playing or loading this key, stop
    if (state.playingKey === key || state.loadingKey === key) {
      stop()
      return
    }

    // If this key is paused, resume it
    if (state.pausedKey === key && audioRef.current) {
      await audioRef.current.play()
      startProgressLoop()
      setState((prev) => ({ ...prev, playingKey: key, pausedKey: null }))
      return
    }

    // Stop any current playback
    stopProgressLoop()
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

    setState({ playingKey: null, loadingKey: key, errorKey: null, pausedKey: null, currentTime: 0, duration: 0 })

    try {
      const body: Record<string, unknown> = { text, model }
      if (conversationId) body.conversationId = conversationId
      if (round) body.round = round

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        setState({ playingKey: null, loadingKey: null, errorKey: key, pausedKey: null, currentTime: 0, duration: 0 })
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        stopProgressLoop()
        setState((prev) => ({
          ...prev,
          playingKey: null,
          pausedKey: prev.playingKey,
          currentTime: prev.duration,
        }))
      }

      audio.onerror = () => {
        setState({ playingKey: null, loadingKey: null, errorKey: key, pausedKey: null, currentTime: 0, duration: 0 })
      }

      await audio.play()
      startProgressLoop()
      setState({ playingKey: key, loadingKey: null, errorKey: null, pausedKey: null, currentTime: 0, duration: 0 })
    } catch {
      setState({ playingKey: null, loadingKey: null, errorKey: key, pausedKey: null, currentTime: 0, duration: 0 })
    }
  }, [state.playingKey, state.loadingKey, state.pausedKey, stop, stopProgressLoop, startProgressLoop])

  const pauseToggle = useCallback(() => {
    if (!audioRef.current) return
    if (state.playingKey) {
      audioRef.current.pause()
      stopProgressLoop()
      setState((prev) => ({ ...prev, playingKey: null, pausedKey: prev.playingKey }))
    } else if (state.pausedKey) {
      audioRef.current.play()
      startProgressLoop()
      setState((prev) => ({ ...prev, playingKey: prev.pausedKey, pausedKey: null }))
    }
  }, [state.playingKey, state.pausedKey, stopProgressLoop, startProgressLoop])

  const skipForward = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, audioRef.current.duration || 0)
  }, [])

  const skipBack = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0)
  }, [])

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = time
  }, [])

  return {
    playingKey: state.playingKey,
    loadingKey: state.loadingKey,
    errorKey: state.errorKey,
    pausedKey: state.pausedKey,
    currentTime: state.currentTime,
    duration: state.duration,
    toggle,
    stop,
    pauseToggle,
    skipForward,
    skipBack,
    seek,
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useTTS.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/hooks/useTTS.ts src/hooks/useTTS.test.ts
git commit -m "feat(tts): extend useTTS hook with seek, skip, pause, and progress tracking"
```

---

### Task 3: Create AudioPlayer component

**Files:**
- Create: `src/components/AudioPlayer.tsx`
- Create: `src/components/__tests__/AudioPlayer.test.tsx`

**Step 1: Write failing tests**

Create `src/components/__tests__/AudioPlayer.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AudioPlayer } from '../AudioPlayer'

describe('AudioPlayer', () => {
  afterEach(() => cleanup())

  it('should render play/pause, skip buttons, and time display', () => {
    render(
      <AudioPlayer
        isPlaying={true}
        currentTime={83}
        duration={225}
        onPauseToggle={() => {}}
        onSkipBack={() => {}}
        onSkipForward={() => {}}
        onSeek={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /forward/i })).toBeInTheDocument()
    expect(screen.getByText('1:23')).toBeInTheDocument()
    expect(screen.getByText('3:45')).toBeInTheDocument()
  })

  it('should show play icon when paused', () => {
    render(
      <AudioPlayer
        isPlaying={false}
        currentTime={10}
        duration={60}
        onPauseToggle={() => {}}
        onSkipBack={() => {}}
        onSkipForward={() => {}}
        onSeek={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
  })

  it('should call onPauseToggle when play/pause clicked', async () => {
    const onPauseToggle = vi.fn()
    render(
      <AudioPlayer
        isPlaying={true}
        currentTime={0}
        duration={60}
        onPauseToggle={onPauseToggle}
        onSkipBack={() => {}}
        onSkipForward={() => {}}
        onSeek={() => {}}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(onPauseToggle).toHaveBeenCalledOnce()
  })

  it('should call onSkipBack when -10s clicked', async () => {
    const onSkipBack = vi.fn()
    render(
      <AudioPlayer
        isPlaying={true}
        currentTime={30}
        duration={60}
        onPauseToggle={() => {}}
        onSkipBack={onSkipBack}
        onSkipForward={() => {}}
        onSeek={() => {}}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onSkipBack).toHaveBeenCalledOnce()
  })

  it('should call onSkipForward when +10s clicked', async () => {
    const onSkipForward = vi.fn()
    render(
      <AudioPlayer
        isPlaying={true}
        currentTime={30}
        duration={60}
        onPauseToggle={() => {}}
        onSkipBack={() => {}}
        onSkipForward={onSkipForward}
        onSeek={() => {}}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /forward/i }))
    expect(onSkipForward).toHaveBeenCalledOnce()
  })

  it('should format time correctly for values under 1 minute', () => {
    render(
      <AudioPlayer
        isPlaying={true}
        currentTime={5}
        duration={45}
        onPauseToggle={() => {}}
        onSkipBack={() => {}}
        onSkipForward={() => {}}
        onSeek={() => {}}
      />
    )

    expect(screen.getByText('0:05')).toBeInTheDocument()
    expect(screen.getByText('0:45')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/AudioPlayer.test.tsx`
Expected: FAIL — AudioPlayer doesn't exist

**Step 3: Implement AudioPlayer component**

Create `src/components/AudioPlayer.tsx`:

```tsx
'use client'

interface AudioPlayerProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  onPauseToggle: () => void
  onSkipBack: () => void
  onSkipForward: () => void
  onSeek: (time: number) => void
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AudioPlayer({
  isPlaying,
  currentTime,
  duration,
  onPauseToggle,
  onSkipBack,
  onSkipForward,
  onSeek,
}: AudioPlayerProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = (e.clientX - rect.left) / rect.width
    onSeek(fraction * duration)
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 bg-cream-dark rounded-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Skip Back */}
      <button
        type="button"
        aria-label="Skip back 10 seconds"
        onClick={onSkipBack}
        className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 17l-5-5 5-5" />
          <path d="M18 17l-5-5 5-5" />
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={onPauseToggle}
        className="p-1 text-amber hover:text-amber/80 transition-colors cursor-pointer"
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      {/* Skip Forward */}
      <button
        type="button"
        aria-label="Skip forward 10 seconds"
        onClick={onSkipForward}
        className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 17l5-5-5-5" />
          <path d="M6 17l5-5-5-5" />
        </svg>
      </button>

      {/* Progress bar */}
      <div
        className="flex-1 h-1.5 bg-border rounded-full cursor-pointer relative group"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-amber rounded-full transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-amber rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%`, marginLeft: '-6px' }}
        />
      </div>

      {/* Time display */}
      <span className="text-xs text-ink-faint tabular-nums whitespace-nowrap">
        {formatTime(currentTime)}
      </span>
      <span className="text-xs text-ink-faint">/</span>
      <span className="text-xs text-ink-faint tabular-nums whitespace-nowrap">
        {formatTime(duration)}
      </span>
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/AudioPlayer.test.tsx`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/AudioPlayer.tsx src/components/__tests__/AudioPlayer.test.tsx
git commit -m "feat(tts): add AudioPlayer inline mini-player component"
```

---

### Task 4: Update SpeakerButton with cached indicator

**Files:**
- Modify: `src/components/SpeakerButton.tsx`
- Modify: `src/components/__tests__/SpeakerButton.test.tsx`

**Step 1: Write failing test**

Add to `src/components/__tests__/SpeakerButton.test.tsx`:

```tsx
it('should show cached indicator when cached prop is true', () => {
  render(<SpeakerButton state="idle" onClick={() => {}} cached={true} />)
  const indicator = screen.getByTestId('cached-indicator')
  expect(indicator).toBeInTheDocument()
})

it('should not show cached indicator by default', () => {
  render(<SpeakerButton state="idle" onClick={() => {}} />)
  expect(screen.queryByTestId('cached-indicator')).not.toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/SpeakerButton.test.tsx`
Expected: FAIL

**Step 3: Add cached prop to SpeakerButton**

Update `src/components/SpeakerButton.tsx` — add `cached?: boolean` to `SpeakerButtonProps` and render a small dot when `cached` is true:

In the `SpeakerButton` component, add after the button's existing content (inside the button, at the end):

```tsx
{cached && state === 'idle' && (
  <span
    data-testid="cached-indicator"
    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full"
  />
)}
```

And make the button `relative`:

```tsx
className={`relative p-1.5 rounded-lg ...`}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/SpeakerButton.test.tsx`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/components/SpeakerButton.tsx src/components/__tests__/SpeakerButton.test.tsx
git commit -m "feat(tts): add cached indicator to SpeakerButton"
```

---

### Task 5: Integrate AudioPlayer into conversation pages

**Files:**
- Modify: `src/app/conversation/page.tsx`
- Modify: `src/app/conversation/[id]/page.tsx`

**Step 1: Update the live conversation page**

In `src/app/conversation/page.tsx`:

1. Import AudioPlayer: `import { AudioPlayer } from '@/components/AudioPlayer'`

2. Update the `toggle` call in `ResponseCard` to pass `conversationId` and `r.round`:
```tsx
onClick={() => tts.toggle(`${r.round}-${r.model}`, r.content, r.model, conversationId ?? undefined, r.round)}
```

3. Add a helper to determine if a response has an active player:
```tsx
const hasPlayer = (key: string) =>
  tts.playingKey === key || tts.pausedKey === key
```

4. Inside `ResponseCard`, after the `<summary>` and before `MarkdownContent`, render the player conditionally:
```tsx
{hasPlayer(`${r.round}-${r.model}`) && (
  <div className="px-5 pt-3">
    <AudioPlayer
      isPlaying={tts.playingKey === `${r.round}-${r.model}`}
      currentTime={tts.currentTime}
      duration={tts.duration}
      onPauseToggle={tts.pauseToggle}
      onSkipBack={tts.skipBack}
      onSkipForward={tts.skipForward}
      onSeek={tts.seek}
    />
  </div>
)}
```

**Step 2: Update the conversation detail page**

Apply identical changes in `src/app/conversation/[id]/page.tsx`:

1. Import `AudioPlayer`
2. Add `hasPlayer` helper
3. Pass `conversation.id` and `r.round` to `tts.toggle`
4. Render `AudioPlayer` inline in each response card

**Step 3: Run the dev server and manually test**

Run: `npm run dev`
Test:
- Click speaker button → should show loading, then AudioPlayer appears
- Click -10s/+10s → audio seeks
- Click pause → pauses, play resumes
- Progress bar updates in real time
- Click speaker again on different response → first stops, new one starts
- Navigate to saved conversation → click same speaker → should serve cached (fast, no loading delay)

**Step 4: Commit**

```bash
git add src/app/conversation/page.tsx src/app/conversation/[id]/page.tsx
git commit -m "feat(tts): integrate AudioPlayer into conversation pages"
```

---

### Task 6: Update existing tests for new toggle signature

**Files:**
- Modify: `src/hooks/useTTS.test.ts`

**Step 1: Update existing tests that call toggle with old signature**

The existing tests call `toggle('1-claude', 'Hello', 'claude')` — these should still work since `conversationId` and `round` are optional. Verify no tests break.

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 3: Commit if any adjustments were needed**

```bash
git add -u
git commit -m "test: update tests for new useTTS toggle signature"
```

---

### Task 7: Update documentation

**Files:**
- Modify: `docs/architecture.md`
- Modify: `README.md`

**Step 1: Update architecture.md**

Add to the TTS section:
- Audio caching: files stored at `data/audio/{conversationId}/{round}-{model}.mp3`
- New `AudioPlayer` component with seek/skip/progress controls
- Cache-first flow in API route

**Step 2: Update README.md**

Add to features list:
- TTS audio caching (no re-generation on replay)
- Inline audio player with rewind/forward controls

**Step 3: Commit**

```bash
git add docs/architecture.md README.md
git commit -m "docs: update architecture and README for TTS caching and player"
```
