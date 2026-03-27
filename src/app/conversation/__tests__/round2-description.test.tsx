import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// Mock next/navigation before importing components
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'test-id' }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock useTTS hook
vi.mock('@/hooks/useTTS', () => ({
  useTTS: () => ({
    playingKey: null,
    pausedKey: null,
    loadingKey: null,
    errorKey: null,
    currentTime: 0,
    duration: 0,
    toggle: vi.fn(),
    pauseToggle: vi.fn(),
    skipBack: vi.fn(),
    skipForward: vi.fn(),
    seek: vi.fn(),
    stop: vi.fn(),
  }),
}))

// Mock analytics
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

import ConversationDetailPage from '../[id]/page'

const makeConversation = (overrides = {}) => ({
  id: 'test-id',
  createdAt: '2026-01-01',
  rawInput: 'test question',
  augmentedPrompt: 'test augmented prompt',
  topicType: 'debate',
  framework: 'socratic',
  models: ['claude', 'gpt'],
  responses: [],
  isOwner: true,
  ...overrides,
})

describe('Round 2 description text', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows Round 2 subtitle when round 2 responses exist', async () => {
    const conv = makeConversation({
      responses: [
        { id: '1', round: 1, model: 'claude', content: 'Round 1 answer' },
        { id: '2', round: 2, model: 'claude', content: 'Round 2 reaction' },
      ],
    })

    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(conv),
    })

    render(<ConversationDetailPage />)

    expect(await screen.findByText('Each model reacts to what the others said')).toBeInTheDocument()
  })

  it('does not show Round 2 subtitle when no round 2 responses', async () => {
    const conv = makeConversation({
      responses: [
        { id: '1', round: 1, model: 'claude', content: 'Round 1 answer' },
      ],
    })

    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(conv),
    })

    render(<ConversationDetailPage />)

    // Wait for the page to load by checking for the topic
    await screen.findByText('test augmented prompt')

    expect(screen.queryByText('Each model reacts to what the others said')).not.toBeInTheDocument()
  })
})
