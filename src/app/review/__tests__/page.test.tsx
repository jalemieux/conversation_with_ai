import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => {
    const augmentations = JSON.stringify({
      prediction: { framework: 'scenario analysis', augmentedPrompt: 'pred prompt' },
      opinion: { framework: 'steel man', augmentedPrompt: 'opinion prompt' },
      trend_analysis: { framework: 'timeline', augmentedPrompt: 'trend prompt' },
      open_question: { framework: 'multiple angles', augmentedPrompt: 'open prompt' },
    })
    return new URLSearchParams({
      rawInput: 'test input',
      recommended: 'prediction',
      augmentations,
      models: 'claude,gpt',
    })
  },
}))

import ReviewPage from '../page'

function getAugmentedPromptTextarea(): HTMLTextAreaElement {
  const textareas = screen.getAllByRole('textbox')
  return textareas[1] as HTMLTextAreaElement
}

describe('ReviewPage', () => {
  let hrefSpy: ReturnType<typeof vi.fn>

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    hrefSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { href: '', assign: vi.fn() },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window.location, 'href', {
      set: hrefSpy,
      configurable: true,
    })
  })

  it('renders all 4 topic type tags', () => {
    render(<ReviewPage />)
    expect(screen.getByText('prediction')).toBeInTheDocument()
    expect(screen.getByText('opinion')).toBeInTheDocument()
    expect(screen.getByText('trend_analysis')).toBeInTheDocument()
    expect(screen.getByText('open_question')).toBeInTheDocument()
  })

  it('shows recommended type augmented prompt by default', () => {
    render(<ReviewPage />)
    expect(getAugmentedPromptTextarea()).toHaveValue('pred prompt')
  })

  it('switches prompt when clicking a different tag', () => {
    render(<ReviewPage />)
    fireEvent.click(screen.getByText('opinion'))
    expect(getAugmentedPromptTextarea()).toHaveValue('opinion prompt')
  })

  it('shows framework badge matching selected type', () => {
    render(<ReviewPage />)
    expect(screen.getAllByText('scenario analysis').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('opinion'))
    expect(screen.getAllByText('steel man').length).toBeGreaterThan(0)
  })

  it('renders essay mode toggle defaulting to off', () => {
    render(<ReviewPage />)
    const toggle = screen.getByRole('checkbox', { name: /essay mode/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('includes essayMode=false in run URL by default', () => {
    render(<ReviewPage />)
    fireEvent.click(screen.getByText('Run Conversation'))
    expect(hrefSpy).toHaveBeenCalledWith(expect.stringContaining('essayMode=false'))
  })

  it('includes essayMode=true when toggle is on', () => {
    render(<ReviewPage />)
    const toggle = screen.getByRole('checkbox', { name: /essay mode/i })
    fireEvent.click(toggle)
    fireEvent.click(screen.getByText('Run Conversation'))
    expect(hrefSpy).toHaveBeenCalledWith(expect.stringContaining('essayMode=true'))
  })

  it('renders model cards as clickable toggles without +/- buttons', () => {
    render(<ReviewPage />)
    // Model names should be visible
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('GPT')).toBeInTheDocument()
    // No +/- buttons should exist
    expect(screen.queryByLabelText(/increase/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/decrease/i)).not.toBeInTheDocument()
  })

  it('all models selected by default, sends instance keys in model:0 format', () => {
    render(<ReviewPage />)
    fireEvent.click(screen.getByText('Run Conversation'))
    const url = hrefSpy.mock.calls[0]?.[0] as string
    const params = new URLSearchParams(url.split('?')[1])
    const models = params.get('models')?.split(',') ?? []
    expect(models).toContain('claude:0')
    expect(models).toContain('gpt:0')
    expect(models).toContain('gemini:0')
    expect(models).toContain('grok:0')
  })

  it('clicking a model card toggles it off and excludes from URL', () => {
    render(<ReviewPage />)
    // Click Claude card to deselect it
    const claudeCard = screen.getByTestId('model-card-claude')
    fireEvent.click(claudeCard)

    fireEvent.click(screen.getByText('Run Conversation'))
    const url = hrefSpy.mock.calls[0]?.[0] as string
    const params = new URLSearchParams(url.split('?')[1])
    const models = params.get('models')?.split(',') ?? []
    expect(models.filter(m => m.startsWith('claude:'))).toHaveLength(0)
    expect(models).toContain('gpt:0')
  })

  it('clicking a deselected model card toggles it back on', () => {
    render(<ReviewPage />)
    const claudeCard = screen.getByTestId('model-card-claude')
    // Toggle off then on
    fireEvent.click(claudeCard)
    fireEvent.click(claudeCard)

    fireEvent.click(screen.getByText('Run Conversation'))
    const url = hrefSpy.mock.calls[0]?.[0] as string
    const params = new URLSearchParams(url.split('?')[1])
    const models = params.get('models')?.split(',') ?? []
    expect(models).toContain('claude:0')
  })

  it('disables Run when all models are deselected', () => {
    render(<ReviewPage />)
    for (const key of ['claude', 'gpt', 'gemini', 'grok']) {
      fireEvent.click(screen.getByTestId(`model-card-${key}`))
    }
    expect(screen.getByText('Run Conversation')).toBeDisabled()
  })

  it('does not show total response count', () => {
    render(<ReviewPage />)
    expect(screen.queryByText(/responses total/i)).not.toBeInTheDocument()
  })

  it('deduplicates models when API returns duplicate providers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      json: async () => ({
        subscriptionStatus: 'inactive',
        providers: ['openai', 'google', 'openai', 'google'],
      }),
    } as Response)

    render(<ReviewPage />)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/user')
    })

    // After fetch resolves, run the conversation and check the models param
    await waitFor(() => {
      fireEvent.click(screen.getByText('Run Conversation'))
      const url = hrefSpy.mock.calls[0]?.[0] as string
      const params = new URLSearchParams(url.split('?')[1])
      const models = params.get('models')?.split(',') ?? []
      // Should have no duplicates — gpt:0 and gemini:0 only
      expect(models).toEqual([...new Set(models)])
    })

    fetchSpy.mockRestore()
  })
})
