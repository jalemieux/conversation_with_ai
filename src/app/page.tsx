'use client'

import { useState, useEffect } from 'react'
import { MODEL_CONFIGS } from '@/lib/models'

interface RecentConversation {
  id: string
  createdAt: string
  rawInput: string
  topicType: string
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
        recommended: data.recommended,
        augmentations: JSON.stringify(data.augmentations),
        models: selectedModels.join(','),
      })
      window.location.href = `/review?${params.toString()}`
    } catch {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Conversation With AI</h1>
      <p className="text-gray-500 mb-8">
        Moderate a roundtable discussion between frontier AI models
      </p>

      <div className="mb-6">
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="Enter a topic or question... e.g. 'Future of software engineering'"
          className="w-full h-32 bg-white border border-gray-300 rounded-lg p-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Models</h3>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(MODEL_CONFIGS).map(([key, config]) => (
            <button
              key={key}
              onClick={() => toggleModel(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedModels.includes(key)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {config.name}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !rawInput.trim() || selectedModels.length === 0}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 rounded-lg font-medium transition-colors"
      >
        {loading ? 'Augmenting...' : 'Start Conversation'}
      </button>

      {recent.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-medium mb-4">Recent Conversations</h2>
          <div className="space-y-2">
            {recent.map((conv) => (
              <a
                key={conv.id}
                href={`/conversation/${conv.id}`}
                className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors"
              >
                <div className="font-medium">{conv.rawInput}</div>
                <div className="text-sm text-gray-400 mt-1">
                  {conv.topicType} — {new Date(conv.createdAt).toLocaleDateString()}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
