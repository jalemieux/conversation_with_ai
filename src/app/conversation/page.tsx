'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

interface ModelResponse {
  round: number
  model: string
  modelName: string
  content: string
}

function ConversationContent() {
  const searchParams = useSearchParams()
  const [responses, setResponses] = useState<ModelResponse[]>([])
  const [currentRound, setCurrentRound] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [streamingResponses, setStreamingResponses] = useState<Map<string, ModelResponse>>(new Map())
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

    setTopic(rawInput)

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
                  setStreamingResponses((prev) => {
                    const next = new Map(prev)
                    const existing = next.get(key)
                    if (existing) {
                      next.set(key, { ...existing, content: existing.content + data.chunk })
                    } else {
                      next.set(key, { round: data.round, model: data.model, modelName: data.modelName, content: data.chunk })
                    }
                    return next
                  })
                  break
                }
                case 'response':
                  setStreamingResponses((prev) => {
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
  const streaming1 = Array.from(streamingResponses.values()).filter((r) => r.round === 1)
  const streaming2 = Array.from(streamingResponses.values()).filter((r) => r.round === 2)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Conversation</h1>
      {topic && <p className="text-gray-500 mb-6">{topic}</p>}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      {(round1.length > 0 || streaming1.length > 0) && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-500 mb-4">Round 1 — Initial Responses</h2>
          <div className="space-y-4">
            {round1.map((r, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="font-medium text-blue-600 mb-2">{r.modelName}</h3>
                <div className="text-gray-700 whitespace-pre-wrap">{r.content}</div>
              </div>
            ))}
            {streaming1.map((r) => (
              <div key={`streaming-${r.model}`} className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="font-medium text-blue-600 mb-2">{r.modelName}</h3>
                <div className="text-gray-700 whitespace-pre-wrap">{r.content}<span className="animate-pulse">▍</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(round2.length > 0 || streaming2.length > 0) && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-500 mb-4">Round 2 — Reactions</h2>
          <div className="space-y-4">
            {round2.map((r, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="font-medium text-purple-600 mb-2">{r.modelName}</h3>
                <div className="text-gray-700 whitespace-pre-wrap">{r.content}</div>
              </div>
            ))}
            {streaming2.map((r) => (
              <div key={`streaming-${r.model}`} className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="font-medium text-purple-600 mb-2">{r.modelName}</h3>
                <div className="text-gray-700 whitespace-pre-wrap">{r.content}<span className="animate-pulse">▍</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!done && !error && (
        <div className="text-center py-8 text-gray-500">
          {currentRound > 0
            ? `Round ${currentRound} in progress... (${
                currentRound === 1 ? round1.length : round2.length
              } responses received)`
            : 'Starting conversation...'}
        </div>
      )}

      {done && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => { window.location.href = '/' }}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
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
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
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
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
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
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
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
    <Suspense fallback={<div className="text-gray-400">Loading...</div>}>
      <ConversationContent />
    </Suspense>
  )
}
