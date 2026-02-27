import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => {
    const augmentations = JSON.stringify({
      prediction: { framework: 'scenario analysis', augmentedPrompt: 'pred prompt' },
      opinion: { framework: 'steel man', augmentedPrompt: 'opinion prompt' },
      comparison: { framework: 'strongest case', augmentedPrompt: 'comp prompt' },
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

  it('renders all 5 topic type tags', () => {
    render(<ReviewPage />)
    expect(screen.getByText('prediction')).toBeInTheDocument()
    expect(screen.getByText('opinion')).toBeInTheDocument()
    expect(screen.getByText('comparison')).toBeInTheDocument()
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

  it('renders essay mode toggle defaulting to on', () => {
    render(<ReviewPage />)
    const toggle = screen.getByRole('checkbox', { name: /essay mode/i })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('includes essayMode=true in run URL by default', () => {
    render(<ReviewPage />)
    fireEvent.click(screen.getByText('Run Conversation'))
    expect(hrefSpy).toHaveBeenCalledWith(expect.stringContaining('essayMode=true'))
  })

  it('includes essayMode=false when toggle is off', () => {
    render(<ReviewPage />)
    const toggle = screen.getByRole('checkbox', { name: /essay mode/i })
    fireEvent.click(toggle)
    fireEvent.click(screen.getByText('Run Conversation'))
    expect(hrefSpy).toHaveBeenCalledWith(expect.stringContaining('essayMode=false'))
  })
})
