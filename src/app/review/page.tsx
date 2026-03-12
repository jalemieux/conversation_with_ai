'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { TOPIC_TYPES, type TopicType, type AugmentationsMap } from '@/lib/augmenter'
import type { ResponseLength } from '@/lib/orchestrator'
import { MODEL_CONFIGS } from '@/lib/models'

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

function ReviewContent() {
  const searchParams = useSearchParams()

  const initialRawInput = searchParams.get('rawInput') ?? ''
  const recommended = (searchParams.get('recommended') ?? 'prediction') as TopicType

  const [rawInput, setRawInput] = useState(initialRawInput)
  const [availableModels, setAvailableModels] = useState<string[]>(Object.keys(MODEL_CONFIGS))
  const [selectedModels, setSelectedModels] = useState<string[]>(Object.keys(MODEL_CONFIGS))

  useEffect(() => {
    fetch('/api/user')
      .then(r => r.json())
      .then(data => {
        if (data.subscriptionStatus === 'active') {
          setAvailableModels(Object.keys(MODEL_CONFIGS))
          setSelectedModels(Object.keys(MODEL_CONFIGS))
        } else if (data.providers?.length > 0) {
          const providerToModels: Record<string, string[]> = {}
          for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
            if (!providerToModels[config.provider]) providerToModels[config.provider] = []
            providerToModels[config.provider].push(key)
          }
          const available = data.providers.flatMap((p: string) => providerToModels[p] || [])
          setAvailableModels(available)
          setSelectedModels(available)
        }
      })
      .catch(() => {})
  }, [])

  const toggleModel = (key: string) => {
    setSelectedModels((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    )
  }

  const augmentations: AugmentationsMap = useMemo(() => {
    try {
      return JSON.parse(searchParams.get('augmentations') ?? '{}')
    } catch {
      return {} as AugmentationsMap
    }
  }, [searchParams])

  const [selectedType, setSelectedType] = useState<TopicType>(recommended)
  const [augmentedPrompt, setAugmentedPrompt] = useState(
    augmentations[recommended]?.augmentedPrompt ?? ''
  )
  const [isEdited, setIsEdited] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [essayMode, setEssayMode] = useState(false)
  const [responseLength, setResponseLength] = useState<ResponseLength>('standard')
  const [currentAugmentations, setCurrentAugmentations] = useState(augmentations)

  const currentFramework = currentAugmentations[selectedType]?.framework ?? ''

  const handleTagClick = (type: TopicType) => {
    if (type === selectedType) return
    if (isEdited) {
      const confirmed = window.confirm('You have unsaved edits. Switching will discard them. Continue?')
      if (!confirmed) return
    }
    setSelectedType(type)
    setAugmentedPrompt(currentAugmentations[type]?.augmentedPrompt ?? '')
    setIsEdited(false)
  }

  const handlePromptChange = (value: string) => {
    setAugmentedPrompt(value)
    setIsEdited(value !== currentAugmentations[selectedType]?.augmentedPrompt)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch('/api/augment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      })
      const data = await res.json()
      setCurrentAugmentations(data.augmentations)
      setAugmentedPrompt(data.augmentations[selectedType]?.augmentedPrompt ?? '')
      setIsEdited(false)
    } finally {
      setRegenerating(false)
    }
  }

  const handleRun = () => {
    const params = new URLSearchParams({
      rawInput,
      augmentedPrompt,
      topicType: selectedType,
      framework: currentFramework,
      models: selectedModels.join(','),
      essayMode: String(essayMode),
      responseLength,
    })
    window.location.href = `/conversation?${params.toString()}`
  }

  return (
    <div>
      <a href="/" className="text-ink-faint hover:text-amber text-sm mb-8 inline-flex items-center gap-1.5 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back
      </a>

      <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight mb-8 animate-fade-up">
        Review <span className="text-amber italic">Prompt</span>
      </h1>

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
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-3">Topic Type</p>
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

      <div className="animate-fade-up stagger-3 mb-6 flex items-center gap-3">
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
        <p className="text-xs text-ink-muted mt-0.5">
          Shapes responses into flowing, essay-style prose.
        </p>
      </div>

      <div className="animate-fade-up stagger-4 mb-6">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-3">Response Length</p>
        <div className="flex gap-3 flex-wrap">
          {RESPONSE_LENGTHS.map(({ value, label, description }) => (
            <button
              key={value}
              onClick={() => setResponseLength(value)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                value === responseLength
                  ? 'bg-amber-faint text-amber ring-2 ring-amber/40 shadow-sm'
                  : 'bg-card text-ink-muted ring-1 ring-border hover:ring-amber/30 hover:text-ink hover:shadow-sm'
              }`}
              title={description}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-up stagger-5 mb-6">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-3">Panel</p>
        <div className="flex gap-2.5 flex-wrap">
          {Object.entries(MODEL_CONFIGS).filter(([key]) => availableModels.includes(key)).map(([key, config]) => {
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
                <span className="flex flex-col items-start leading-tight">
                  <span>{config.name}</span>
                  <span className={`text-[10px] font-normal ${active ? 'opacity-60' : 'opacity-40'}`}>{config.modelId}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="animate-fade-up stagger-6 mb-8">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-2">Augmented Prompt</p>
        <textarea
          value={augmentedPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          className="w-full h-44 bg-card border border-border rounded-xl p-5 text-ink focus:outline-none focus:border-amber transition-colors resize-none text-base leading-relaxed"
        />
      </div>

      <div className="animate-fade-up stagger-7 flex gap-3">
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
          disabled={selectedModels.length === 0}
          className="flex-1 py-3 bg-amber text-white hover:bg-amber-light disabled:bg-cream-dark disabled:text-ink-faint rounded-xl font-medium transition-all duration-200 active:scale-[0.995]"
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
