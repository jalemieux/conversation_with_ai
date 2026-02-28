import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AudioPlayer, formatTime } from '../AudioPlayer'

describe('AudioPlayer', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    isPlaying: false,
    currentTime: 0,
    duration: 120,
    onPauseToggle: vi.fn(),
    onSkipBack: vi.fn(),
    onSkipForward: vi.fn(),
    onSeek: vi.fn(),
  }

  it('renders all controls', () => {
    render(<AudioPlayer {...defaultProps} />)
    expect(screen.getByLabelText('Skip back 10 seconds')).toBeInTheDocument()
    expect(screen.getByLabelText('Play')).toBeInTheDocument()
    expect(screen.getByLabelText('Skip forward 10 seconds')).toBeInTheDocument()
    expect(screen.getByText('0:00 / 2:00')).toBeInTheDocument()
  })

  it('shows pause icon when isPlaying is true', () => {
    render(<AudioPlayer {...defaultProps} isPlaying={true} />)
    expect(screen.getByLabelText('Pause')).toBeInTheDocument()
    expect(screen.queryByLabelText('Play')).not.toBeInTheDocument()
  })

  it('shows play icon when isPlaying is false', () => {
    render(<AudioPlayer {...defaultProps} isPlaying={false} />)
    expect(screen.getByLabelText('Play')).toBeInTheDocument()
    expect(screen.queryByLabelText('Pause')).not.toBeInTheDocument()
  })

  it('calls onPauseToggle on play/pause click', async () => {
    const onPauseToggle = vi.fn()
    render(<AudioPlayer {...defaultProps} onPauseToggle={onPauseToggle} />)
    await userEvent.click(screen.getByLabelText('Play'))
    expect(onPauseToggle).toHaveBeenCalledOnce()
  })

  it('calls onSkipBack on back button click', async () => {
    const onSkipBack = vi.fn()
    render(<AudioPlayer {...defaultProps} onSkipBack={onSkipBack} />)
    await userEvent.click(screen.getByLabelText('Skip back 10 seconds'))
    expect(onSkipBack).toHaveBeenCalledOnce()
  })

  it('calls onSkipForward on forward button click', async () => {
    const onSkipForward = vi.fn()
    render(<AudioPlayer {...defaultProps} onSkipForward={onSkipForward} />)
    await userEvent.click(screen.getByLabelText('Skip forward 10 seconds'))
    expect(onSkipForward).toHaveBeenCalledOnce()
  })
})

describe('formatTime', () => {
  it('formats 83 seconds as 1:23', () => {
    expect(formatTime(83)).toBe('1:23')
  })

  it('formats 5 seconds as 0:05', () => {
    expect(formatTime(5)).toBe('0:05')
  })

  it('formats 0 seconds as 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('formats NaN as 0:00', () => {
    expect(formatTime(NaN)).toBe('0:00')
  })

  it('formats Infinity as 0:00', () => {
    expect(formatTime(Infinity)).toBe('0:00')
  })
})
