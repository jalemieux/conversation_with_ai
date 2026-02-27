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
    return <div className="text-red-400">Error: {error}</div>
  }

  if (!conversation) {
    return <div className="text-gray-500">Loading...</div>
  }

  const round1 = conversation.responses.filter((r) => r.round === 1)
  const round2 = conversation.responses.filter((r) => r.round === 2)

  const getModelName = (key: string) => MODEL_CONFIGS[key]?.name ?? key

  return (
    <div>
      <a href="/" className="text-blue-400 hover:underline text-sm mb-4 block">
        Back to Home
      </a>

      <h1 className="text-2xl font-bold mb-2">{conversation.rawInput}</h1>
      <p className="text-gray-400 mb-6">{conversation.augmentedPrompt}</p>

      <div className="mb-2 flex gap-2">
        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
          {conversation.topicType}
        </span>
        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
          {conversation.framework}
        </span>
      </div>

      {round1.length > 0 && (
        <div className="mb-8 mt-6">
          <h2 className="text-lg font-medium text-gray-400 mb-4">Round 1</h2>
          <div className="space-y-4">
            {round1.map((r) => (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h3 className="font-medium text-blue-400 mb-2">{getModelName(r.model)}</h3>
                <div className="text-gray-300 whitespace-pre-wrap">{r.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {round2.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-400 mb-4">Round 2</h2>
          <div className="space-y-4">
            {round2.map((r) => (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <h3 className="font-medium text-purple-400 mb-2">{getModelName(r.model)}</h3>
                <div className="text-gray-300 whitespace-pre-wrap">{r.content}</div>
              </div>
            ))}
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
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
        >
          Copy Markdown
        </button>
        <button
          onClick={() => {
            import('@/lib/export').then(({ exportText }) => {
              navigator.clipboard.writeText(exportText(conversation))
            })
          }}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
        >
          Copy Text
        </button>
      </div>
    </div>
  )
}
