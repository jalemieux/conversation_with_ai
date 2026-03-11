'use client'

import { useState } from 'react'

export default function SetupPage() {
  const [loading, setLoading] = useState(false)

  async function handleSubscribe() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-ink mb-2">
        Get Started
      </h1>
      <p className="text-ink-muted mb-10 text-center max-w-md">
        To use Conversation With AI, subscribe for full access or bring your own API keys.
      </p>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full py-4 bg-amber text-white rounded-xl font-semibold text-base hover:bg-amber-light transition-all shadow-[0_2px_10px_rgba(194,116,47,0.25)] hover:shadow-[0_4px_16px_rgba(194,116,47,0.3)] disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Redirecting...' : 'Subscribe for $20/month'}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-ink-faint uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <a
          href="/settings"
          className="block w-full py-4 text-center bg-card border border-border rounded-xl font-semibold text-base text-ink hover:border-amber/30 transition-all"
        >
          Use your own API keys
        </a>
      </div>
    </div>
  )
}
