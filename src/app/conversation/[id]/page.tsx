'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { MODEL_CONFIGS } from '@/lib/models'
import MarkdownContent from '@/components/MarkdownContent'
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

export default function ConversationDetailPage() {
  const params = useParams()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const round1 = conversation.responses.filter((r) => r.round === 1)
  const round2 = conversation.responses.filter((r) => r.round === 2)

  const getModelConfig = (key: string) => MODEL_CONFIGS[key] ?? { name: key, provider: key, modelId: key }

  return (
    <div>
      <a href="/" className="text-ink-faint hover:text-amber text-sm mb-6 inline-flex items-center gap-1.5 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        New Conversation
      </a>

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

      {round2.length > 0 && (
        <div className="mb-10 animate-fade-up stagger-3">
          <div className="flex items-center gap-3 mb-5">
            <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Round 2 — Reactions</p>
            <div className="flex-1 h-px bg-border" />
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

      <div className="flex flex-wrap gap-2 mt-8 animate-fade-up stagger-4">
        <button
          onClick={() => {
            import('@/lib/export').then(({ exportMarkdown }) => {
              navigator.clipboard.writeText(exportMarkdown(conversation))
            })
          }}
          className="px-5 py-2.5 bg-card border border-border hover:border-border-strong rounded-xl font-medium transition-all duration-200 text-sm text-ink-muted hover:text-ink"
        >
          Copy Markdown
        </button>
        <button
          onClick={() => {
            import('@/lib/export').then(({ exportText }) => {
              navigator.clipboard.writeText(exportText(conversation))
            })
          }}
          className="px-5 py-2.5 bg-card border border-border hover:border-border-strong rounded-xl font-medium transition-all duration-200 text-sm text-ink-muted hover:text-ink"
        >
          Copy Text
        </button>
      </div>
    </div>
  )
}
