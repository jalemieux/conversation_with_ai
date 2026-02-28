'use client'

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface AudioPlayerProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  onPauseToggle: () => void
  onSkipBack: () => void
  onSkipForward: () => void
  onSeek: (time: number) => void
}

export function AudioPlayer({
  isPlaying,
  currentTime,
  duration,
  onPauseToggle,
  onSkipBack,
  onSkipForward,
  onSeek,
}: AudioPlayerProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = (e.clientX - rect.left) / rect.width
    onSeek(fraction * duration)
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 bg-cream-dark rounded-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Skip back */}
      <button
        type="button"
        aria-label="Skip back 10 seconds"
        onClick={onSkipBack}
        className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 19l-7-7 7-7" />
          <path d="M20 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={onPauseToggle}
        className="p-1 text-amber hover:text-amber/80 transition-colors cursor-pointer"
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,4 20,12 6,20" />
          </svg>
        )}
      </button>

      {/* Skip forward */}
      <button
        type="button"
        aria-label="Skip forward 10 seconds"
        onClick={onSkipForward}
        className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5l7 7-7 7" />
          <path d="M4 5l7 7-7 7" />
        </svg>
      </button>

      {/* Progress bar */}
      <div
        className="group flex-1 h-1.5 bg-border rounded-full cursor-pointer relative"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-amber rounded-full relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-amber rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Time display */}
      <span className="text-xs text-ink-faint tabular-nums whitespace-nowrap">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  )
}
