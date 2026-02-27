'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function ReviewContent() {
  const searchParams = useSearchParams()

  const rawInput = searchParams.get('rawInput') ?? ''
  const [augmentedPrompt, setAugmentedPrompt] = useState(searchParams.get('augmentedPrompt') ?? '')
  const topicType = searchParams.get('topicType') ?? ''
  const framework = searchParams.get('framework') ?? ''
  const models = searchParams.get('models') ?? ''
  const [regenerating, setRegenerating] = useState(false)

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch('/api/augment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      })
      const data = await res.json()
      setAugmentedPrompt(data.augmentedPrompt)
    } finally {
      setRegenerating(false)
    }
  }

  const handleRun = () => {
    const params = new URLSearchParams({
      rawInput,
      augmentedPrompt,
      topicType,
      framework,
      models,
    })
    window.location.href = `/conversation?${params.toString()}`
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Review Augmented Prompt</h1>

      <div className="mb-4">
        <label className="text-sm font-medium text-gray-400">Your Input</label>
        <p className="mt-1 text-gray-300">{rawInput}</p>
      </div>

      <div className="mb-2 flex gap-2">
        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">{topicType}</span>
        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">{framework}</span>
      </div>

      <div className="mb-6">
        <label className="text-sm font-medium text-gray-400">Augmented Prompt</label>
        <textarea
          value={augmentedPrompt}
          onChange={(e) => setAugmentedPrompt(e.target.value)}
          className="w-full h-40 mt-1 bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-100 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => window.history.back()}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
        >
          {regenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
        <button
          onClick={handleRun}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          Run Conversation
        </button>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReviewContent />
    </Suspense>
  )
}
