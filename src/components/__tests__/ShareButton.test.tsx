import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareButton } from '../ShareButton'

describe('ShareButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('should render with "Share this conversation" label', () => {
    render(<ShareButton url="https://example.com/conversation/123" />)
    expect(screen.getByText('Share this conversation')).toBeInTheDocument()
  })

  it('should copy URL to clipboard when clicked', async () => {
    render(<ShareButton url="https://example.com/conversation/123" />)
    await userEvent.click(screen.getByRole('button', { name: /share conversation/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/conversation/123')
  })

  it('should show "Link copied!" after clicking', async () => {
    render(<ShareButton url="https://example.com/conversation/123" />)
    await userEvent.click(screen.getByRole('button', { name: /share conversation/i }))
    expect(screen.getByText('Link copied!')).toBeInTheDocument()
  })
})
