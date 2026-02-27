'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function ReviewContent() {
  const searchParams = useSearchParams()

  const rawInput = searchParams.get('rawInput') ?? ''
  const [augmentedPrompt, setAugmentedPrompt] = useState(searchParams.get('augmentedPrompt') ?? '')
  const topicType = searchParams.get('topicType') ?? ''
  const framework = searchParams.get('framework') ?? ''
  const models = searchParams.get('models') ?? ''
  const [regenerating, setRegenerating] = useState(false)

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch('/api/augment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      })
      const data = await res.json()
      setAugmentedPrompt(data.augmentedPrompt)
    } finally {
      setRegenerating(false)
    }
  }

  const handleRun = () => {
    const params = new URLSearchParams({
      rawInput,
      augmentedPrompt,
      topicType,
      framework,
      models,
    })
    window.location.href = `/conversation?${params.toString()}`
  }

  return (
    <div className="animate-fade-up">
      <a href="/" className="text-ink-faint hover:text-amber text-sm mb-8 inline-flex items-center gap-1.5 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back
      </a>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-0.5 bg-amber" />
        <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-ink-muted">Review</span>
      </div>

      <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold tracking-tight mb-8">
        Review Prompt
      </h1>

      {/* Original input */}
      <div className="mb-8">
        <label className="text-[11px] font-medium tracking-[0.2em] uppercase text-ink-faint mb-2 block">
          Your Input
        </label>
        <p className="text-ink-light text-[15px] leading-relaxed border-l-2 border-border pl-4 py-1">
          {rawInput}
        </p>
      </div>

      {/* Classification tags */}
      <div className="mb-8 flex gap-2">
        <span className="px-2.5 py-1 bg-amber-faint text-amber rounded-md text-xs font-medium">
          {topicType}
        </span>
        <span className="px-2.5 py-1 bg-cream-dark text-ink-muted rounded-md text-xs font-medium">
          {framework}
        </span>
      </div>

      {/* Augmented prompt editor */}
      <div className="mb-8">
        <label className="text-[11px] font-medium tracking-[0.2em] uppercase text-ink-faint mb-3 block">
          Augmented Prompt
        </label>
        <textarea
          value={augmentedPrompt}
          onChange={(e) => setAugmentedPrompt(e.target.value)}
          className="w-full h-40 bg-card border border-border rounded-lg p-4 text-ink text-[15px] leading-relaxed focus:outline-none focus:border-amber/50 resize-none transition-colors"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => window.history.back()}
          className="px-6 py-3 bg-card border border-border hover:border-border-strong hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] rounded-lg text-sm font-medium text-ink-muted hover:text-ink transition-all duration-200 cursor-pointer"
        >
          Back
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-6 py-3 bg-card border border-border hover:border-border-strong hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] disabled:text-ink-faint disabled:hover:shadow-none rounded-lg text-sm font-medium text-ink-muted hover:text-ink transition-all duration-200 cursor-pointer disabled:cursor-default"
        >
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
        <button
          onClick={handleRun}
          className="flex-1 py-3 bg-ink text-cream hover:bg-ink-light rounded-lg text-sm font-medium tracking-wide transition-all duration-200 shadow-[0_2px_8px_rgba(26,26,26,0.15)] hover:shadow-[0_2px_12px_rgba(26,26,26,0.25)] cursor-pointer"
        >
          Run Conversation
        </button>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="text-ink-faint">Loading...</div>}>
      <ReviewContent />
    </Suspense>
  )
}
