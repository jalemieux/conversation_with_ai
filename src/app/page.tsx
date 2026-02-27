'use client'

import { useState, useEffect } from 'react'
import { MODEL_CONFIGS } from '@/lib/models'

interface RecentConversation {
  id: string
  createdAt: string
  rawInput: string
  topicType: string
}

const MODEL_COLORS: Record<string, { dot: string; activeBg: string; activeBorder: string; activeText: string }> = {
  claude:  { dot: 'bg-claude',  activeBg: 'bg-claude-faint',  activeBorder: 'border-claude/30',  activeText: 'text-claude' },
  gpt:     { dot: 'bg-gpt',     activeBg: 'bg-gpt-faint',     activeBorder: 'border-gpt/30',     activeText: 'text-gpt' },
  gemini:  { dot: 'bg-gemini',  activeBg: 'bg-gemini-faint',  activeBorder: 'border-gemini/30',  activeText: 'text-gemini' },
  grok:    { dot: 'bg-grok',    activeBg: 'bg-grok-faint',    activeBorder: 'border-grok/30',    activeText: 'text-grok' },
}

const TOPIC_COLORS: Record<string, string> = {
  prediction: 'bg-gemini-faint text-gemini',
  opinion: 'bg-claude-faint text-claude',
  analysis: 'bg-gpt-faint text-gpt',
  question: 'bg-grok-faint text-grok',
}

export default function Home() {
  const [rawInput, setRawInput] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>(Object.keys(MODEL_CONFIGS))
  const [recent, setRecent] = useState<RecentConversation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/conversations')
      .then((r) => r.json())
      .then(setRecent)
      .catch(() => {})
  }, [])

  const toggleModel = (key: string) => {
    setSelectedModels((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    )
  }

  const handleSubmit = async () => {
    if (!rawInput.trim() || selectedModels.length === 0) return
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
        augmentedPrompt: data.augmentedPrompt,
        topicType: data.topicType,
        framework: data.framework,
        models: selectedModels.join(','),
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
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-[3px] bg-amber rounded-full" />
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-amber">Roundtable</span>
        </div>
        <h1 className="font-[family-name:var(--font-serif)] text-4xl font-semibold tracking-tight leading-tight text-ink mb-3">
          Conversation With AI
        </h1>
        <p className="text-ink-muted text-[15px] leading-relaxed max-w-lg">
          Moderate a structured roundtable between frontier models. Pose a question, select your panel, and compare perspectives.
        </p>
      </header>

      {/* Composer card — groups the input, panel, and CTA */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-[0_1px_6px_rgba(0,0,0,0.04)] mb-10 animate-fade-up" style={{ animationDelay: '0.05s' }}>
        {/* Topic input */}
        <div className="mb-6">
          <label className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-3 block">
            Topic
          </label>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="e.g. 'Will AI-driven industrialization of software follow the pattern of prior industrial revolutions?'"
            className="w-full h-28 bg-cream border border-border rounded-lg p-4 text-ink text-[15px] leading-relaxed placeholder-ink-faint/50 focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/10 resize-none transition-all"
          />
        </div>

        {/* Model selector */}
        <div className="mb-6">
          <label className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-3 block">
            Panel
          </label>
          <div className="flex gap-2.5 flex-wrap">
            {Object.entries(MODEL_CONFIGS).map(([key, config]) => {
              const active = selectedModels.includes(key)
              const colors = MODEL_COLORS[key] ?? { dot: 'bg-amber', activeBg: 'bg-amber-faint', activeBorder: 'border-amber/30', activeText: 'text-amber' }
              return (
                <button
                  key={key}
                  onClick={() => toggleModel(key)}
                  className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border cursor-pointer ${
                    active
                      ? `${colors.activeBg} ${colors.activeBorder} ${colors.activeText}`
                      : 'bg-cream-dark/40 border-border text-ink-faint hover:text-ink-muted hover:border-border-strong'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${colors.dot} ${active ? 'opacity-100' : 'opacity-20'}`} />
                  {config.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !rawInput.trim() || selectedModels.length === 0}
          className="w-full py-3.5 bg-amber text-white hover:bg-amber-light disabled:bg-cream-dark disabled:text-ink-faint rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 shadow-[0_2px_10px_rgba(194,116,47,0.25)] hover:shadow-[0_4px_16px_rgba(194,116,47,0.3)] disabled:shadow-none cursor-pointer disabled:cursor-default"
        >
          {loading ? 'Preparing...' : 'Begin Conversation'}
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
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
