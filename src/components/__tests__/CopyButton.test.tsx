import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyButton } from '../CopyButton'

describe('CopyButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('should render with copy label', () => {
    render(<CopyButton content="test" />)
    const button = screen.getByRole('button', { name: /copy response/i })
    expect(button).toBeInTheDocument()
  })

  it('should copy content to clipboard when clicked', async () => {
    render(<CopyButton content="Hello world" />)
    await userEvent.click(screen.getByRole('button', { name: /copy response/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello world')
  })

  it('should show copied state after clicking', async () => {
    render(<CopyButton content="test" />)
    await userEvent.click(screen.getByRole('button', { name: /copy response/i }))
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
  })
})
