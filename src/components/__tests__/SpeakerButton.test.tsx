import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpeakerButton } from '../SpeakerButton'

describe('SpeakerButton', () => {
  afterEach(() => {
    cleanup()
  })

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
    const button = screen.getByRole('button', { name: /play/i })
    expect(button).toBeInTheDocument()
  })

  it('should call onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<SpeakerButton state="idle" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('should not call onClick when loading', async () => {
    const onClick = vi.fn()
    render(<SpeakerButton state="loading" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: /loading/i }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
