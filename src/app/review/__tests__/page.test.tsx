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

  it('defaults each model count to 1 and sends instance keys', () => {
    render(<ReviewPage />)
    // All 4 models should default to count 1
    for (const key of ['claude', 'gpt', 'gemini', 'grok']) {
      expect(screen.getByTestId(`count-${key}`)).toHaveTextContent('1')
    }
    fireEvent.click(screen.getByText('Run Conversation'))
    const url = hrefSpy.mock.calls[0]?.[0] as string
    const params = new URLSearchParams(url.split('?')[1])
    const models = params.get('models')?.split(',') ?? []
    expect(models).toContain('claude:0')
    expect(models).toContain('gpt:0')
    expect(models).toContain('gemini:0')
    expect(models).toContain('grok:0')
  })

  it('increases model count and generates multiple instance keys', () => {
    render(<ReviewPage />)
    // Click + for GPT twice to get count to 3
    const increaseGpt = screen.getByLabelText('Increase GPT count')
    fireEvent.click(increaseGpt)
    fireEvent.click(increaseGpt)
    expect(screen.getByTestId('count-gpt')).toHaveTextContent('3')

    fireEvent.click(screen.getByText('Run Conversation'))
    const url = hrefSpy.mock.calls[0]?.[0] as string
    const params = new URLSearchParams(url.split('?')[1])
    const models = params.get('models')?.split(',') ?? []
    expect(models.filter(m => m.startsWith('gpt:'))).toHaveLength(3)
    expect(models).toContain('gpt:0')
    expect(models).toContain('gpt:1')
    expect(models).toContain('gpt:2')
  })

  it('decreases model count to 0 and excludes from URL', () => {
    render(<ReviewPage />)
    const decreaseClaude = screen.getByLabelText('Decrease Claude count')
    fireEvent.click(decreaseClaude)
    expect(screen.getByTestId('count-claude')).toHaveTextContent('0')

    fireEvent.click(screen.getByText('Run Conversation'))
    const url = hrefSpy.mock.calls[0]?.[0] as string
    const params = new URLSearchParams(url.split('?')[1])
    const models = params.get('models')?.split(',') ?? []
    expect(models.filter(m => m.startsWith('claude:'))).toHaveLength(0)
  })

  it('disables Run when all counts are 0', () => {
    render(<ReviewPage />)
    // Set all to 0
    for (const name of ['Claude', 'GPT', 'Gemini', 'Grok']) {
      fireEvent.click(screen.getByLabelText(`Decrease ${name} count`))
    }
    expect(screen.getByText('Run Conversation')).toBeDisabled()
  })

  it('shows total response count', () => {
    render(<ReviewPage />)
    // Default: 4 models × 1 = 4 total
    expect(screen.getByText('4 responses total')).toBeInTheDocument()
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
