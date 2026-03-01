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
  modelName?: string
  onPauseToggle: () => void
  onSkipBack: () => void
  onSkipForward: () => void
  onSeek: (time: number) => void
  onStop?: () => void
}

export function AudioPlayer({
  isPlaying,
  currentTime,
  duration,
  modelName,
  onPauseToggle,
  onSkipBack,
  onSkipForward,
  onSeek,
  onStop,
}: AudioPlayerProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = (e.clientX - rect.left) / rect.width
    onSeek(fraction * duration)
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Progress bar — full width at top of bar */}
      <div
        className="group h-1 bg-border cursor-pointer relative"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-amber"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-amber rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%`, marginLeft: '-5px' }}
        />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3">
        {/* Model name */}
        {modelName && (
          <span className="text-sm font-medium text-ink truncate min-w-0 max-w-[120px]">
            {modelName}
          </span>
        )}

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Skip back 10 seconds"
            onClick={onSkipBack}
            className="p-1.5 text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 19l-7-7 7-7" />
              <path d="M20 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={onPauseToggle}
            className="p-1.5 text-amber hover:text-amber/80 transition-colors cursor-pointer"
          >
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            )}
          </button>

          <button
            type="button"
            aria-label="Skip forward 10 seconds"
            onClick={onSkipForward}
            className="p-1.5 text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5l7 7-7 7" />
              <path d="M4 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Time display */}
        <span className="text-xs text-ink-faint tabular-nums whitespace-nowrap ml-auto">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Close/stop button */}
        {onStop && (
          <button
            type="button"
            aria-label="Stop playback"
            onClick={onStop}
            className="p-1.5 text-ink-faint hover:text-ink transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
