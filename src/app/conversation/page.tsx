'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import MarkdownContent from '@/components/MarkdownContent'
import { useTTS } from '@/hooks/useTTS'
import { SpeakerButton } from '@/components/SpeakerButton'
import { AudioPlayer } from '@/components/AudioPlayer'
import { CopyButton } from '@/components/CopyButton'
import { exportMarkdown, exportText, exportXThread } from '@/lib/export'

interface ModelResponse {
  round: number
  model: string
  modelName: string
  provider: string
  modelId: string
  content: string
  sources?: { url: string; title: string }[]
}

interface ModelState {
  loading: boolean
  error: string | null
  response: ModelResponse | null
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
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [round1States, setRound1States] = useState<Record<string, ModelState>>({})
  const [round2States, setRound2States] = useState<Record<string, ModelState>>({})
  const [round2Started, setRound2Started] = useState(false)
  const [topic, setTopic] = useState('')
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)
  const tts = useTTS()

  const models = (searchParams.get('models') ?? '').split(',').filter(Boolean)
  const essayMode = searchParams.get('essayMode') !== 'false'

  const callModel = useCallback(async (convId: string, modelKey: string, round: number): Promise<ModelResponse> => {
    const res = await fetch('/api/conversation/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: convId, model: modelKey, round, essayMode }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Request failed')
    }
    return res.json()
  }, [essayMode])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const rawInput = searchParams.get('rawInput') ?? ''
    const augmentedPrompt = searchParams.get('augmentedPrompt') ?? ''
    const topicType = searchParams.get('topicType') ?? ''
    const framework = searchParams.get('framework') ?? ''

    setTopic(augmentedPrompt || rawInput)

    if (!augmentedPrompt || models.length === 0) return

    // Initialize round 1 loading states
    const initialStates: Record<string, ModelState> = {}
    models.forEach((m) => { initialStates[m] = { loading: true, error: null, response: null } })
    setRound1States(initialStates)

    // Create conversation, then fire parallel model calls
    fetch('/api/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput, augmentedPrompt, topicType, framework, models }),
    })
      .then((res) => res.json())
      .then(({ conversationId: convId }) => {
        setConversationId(convId)

        // Fire all Round 1 calls in parallel
        models.forEach((modelKey) => {
          callModel(convId, modelKey, 1)
            .then((response) => {
              setRound1States((prev) => ({ ...prev, [modelKey]: { loading: false, error: null, response } }))
            })
            .catch((err) => {
              setRound1States((prev) => ({ ...prev, [modelKey]: { loading: false, error: err.message, response: null } }))
            })
        })
      })
      .catch((err) => setError(err.message))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startRound2 = () => {
    if (!conversationId) return
    setRound2Started(true)

    const initialStates: Record<string, ModelState> = {}
    models.forEach((m) => { initialStates[m] = { loading: true, error: null, response: null } })
    setRound2States(initialStates)

    models.forEach((modelKey) => {
      callModel(conversationId, modelKey, 2)
        .then((response) => {
          setRound2States((prev) => ({ ...prev, [modelKey]: { loading: false, error: null, response } }))
        })
        .catch((err) => {
          setRound2States((prev) => ({ ...prev, [modelKey]: { loading: false, error: err.message, response: null } }))
        })
    })
  }

  const round1Responses = Object.values(round1States).filter((s) => s.response).map((s) => s.response!)
  const round1Loading = Object.values(round1States).some((s) => s.loading)
  const round1Done = Object.keys(round1States).length > 0 && !round1Loading
  const round2Loading = Object.values(round2States).some((s) => s.loading)
  const round2Done = round2Started && !round2Loading
  const allDone = round1Done && (!round2Started || round2Done)

  const getAccent = (model: string, round: number) => {
    if (round === 2) return 'text-round2'
    return MODEL_ACCENT[model] ?? 'text-amber'
  }

  const getDot = (model: string, round: number) => {
    if (round === 2) return 'bg-round2'
    return MODEL_DOT[model] ?? 'bg-amber'
  }

  const getSpeakerState = (key: string): 'idle' | 'loading' | 'playing' | 'error' => {
    if (tts.playingKey === key) return 'playing'
    if (tts.loadingKey === key) return 'loading'
    if (tts.errorKey === key) return 'error'
    return 'idle'
  }

  const activeKey = tts.playingKey || tts.pausedKey || tts.loadingKey
  const activeModelName = activeKey ? (() => {
    const model = activeKey.split('-').slice(1).join('-')
    const responses = [...Object.values(round1States), ...Object.values(round2States)]
      .filter((s) => s.response)
      .map((s) => s.response!)
    const match = responses.find((r) => `${r.round}-${r.model}` === activeKey)
    return match?.modelName ?? model
  })() : undefined

  const ResponseCard = ({ r }: { r: ModelResponse }) => (
    <details open className="bg-card border border-border rounded-xl overflow-hidden animate-fade-up">
      <summary className="px-5 py-4 cursor-pointer select-none hover:bg-card-hover transition-colors flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDot(r.model, r.round)}`} />
        <span className={`font-medium ${getAccent(r.model, r.round)}`}>{r.modelName}</span>
        <span className="text-xs text-ink-faint">{r.provider} / {r.modelId}</span>
        <span className="ml-auto flex items-center">
          <CopyButton content={r.content} />
          <SpeakerButton
            state={getSpeakerState(`${r.round}-${r.model}`)}
            onClick={() => tts.toggle(`${r.round}-${r.model}`, r.content, r.model, conversationId ?? undefined, r.round)}
          />
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

  const LoadingCard = ({ modelKey, round }: { modelKey: string; round: number }) => (
    <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-up px-5 py-4 flex items-center gap-3">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDot(modelKey, round)}`} />
      <span className={`font-medium ${getAccent(modelKey, round)}`}>{modelKey}</span>
      <span className="ml-auto w-4 h-4 border-2 border-ink-faint/30 border-t-amber rounded-full animate-spin" />
    </div>
  )

  const ErrorCard = ({ modelKey, message, round }: { modelKey: string; message: string; round: number }) => (
    <div className="bg-danger/5 border border-danger/20 rounded-xl overflow-hidden animate-fade-up px-5 py-4 flex items-center gap-3">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDot(modelKey, round)}`} />
      <span className={`font-medium ${getAccent(modelKey, round)}`}>{modelKey}</span>
      <span className="text-danger text-sm ml-2">{message}</span>
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

      {Object.keys(round1States).length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5 animate-fade-up">
            <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Round 1 — Initial Responses</p>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-3">
            {models.map((modelKey) => {
              const state = round1States[modelKey]
              if (!state) return null
              if (state.response) return <ResponseCard key={modelKey} r={state.response} />
              if (state.error) return <ErrorCard key={modelKey} modelKey={modelKey} message={state.error} round={1} />
              return <LoadingCard key={modelKey} modelKey={modelKey} round={1} />
            })}
          </div>
        </div>
      )}

      {round2Started && (
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5 animate-fade-up">
            <p className="text-xs font-medium tracking-widest uppercase text-ink-faint">Round 2 — Reactions</p>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-3">
            {models.map((modelKey) => {
              const state = round2States[modelKey]
              if (!state) return null
              if (state.response) return <ResponseCard key={modelKey} r={state.response} />
              if (state.error) return <ErrorCard key={modelKey} modelKey={modelKey} message={state.error} round={2} />
              return <LoadingCard key={modelKey} modelKey={modelKey} round={2} />
            })}
          </div>
        </div>
      )}

      {round1Loading && (
        <div className="text-center py-10 animate-fade-in">
          <div className="inline-flex items-center gap-3 text-ink-muted">
            <span className="w-5 h-5 border-2 border-ink-faint/30 border-t-amber rounded-full animate-spin" />
            Round 1 in progress... ({round1Responses.length} of {models.length} responses received)
          </div>
        </div>
      )}

      {allDone && (
        <div className="mt-8 animate-fade-up flex flex-wrap gap-2">
          {round1Done && !round2Started && (
            <button
              onClick={startRound2}
              className="px-5 py-2.5 bg-amber text-cream hover:bg-amber-dark rounded-xl font-medium transition-all duration-200 text-sm shadow-[0_2px_8px_rgba(26,26,26,0.15)] hover:shadow-[0_2px_12px_rgba(26,26,26,0.25)] cursor-pointer"
            >
              Start Round 2
            </button>
          )}
          <button
            onClick={() => { window.location.href = '/' }}
            className="px-5 py-2.5 bg-ink text-cream hover:bg-ink-light rounded-xl font-medium transition-all duration-200 text-sm shadow-[0_2px_8px_rgba(26,26,26,0.15)] hover:shadow-[0_2px_12px_rgba(26,26,26,0.25)] cursor-pointer"
          >
            New Conversation
          </button>
          <button
            onClick={async () => {
              if (!conversationId) return
              const r = await fetch(`/api/conversations/${conversationId}`)
              const data = await r.json()
              await navigator.clipboard.writeText(exportMarkdown(data))
            }}
            className="px-5 py-2.5 bg-card border border-border hover:border-border-strong hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] rounded-xl font-medium transition-all duration-200 text-sm text-ink-muted hover:text-ink cursor-pointer"
          >
            Copy Markdown
          </button>
          <button
            onClick={async () => {
              if (!conversationId) return
              const r = await fetch(`/api/conversations/${conversationId}`)
              const data = await r.json()
              await navigator.clipboard.writeText(exportText(data))
            }}
            className="px-5 py-2.5 bg-card border border-border hover:border-border-strong hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] rounded-xl font-medium transition-all duration-200 text-sm text-ink-muted hover:text-ink cursor-pointer"
          >
            Copy Text
          </button>
          <button
            onClick={async () => {
              if (!conversationId) return
              const r = await fetch(`/api/conversations/${conversationId}`)
              const data = await r.json()
              const tweets = exportXThread(data)
              await navigator.clipboard.writeText(tweets.join('\n\n---\n\n'))
            }}
            className="px-5 py-2.5 bg-card border border-border hover:border-border-strong hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)] rounded-xl font-medium transition-all duration-200 text-sm text-ink-muted hover:text-ink cursor-pointer"
          >
            Copy X Thread
          </button>
        </div>
      )}

      {activeKey && (
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
