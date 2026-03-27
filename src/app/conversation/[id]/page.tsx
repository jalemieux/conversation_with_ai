'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { MODEL_CONFIGS } from '@/lib/models'
import MarkdownContent from '@/components/MarkdownContent'
import { useTTS } from '@/hooks/useTTS'
import { SpeakerButton } from '@/components/SpeakerButton'
import { AudioPlayer } from '@/components/AudioPlayer'
import { CopyButton } from '@/components/CopyButton'
import { ShareButton } from '@/components/ShareButton'
import type { Conversation } from '@/lib/types'

const MODEL_ACCENT: Record<string, string> = {
  claude: 'text-claude',
  gpt: 'text-gpt',
  gemini: 'text-gemini',
  grok: 'text-grok',
}

const MODEL_DOT: Record<string, string> = {
  claude: 'bg-claude',
  gpt: 'bg-gpt',
  gemini: 'bg-gemini',
  grok: 'bg-grok',
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

export default function ConversationDetailPage() {
  const params = useParams()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tts = useTTS()

  useEffect(() => {
    fetch(`/api/conversations/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then(setConversation)
      .catch((e) => setError(e.message))
  }, [params.id])

  if (error) {
    return <div className="text-danger">Error: {error}</div>
  }

  if (!conversation) {
    return (
      <div className="text-center py-16">
        <span className="w-5 h-5 border-2 border-ink-faint/30 border-t-amber rounded-full animate-spin inline-block" />
      </div>
    )
  }

  const isOwner = conversation.isOwner ?? false
  const round1 = conversation.responses.filter((r) => r.round === 1)
  const round2 = conversation.responses.filter((r) => r.round === 2)

  const getModelConfig = (key: string) => MODEL_CONFIGS[key] ?? { name: key, provider: key, modelId: key }

  const getSpeakerState = (key: string): 'idle' | 'loading' | 'playing' | 'error' => {
    if (tts.playingKey === key) return 'playing'
    if (tts.loadingKey === key) return 'loading'
    if (tts.errorKey === key) return 'error'
    return 'idle'
  }

  const activeKey = tts.playingKey || tts.pausedKey || tts.loadingKey
  const activeModelName = activeKey ? (() => {
    const model = activeKey.split('-').slice(1).join('-')
    return getModelConfig(model).name
  })() : undefined

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <a href="/" className="text-ink-faint hover:text-amber text-sm inline-flex items-center gap-1.5 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          New Conversation
        </a>
        <ShareButton url={`${typeof window !== 'undefined' ? window.location.origin : ''}/conversation/${conversation.id}`} />
      </div>

      <div className="mb-10 animate-fade-up">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-2">Topic</p>
        <div className="border-l-2 border-amber pl-5 py-1">
          <p className="text-ink leading-relaxed">{conversation.augmentedPrompt || conversation.rawInput}</p>
        </div>
      </div>

      <div className="animate-fade-up stagger-1 mb-8 flex gap-2">
        <span className="px-2.5 py-1 bg-amber-faint text-amber rounded-lg text-xs font-medium">
          {conversation.topicType}
        </span>
        <span className="px-2.5 py-1 bg-cream-dark text-ink-muted rounded-lg text-xs font-medium">
          {conversation.framework}
        </span>
      </div>

      {round1.length > 0 && (
        <div className="mb-10 animate-fade-up stagger-2">
          <div className="flex items-center gap-3 mb-5">
            <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Round 1 — Initial Responses</p>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-3">
            {round1.map((r) => {
              const config = getModelConfig(r.model)
              const accent = MODEL_ACCENT[r.model] ?? 'text-amber'
              const dot = MODEL_DOT[r.model] ?? 'bg-amber'
              return (
                <details key={r.id} open className="bg-card border border-border rounded-xl overflow-hidden">
                  <summary className="px-5 py-4 cursor-pointer select-none hover:bg-card-hover transition-colors flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    <span className={`font-medium ${accent}`}>{config.name}</span>
                    <span className="text-xs text-ink-faint">{config.provider} / {config.modelId}</span>
                    {r.usage && (
                      <span className="text-xs text-ink-faint tabular-nums">
                        {formatTokens(r.usage.inputTokens)}↑ {formatTokens(r.usage.outputTokens)}↓ {formatCost(r.usage.cost)}
                      </span>
                    )}
                    <span className="ml-auto flex items-center">
                      <CopyButton content={r.content} />
                      {isOwner && (
                        <SpeakerButton
                          state={getSpeakerState(`${r.round}-${r.model}`)}
                          onClick={() => tts.toggle(`${r.round}-${r.model}`, r.content, r.model, conversation.id, r.round)}
                        />
                      )}
                    </span>
                  </summary>
                  <div className="px-5 pb-5 border-t border-border pt-4">
                    <MarkdownContent content={r.content} />
                    {r.sources && r.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border">
                        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-2">Sources</p>
                        <ol className="list-decimal list-inside space-y-1">
                          {r.sources.map((s, i) => (
                            <li key={i} className="text-xs text-ink-muted">
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-amber transition-colors"
                              >
                                {s.title || new URL(s.url).hostname}
                              </a>
                              <span className="text-ink-faint ml-1">
                                — {new URL(s.url).hostname}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      )}

      {round2.length > 0 && (
        <div className="mb-10 animate-fade-up stagger-3">
          <div className="mb-5">
            <div className="flex items-center gap-3">
              <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Round 2 — Reactions</p>
              <div className="flex-1 h-px bg-border" />
            </div>
            <p className="text-xs text-ink-muted mt-1">Each model reacts to what the others said</p>
          </div>
          <div className="space-y-3">
            {round2.map((r) => {
              const config = getModelConfig(r.model)
              return (
                <details key={r.id} open className="bg-card border border-border rounded-xl overflow-hidden">
                  <summary className="px-5 py-4 cursor-pointer select-none hover:bg-card-hover transition-colors flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-round2" />
                    <span className="font-medium text-round2">{config.name}</span>
                    <span className="text-xs text-ink-faint">{config.provider} / {config.modelId}</span>
                    {r.usage && (
                      <span className="text-xs text-ink-faint tabular-nums">
                        {formatTokens(r.usage.inputTokens)}↑ {formatTokens(r.usage.outputTokens)}↓ {formatCost(r.usage.cost)}
                      </span>
                    )}
                    <span className="ml-auto flex items-center">
                      <CopyButton content={r.content} />
                      {isOwner && (
                        <SpeakerButton
                          state={getSpeakerState(`${r.round}-${r.model}`)}
                          onClick={() => tts.toggle(`${r.round}-${r.model}`, r.content, r.model, conversation.id, r.round)}
                        />
                      )}
                    </span>
                  </summary>
                  <div className="px-5 pb-5 border-t border-border pt-4">
                    <MarkdownContent content={r.content} />
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-8 animate-fade-up stagger-4 flex justify-end">
        <ShareButton url={`${typeof window !== 'undefined' ? window.location.origin : ''}/conversation/${conversation.id}`} />
      </div>

      {isOwner && activeKey && (
        <AudioPlayer
          isPlaying={!!tts.playingKey}
          currentTime={tts.currentTime}
          duration={tts.duration}
          modelName={activeModelName}
          onPauseToggle={tts.pauseToggle}
          onSkipBack={tts.skipBack}
          onSkipForward={tts.skipForward}
          onSeek={tts.seek}
          onStop={tts.stop}
        />
      )}

      {!isOwner && (
        <div className="mt-12 mb-4 border border-border rounded-xl bg-card p-6 text-center animate-fade-up">
          <p className="text-ink leading-relaxed mb-4">
            Explore complex questions from different angles. AI helps you frame the right question, then every frontier model responds and they critique each other&apos;s answers.
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-2.5 bg-amber text-cream font-medium rounded-xl hover:brightness-110 transition-all duration-200 text-sm"
          >
            Get started
          </a>
        </div>
      )}
    </div>
  )
}
