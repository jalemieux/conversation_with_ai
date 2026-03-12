'use client'

import { useState, useEffect } from 'react'

interface RecentConversation {
  id: string
  createdAt: string
  rawInput: string
  topicType: string
}

const TOPIC_COLORS: Record<string, string> = {
  prediction: 'bg-gemini-faint text-gemini',
  opinion: 'bg-claude-faint text-claude',
  analysis: 'bg-gpt-faint text-gpt',
  question: 'bg-grok-faint text-grok',
}

export default function Home() {
  const [rawInput, setRawInput] = useState('')
  const [recent, setRecent] = useState<RecentConversation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/user')
      .then(r => r.json())
      .then(data => {
        if (data.subscriptionStatus !== 'active' && (!data.providers || data.providers.length === 0)) {
          window.location.href = '/setup'
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/conversations')
      .then((r) => r.json())
      .then(setRecent)
      .catch(() => {})
  }, [])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this conversation?')) return

    setRecent((prev) => prev.filter((c) => c.id !== id))

    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      // Re-fetch to restore on failure
      fetch('/api/conversations')
        .then((r) => r.json())
        .then(setRecent)
        .catch(() => {})
    }
  }

  const handleSubmit = async () => {
    if (!rawInput.trim()) return
    setLoading(true)

    try {
      const res = await fetch('/api/augment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: rawInput.trim() }),
      })

      const data = await res.json()

      const params = new URLSearchParams({
        rawInput: data.rawInput,
        recommended: data.recommended,
        augmentations: JSON.stringify(data.augmentations),
      })
      window.location.href = `/review?${params.toString()}`
    } catch {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Masthead */}
      <header className="mb-10 animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-[3px] bg-amber rounded-full" />
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-amber">Roundtable</span>
          </div>
          <a href="/settings" className="text-sm text-ink-muted hover:text-ink transition-colors">Settings</a>
        </div>
        <h1 className="font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-tight leading-tight text-ink mb-3">
          Conversation With AI
        </h1>
        <p className="text-ink-muted text-[15px] leading-relaxed max-w-lg">
          Let&apos;s help you frame the best prompt for your question.
        </p>
      </header>

      {/* Composer card — groups the input, panel, and CTA */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-[0_1px_6px_rgba(0,0,0,0.04)] mb-10 animate-fade-up" style={{ animationDelay: '0.05s' }}>
        {/* Topic input */}
        <div className="mb-6">
          <label className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-3 block">
            You Ask
          </label>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="e.g. 'Will AI-driven industrialization of software follow the pattern of prior industrial revolutions?'"
            className="w-full h-28 bg-cream border border-border rounded-lg p-4 text-ink text-[15px] leading-relaxed placeholder-ink-faint/50 focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/10 resize-none transition-all"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !rawInput.trim()}
          className="w-full py-3.5 bg-amber text-white hover:bg-amber-light disabled:bg-cream-dark disabled:text-ink-faint rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 shadow-[0_2px_10px_rgba(194,116,47,0.25)] hover:shadow-[0_4px_16px_rgba(194,116,47,0.3)] disabled:shadow-none cursor-pointer disabled:cursor-default"
        >
          {loading ? 'Preparing...' : 'Prepare Conversation'}
        </button>
      </div>

      {/* Recent conversations */}
      {recent.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted">Recent</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2">
            {recent.map((conv) => {
              const tagColor = TOPIC_COLORS[conv.topicType] ?? 'bg-cream-dark text-ink-muted'
              return (
                <a
                  key={conv.id}
                  href={`/conversation/${conv.id}`}
                  className="group flex items-center gap-4 py-3.5 px-5 bg-card border border-border rounded-xl hover:border-amber/30 hover:shadow-[0_2px_8px_rgba(194,116,47,0.08)] transition-all duration-200"
                >
                  <span className="text-ink-light group-hover:text-ink text-[15px] leading-snug transition-colors line-clamp-1 flex-1">
                    {conv.rawInput}
                  </span>
                  <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded ${tagColor} flex-shrink-0`}>
                    {conv.topicType}
                  </span>
                  <span className="text-xs text-ink-faint flex-shrink-0 tabular-nums">
                    {new Date(conv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="p-1.5 rounded-md text-ink-faint/0 group-hover:text-ink-faint hover:!text-red-400 hover:bg-red-50 transition-all duration-200 flex-shrink-0"
                    aria-label="Delete conversation"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                    </svg>
                  </button>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
