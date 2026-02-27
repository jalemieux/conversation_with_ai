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
