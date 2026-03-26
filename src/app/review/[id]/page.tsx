'use client'

import { Suspense, useState, useEffect, use } from 'react'
import { TOPIC_TYPES, type TopicType, type AugmentationsMap } from '@/lib/augmenter'
import type { ResponseLength } from '@/lib/orchestrator'
import { MODEL_CONFIGS } from '@/lib/models'
import { trackEvent } from '@/lib/analytics'

const MODEL_COLORS: Record<string, { dot: string; activeBg: string; activeBorder: string; activeText: string }> = {
  claude:  { dot: 'bg-claude',  activeBg: 'bg-claude-faint',  activeBorder: 'border-claude/30',  activeText: 'text-claude' },
  gpt:     { dot: 'bg-gpt',     activeBg: 'bg-gpt-faint',     activeBorder: 'border-gpt/30',     activeText: 'text-gpt' },
  gemini:  { dot: 'bg-gemini',  activeBg: 'bg-gemini-faint',  activeBorder: 'border-gemini/30',  activeText: 'text-gemini' },
  grok:    { dot: 'bg-grok',    activeBg: 'bg-grok-faint',    activeBorder: 'border-grok/30',    activeText: 'text-grok' },
}

const RESPONSE_LENGTHS: { value: ResponseLength; label: string; description: string }[] = [
  { value: 'brief', label: 'Brief', description: 'Quick takes' },
  { value: 'standard', label: 'Standard', description: 'Moderate depth' },
  { value: 'detailed', label: 'Detailed', description: 'Deep dives' },
]

const TOPIC_DESCRIPTIONS: Record<TopicType, string> = {
  prediction: 'Explores possible futures through scenario analysis and cascading effects',
  opinion: 'Stress-tests a position by building the strongest case for and against it',
  trend_analysis: 'Places the topic on a timeline with recent context and trajectory',
  open_question: 'Examines the question from multiple angles and surfaces trade-offs',
}

function ReviewContent({ conversationId: initialConversationId }: { conversationId: string }) {
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rawInput, setRawInput] = useState('')
  const [augmentations, setAugmentations] = useState<AugmentationsMap>({} as AugmentationsMap)
  const [selectedType, setSelectedType] = useState<TopicType>('open_question')
  const [augmentedPrompt, setAugmentedPrompt] = useState('')
  const [isEdited, setIsEdited] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [essayMode, setEssayMode] = useState(false)
  const [responseLength, setResponseLength] = useState<ResponseLength>('standard')
  const [submitting, setSubmitting] = useState(false)

  const [availableModels, setAvailableModels] = useState<string[]>(Object.keys(MODEL_CONFIGS))
  const defaultCounts: Record<string, number> = {}
  for (const key of Object.keys(MODEL_CONFIGS)) defaultCounts[key] = 1
  const [modelCounts, setModelCounts] = useState<Record<string, number>>(defaultCounts)

  // Load conversation from DB
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}`)
      .then(r => {
        if (!r.ok) throw new Error('Conversation not found')
        return r.json()
      })
      .then(data => {
        setRawInput(data.rawInput)
        const augs: AugmentationsMap = data.augmentations
          ? (typeof data.augmentations === 'string' ? JSON.parse(data.augmentations) : data.augmentations)
          : ({} as AugmentationsMap)
        setAugmentations(augs)
        const topicType = data.topicType as TopicType
        setSelectedType(topicType)
        setAugmentedPrompt(augs[topicType]?.augmentedPrompt ?? data.augmentedPrompt)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [conversationId])

  // Load available models based on user access
  useEffect(() => {
    fetch('/api/user')
      .then(r => r.json())
      .then(data => {
        if (data.subscriptionStatus === 'active') {
          setAvailableModels(Object.keys(MODEL_CONFIGS))
          const counts: Record<string, number> = {}
          for (const key of Object.keys(MODEL_CONFIGS)) counts[key] = 1
          setModelCounts(counts)
        } else if (data.providers?.length > 0) {
          const providerToModels: Record<string, string[]> = {}
          for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
            if (!providerToModels[config.provider]) providerToModels[config.provider] = []
            providerToModels[config.provider].push(key)
          }
          const available = [...new Set<string>(data.providers.flatMap((p: string) => providerToModels[p] || []))]
          setAvailableModels(available)
          const counts: Record<string, number> = {}
          for (const key of available) counts[key] = 1
          setModelCounts(counts)
        }
      })
      .catch(() => console.warn('[review] Failed to check user access'))
  }, [])

  const MAX_PER_MODEL = 3
  const adjustCount = (key: string, delta: number) => {
    setModelCounts((prev) => {
      const current = prev[key] ?? 0
      const next = Math.max(0, Math.min(MAX_PER_MODEL, current + delta))
      return { ...prev, [key]: next }
    })
  }

  const totalSelected = Object.values(modelCounts).reduce((sum, n) => sum + n, 0)
  const currentFramework = augmentations[selectedType]?.framework ?? ''

  const handleTagClick = (type: TopicType) => {
    if (type === selectedType) return
    if (isEdited) {
      const confirmed = window.confirm('You have unsaved edits. Switching will discard them. Continue?')
      if (!confirmed) return
    }
    setSelectedType(type)
    setAugmentedPrompt(augmentations[type]?.augmentedPrompt ?? '')
    setIsEdited(false)
  }

  const handlePromptChange = (value: string) => {
    setAugmentedPrompt(value)
    setIsEdited(value !== augmentations[selectedType]?.augmentedPrompt)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch('/api/augment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Regeneration failed' }))
        setError(data.error ?? 'Failed to regenerate')
        return
      }
      const data = await res.json()
      if (data.augmentations) {
        setAugmentations(data.augmentations)
        setAugmentedPrompt(data.augmentations[selectedType]?.augmentedPrompt ?? '')
        setIsEdited(false)
        // Update to new draft conversation
        if (data.conversationId) {
          setConversationId(data.conversationId)
          window.history.replaceState(null, '', `/review/${data.conversationId}`)
        }
      }
    } catch {
      setError('Network error during regeneration')
    } finally {
      setRegenerating(false)
    }
  }

  const handleRun = async () => {
    setSubmitting(true)
    setError(null)
    const instanceKeys: string[] = []
    for (const [key, count] of Object.entries(modelCounts)) {
      for (let i = 0; i < count; i++) {
        instanceKeys.push(`${key}:${i}`)
      }
    }

    try {
      const res = await fetch('/api/conversation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          selectedType,
          augmentedPrompt,
          models: instanceKeys,
          essayMode,
          responseLength,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        setError(data.error ?? 'Failed to start conversation')
        setSubmitting(false)
        return
      }

      trackEvent('conversation_started', {
        topic_type: selectedType,
        framework: currentFramework,
      })

      window.location.href = `/conversation/${conversationId}`
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) return <div className="text-ink-faint">Loading...</div>
  if (error && loading) return <div className="text-danger">{error}</div>

  return (
    <div>
      <a href="/" className="text-ink-faint hover:text-amber text-sm mb-8 inline-flex items-center gap-1.5 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back
      </a>

      <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight mb-8 animate-fade-up">
        Review <span className="text-amber italic">Prompt</span>
      </h1>

      {error && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl p-4 mb-6 text-danger animate-fade-up">
          {error}
        </div>
      )}

      <div className="animate-fade-up stagger-1 mb-6">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-2">Your Input</p>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          className="w-full bg-card border border-border rounded-xl px-5 py-4 text-ink-light leading-relaxed focus:outline-none focus:border-amber transition-colors resize-none text-base"
          rows={3}
        />
      </div>

      <div className="animate-fade-up stagger-2 mb-4">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-3">Framing</p>
        <div className="flex gap-3 flex-wrap mb-3">
          {TOPIC_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleTagClick(type)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                type === selectedType
                  ? 'bg-amber-faint text-amber ring-2 ring-amber/40 shadow-sm'
                  : 'bg-card text-ink-muted ring-1 ring-border hover:ring-amber/30 hover:text-ink hover:shadow-sm'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-muted mt-2">
          <span className="font-medium text-ink-faint">{currentFramework}</span> — {TOPIC_DESCRIPTIONS[selectedType]}
        </p>
      </div>

      <div className="animate-fade-up stagger-3 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Panel</p>
          <span className="text-xs text-ink-faint">{totalSelected} response{totalSelected !== 1 ? 's' : ''} total</span>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          {Object.entries(MODEL_CONFIGS).map(([key, config]) => {
            const available = availableModels.includes(key)
            const count = modelCounts[key] ?? 0
            const active = available && count > 0
            const colors = MODEL_COLORS[key] ?? { dot: 'bg-amber', activeBg: 'bg-amber-faint', activeBorder: 'border-amber/30', activeText: 'text-amber' }
            return (
              <div
                key={key}
                className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
                  !available
                    ? 'bg-cream-dark/20 border-border/50 text-ink-faint/40 opacity-50'
                    : active
                      ? `${colors.activeBg} ${colors.activeBorder} ${colors.activeText}`
                      : 'bg-cream-dark/40 border-border text-ink-faint'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${colors.dot} ${active ? 'opacity-100' : 'opacity-20'}`} />
                <span className="flex flex-col items-start leading-tight">
                  <span>{config.name}</span>
                  <span className={`text-[10px] font-normal ${active ? 'opacity-60' : 'opacity-40'}`}>{config.modelId}</span>
                </span>
                {available && (
                  <span className="inline-flex items-center gap-1 ml-1">
                    <button
                      aria-label={`Decrease ${config.name} count`}
                      onClick={() => adjustCount(key, -1)}
                      disabled={count <= 0}
                      className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-card border border-border hover:border-border-strong disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-xs tabular-nums" data-testid={`count-${key}`}>{count}</span>
                    <button
                      aria-label={`Increase ${config.name} count`}
                      onClick={() => adjustCount(key, 1)}
                      disabled={count >= MAX_PER_MODEL}
                      className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold bg-card border border-border hover:border-border-strong disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      +
                    </button>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="animate-fade-up stagger-4 mb-8">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-2">Augmented Prompt</p>
        <textarea
          value={augmentedPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          className="w-full h-44 bg-card border border-border rounded-xl p-5 text-ink focus:outline-none focus:border-amber transition-colors resize-none text-base leading-relaxed"
        />
      </div>

      <div className="animate-fade-up stagger-5 mb-8 flex flex-wrap items-start gap-x-10 gap-y-4">
        <div className="flex items-center gap-3">
          <label htmlFor="essay-mode" className="text-xs font-medium tracking-widest uppercase text-ink-faint cursor-pointer">
            Essay Mode
          </label>
          <button
            id="essay-mode"
            role="checkbox"
            aria-checked={essayMode}
            aria-label="Essay mode"
            onClick={() => setEssayMode(!essayMode)}
            className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
              essayMode ? 'bg-amber' : 'bg-border-strong'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                essayMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Length</p>
          <div className="flex gap-2">
            {RESPONSE_LENGTHS.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => setResponseLength(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  value === responseLength
                    ? 'bg-amber-faint text-amber ring-1 ring-amber/40'
                    : 'bg-card text-ink-muted ring-1 ring-border hover:ring-amber/30 hover:text-ink'
                }`}
                title={description}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="animate-fade-up stagger-6 flex gap-3">
        <button
          onClick={() => window.history.back()}
          className="px-5 py-3 bg-card border border-border hover:border-border-strong rounded-xl font-medium transition-all duration-200 text-ink-muted hover:text-ink"
        >
          Back
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-5 py-3 bg-ink text-cream hover:bg-ink-light disabled:bg-cream-dark disabled:text-ink-faint rounded-xl font-medium transition-all duration-200"
        >
          {regenerating ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
              Regenerating...
            </span>
          ) : (
            'Regenerate'
          )}
        </button>
        <button
          onClick={handleRun}
          disabled={totalSelected === 0 || submitting}
          className="flex-1 py-3 bg-amber text-white hover:bg-amber-light disabled:bg-cream-dark disabled:text-ink-faint rounded-xl font-medium transition-all duration-200 active:scale-[0.995]"
        >
          {submitting ? 'Starting...' : 'Run Conversation'}
        </button>
      </div>
    </div>
  )
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense fallback={<div className="text-ink-faint">Loading...</div>}>
      <ReviewContent conversationId={id} />
    </Suspense>
  )
}
