'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import MarkdownContent from '@/components/MarkdownContent'

interface ModelResponse {
  round: number
  model: string
  modelName: string
  provider: string
  modelId: string
  content: string
}

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

function ConversationContent() {
  const searchParams = useSearchParams()
  const [responses, setResponses] = useState<ModelResponse[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [streamingModels, setStreamingModels] = useState<Map<string, { round: number; model: string; modelName: string; provider: string; modelId: string }>>(new Map())
  const [topic, setTopic] = useState('')
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const rawInput = searchParams.get('rawInput') ?? ''
    const augmentedPrompt = searchParams.get('augmentedPrompt') ?? ''
    const topicType = searchParams.get('topicType') ?? ''
    const framework = searchParams.get('framework') ?? ''
    const models = (searchParams.get('models') ?? '').split(',').filter(Boolean)

    setTopic(augmentedPrompt || rawInput)

    if (!augmentedPrompt || models.length === 0) return

    fetch('/api/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput, augmentedPrompt, topicType, framework, models }),
    }).then((res) => {
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) return

      let buffer = ''

      const read = async () => {
        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break

          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          let eventType = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7)
            } else if (line.startsWith('data: ') && eventType) {
              const data = JSON.parse(line.slice(6))

              switch (eventType) {
                case 'round_start':
                  setCurrentRound(data.round)
                  break
                case 'token': {
                  const key = `${data.round}-${data.model}`
                  setStreamingModels((prev) => {
                    if (prev.has(key)) return prev
                    const next = new Map(prev)
                    next.set(key, { round: data.round, model: data.model, modelName: data.modelName, provider: data.provider, modelId: data.modelId })
                    return next
                  })
                  break
                }
                case 'response':
                  setStreamingModels((prev) => {
                    const next = new Map(prev)
                    next.delete(`${data.round}-${data.model}`)
                    return next
                  })
                  setResponses((prev) => [...prev, data])
                  break
                case 'done':
                  setConversationId(data.conversationId)
                  setDone(true)
                  break
                case 'error':
                  setError(data.message)
                  break
              }
              eventType = ''
            }
          }
        }
      }

      read()
    })
  }, [searchParams])

  const round1 = responses.filter((r) => r.round === 1)
  const round2 = responses.filter((r) => r.round === 2)
  const streaming1 = Array.from(streamingModels.values()).filter((r) => r.round === 1)
  const streaming2 = Array.from(streamingModels.values()).filter((r) => r.round === 2)

  const getAccent = (model: string, round: number) => {
    if (round === 2) return 'text-round2'
    return MODEL_ACCENT[model] ?? 'text-amber'
  }

  const getDot = (model: string, round: number) => {
    if (round === 2) return 'bg-round2'
    return MODEL_DOT[model] ?? 'bg-amber'
  }

  const ResponseCard = ({ r }: { r: ModelResponse }) => (
    <details open className="bg-card border border-border rounded-xl overflow-hidden animate-fade-up">
      <summary className="px-5 py-4 cursor-pointer select-none hover:bg-card-hover transition-colors flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDot(r.model, r.round)}`} />
        <span className={`font-medium ${getAccent(r.model, r.round)}`}>{r.modelName}</span>
        <span className="text-xs text-ink-faint">{r.provider} / {r.modelId}</span>
      </summary>
      <div className="px-5 pb-5 border-t border-border pt-4">
        <MarkdownContent content={r.content} />
      </div>
    </details>
  )

  const StreamingCard = ({ r }: { r: { model: string; modelName: string; provider: string; modelId: string; round: number } }) => (
    <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-up px-5 py-4 flex items-center gap-3">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDot(r.model, r.round)}`} />
      <span className={`font-medium ${getAccent(r.model, r.round)}`}>{r.modelName}</span>
      <span className="text-xs text-ink-faint">{r.provider} / {r.modelId}</span>
      <span className="ml-auto w-4 h-4 border-2 border-ink-faint/30 border-t-amber rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      <a href="/" className="text-ink-faint hover:text-amber text-sm mb-6 inline-flex items-center gap-1.5 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        New Conversation
      </a>

      {topic && (
        <div className="mb-10 animate-fade-up">
          <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-2">Topic</p>
          <div className="border-l-2 border-amber pl-5 py-1">
            <p className="text-ink leading-relaxed">{topic}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl p-4 mb-6 text-danger animate-fade-up">
          {error}
        </div>
      )}

      {(round1.length > 0 || streaming1.length > 0) && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5 animate-fade-up">
            <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Round 1 — Initial Responses</p>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-3">
            {round1.map((r, i) => (
              <ResponseCard key={i} r={r} />
            ))}
            {streaming1.map((r) => (
              <StreamingCard key={`streaming-${r.model}`} r={r} />
            ))}
          </div>
        </div>
      )}

      {(round2.length > 0 || streaming2.length > 0) && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5 animate-fade-up">
            <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Round 2 — Reactions</p>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-3">
            {round2.map((r, i) => (
              <ResponseCard key={i} r={r} />
            ))}
            {streaming2.map((r) => (
              <StreamingCard key={`streaming-${r.model}`} r={r} />
            ))}
          </div>
        </div>
      )}

      {!done && !error && (
        <div className="text-center py-10 animate-fade-in">
          <div className="inline-flex items-center gap-3 text-ink-muted">
            <span className="w-5 h-5 border-2 border-ink-faint/30 border-t-amber rounded-full animate-spin" />
            {currentRound > 0
              ? `Round ${currentRound} in progress... (${
                  currentRound === 1 ? round1.length : round2.length
                } responses received)`
              : 'Starting conversation...'}
          </div>
        </div>
      )}

      {done && (
        <div className="mt-8 animate-fade-up flex flex-wrap gap-2">
          <button
            onClick={() => { window.location.href = '/' }}
            className="px-5 py-2.5 bg-ink text-cream hover:bg-ink-light rounded-xl font-medium transition-all duration-200 text-sm shadow-[0_2px_8px_rgba(26,26,26,0.15)] hover:shadow-[0_2px_12px_rgba(26,26,26,0.25)] cursor-pointer"
          >
            New Conversation
          </button>
          <button
            onClick={() => {
              if (!conversationId) return
              fetch(`/api/conversations/${conversationId}`)
                .then((r) => r.json())
                .then((data) => {
                  import('@/lib/export').then(({ exportMarkdown }) => {
                    navigator.clipboard.writeText(exportMarkdown(data))
                  })
                })
            }}
            className="px-5 py-2.5 bg-card border border-border hover:border-border-strong hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] rounded-xl font-medium transition-all duration-200 text-sm text-ink-muted hover:text-ink cursor-pointer"
          >
            Copy Markdown
          </button>
          <button
            onClick={() => {
              if (!conversationId) return
              fetch(`/api/conversations/${conversationId}`)
                .then((r) => r.json())
                .then((data) => {
                  import('@/lib/export').then(({ exportText }) => {
                    navigator.clipboard.writeText(exportText(data))
                  })
                })
            }}
            className="px-5 py-2.5 bg-card border border-border hover:border-border-strong hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] rounded-xl font-medium transition-all duration-200 text-sm text-ink-muted hover:text-ink cursor-pointer"
          >
            Copy Text
          </button>
          <button
            onClick={() => {
              if (!conversationId) return
              fetch(`/api/conversations/${conversationId}`)
                .then((r) => r.json())
                .then((data) => {
                  import('@/lib/export').then(({ exportXThread }) => {
                    const tweets = exportXThread(data)
                    navigator.clipboard.writeText(tweets.join('\n\n---\n\n'))
                  })
                })
            }}
            className="px-5 py-2.5 bg-card border border-border hover:border-border-strong hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] rounded-xl font-medium transition-all duration-200 text-sm text-ink-muted hover:text-ink cursor-pointer"
          >
            Copy X Thread
          </button>
        </div>
      )}
    </div>
  )
}

export default function ConversationPage() {
  return (
    <Suspense fallback={<div className="text-ink-faint">Loading...</div>}>
      <ConversationContent />
    </Suspense>
  )
}
