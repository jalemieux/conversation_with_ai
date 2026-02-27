'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { MODEL_CONFIGS } from '@/lib/models'
import type { Conversation } from '@/lib/types'

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
    return <div className="text-red-600">Error: {error}</div>
  }

  if (!conversation) {
    return <div className="text-gray-400">Loading...</div>
  }

  const round1 = conversation.responses.filter((r) => r.round === 1)
  const round2 = conversation.responses.filter((r) => r.round === 2)

  const getModelConfig = (key: string) => MODEL_CONFIGS[key] ?? { name: key, provider: key, modelId: key }

  return (
    <div>
      <a href="/" className="text-blue-600 hover:underline text-sm mb-4 block">&larr; New Conversation</a>

      <div className="mb-8 border-l-4 border-blue-400 bg-blue-50 rounded-r-lg px-5 py-4">
        <p className="text-xs font-medium text-blue-500 uppercase tracking-wide mb-1">Topic</p>
        <p className="text-gray-700 leading-relaxed">{conversation.augmentedPrompt || conversation.rawInput}</p>
      </div>

      <div className="mb-6 flex gap-2">
        <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">
          {conversation.topicType}
        </span>
        <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">
          {conversation.framework}
        </span>
      </div>

      {round1.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-500 mb-4">Round 1 — Initial Responses</h2>
          <div className="space-y-4">
            {round1.map((r) => {
              const config = getModelConfig(r.model)
              return (
                <details key={r.id} open className="bg-white border border-gray-200 rounded-lg">
                  <summary className="px-5 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg flex items-baseline gap-2">
                    <span className="font-medium text-blue-600">{config.name}</span>
                    <span className="text-xs text-gray-400">{config.provider} / {config.modelId}</span>
                  </summary>
                  <div className="text-gray-700 whitespace-pre-wrap px-5 pb-5">{r.content}</div>
                </details>
              )
            })}
          </div>
        </div>
      )}

      {round2.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-500 mb-4">Round 2 — Reactions</h2>
          <div className="space-y-4">
            {round2.map((r) => {
              const config = getModelConfig(r.model)
              return (
                <details key={r.id} open className="bg-white border border-gray-200 rounded-lg">
                  <summary className="px-5 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg flex items-baseline gap-2">
                    <span className="font-medium text-purple-600">{config.name}</span>
                    <span className="text-xs text-gray-400">{config.provider} / {config.modelId}</span>
                  </summary>
                  <div className="text-gray-700 whitespace-pre-wrap px-5 pb-5">{r.content}</div>
                </details>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => {
            import('@/lib/export').then(({ exportMarkdown }) => {
              navigator.clipboard.writeText(exportMarkdown(conversation))
            })
          }}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
        >
          Copy Markdown
        </button>
        <button
          onClick={() => {
            import('@/lib/export').then(({ exportText }) => {
              navigator.clipboard.writeText(exportText(conversation))
            })
          }}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
        >
          Copy Text
        </button>
      </div>
    </div>
  )
}
