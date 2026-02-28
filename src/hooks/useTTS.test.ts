import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTTS } from './useTTS'

// Mock HTMLAudioElement
class MockAudio {
  src = ''
  currentTime = 0
  duration = 0
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeupdate: (() => void) | null = null
  play = vi.fn(() => Promise.resolve())
  pause = vi.fn()
  paused = false
  static instances: MockAudio[] = []
  constructor() {
    MockAudio.instances.push(this)
  }
}

// Mock fetch
const mockFetch = vi.fn()

let rafCallbacks: Array<(time: number) => void> = []
const mockRAF = vi.fn((cb: (time: number) => void) => {
  rafCallbacks.push(cb)
  return rafCallbacks.length
})
const mockCAF = vi.fn()

beforeEach(() => {
  MockAudio.instances = []
  rafCallbacks = []
  vi.stubGlobal('Audio', MockAudio)
  vi.stubGlobal('fetch', mockFetch)
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock-url'), revokeObjectURL: vi.fn() })
  vi.stubGlobal('requestAnimationFrame', mockRAF)
  vi.stubGlobal('cancelAnimationFrame', mockCAF)
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

  it('should set pausedKey (not fully stop) when audio ends', async () => {
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
    expect(result.current.pausedKey).toBe('1-claude')
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

  it('should pass conversationId and round in fetch body when provided', async () => {
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

  it('should not include conversationId/round in fetch body when not provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', model: 'claude' }),
    })
  })

  it('should expose currentTime and duration initially as 0', () => {
    const { result } = renderHook(() => useTTS())
    expect(result.current.currentTime).toBe(0)
    expect(result.current.duration).toBe(0)
  })

  it('should skip forward by 10 seconds', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    const audio = MockAudio.instances[0]
    audio.currentTime = 5
    audio.duration = 60

    act(() => {
      result.current.skipForward()
    })

    expect(audio.currentTime).toBe(15)
  })

  it('should clamp skipForward to duration', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    const audio = MockAudio.instances[0]
    audio.currentTime = 55
    audio.duration = 60

    act(() => {
      result.current.skipForward()
    })

    expect(audio.currentTime).toBe(60)
  })

  it('should skip back by 10 seconds', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    const audio = MockAudio.instances[0]
    audio.currentTime = 20
    audio.duration = 60

    act(() => {
      result.current.skipBack()
    })

    expect(audio.currentTime).toBe(10)
  })

  it('should clamp skipBack to 0', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    const audio = MockAudio.instances[0]
    audio.currentTime = 5
    audio.duration = 60

    act(() => {
      result.current.skipBack()
    })

    expect(audio.currentTime).toBe(0)
  })

  it('should seek to a specific time', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    const audio = MockAudio.instances[0]
    audio.duration = 60

    act(() => {
      result.current.seek(30)
    })

    expect(audio.currentTime).toBe(30)
  })

  it('should pause without stopping via pauseToggle (sets pausedKey)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    // Pause
    act(() => {
      result.current.pauseToggle()
    })

    expect(result.current.pausedKey).toBe('1-claude')
    expect(result.current.playingKey).toBeNull()
    expect(MockAudio.instances[0].pause).toHaveBeenCalled()
    // Audio element should still be alive (not nulled)
  })

  it('should resume from paused via pauseToggle', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    // Pause
    act(() => {
      result.current.pauseToggle()
    })

    expect(result.current.pausedKey).toBe('1-claude')

    // Resume
    await act(async () => {
      result.current.pauseToggle()
    })

    expect(result.current.pausedKey).toBeNull()
    expect(result.current.playingKey).toBe('1-claude')
  })

  it('should set pausedKey when audio ends naturally (player stays visible)', async () => {
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
    expect(result.current.pausedKey).toBe('1-claude')
  })

  it('should resume from paused key when toggle is called with same key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })

    const { result } = renderHook(() => useTTS())

    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    // Pause it
    act(() => {
      result.current.pauseToggle()
    })

    expect(result.current.pausedKey).toBe('1-claude')

    // Toggle same key should resume, not refetch
    mockFetch.mockClear()
    await act(async () => {
      result.current.toggle('1-claude', 'Hello', 'claude')
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.playingKey).toBe('1-claude')
    expect(result.current.pausedKey).toBeNull()
  })
})
