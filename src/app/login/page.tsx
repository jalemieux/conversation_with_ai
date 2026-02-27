'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        router.push('/')
      } else {
        setError('Wrong password')
        setPassword('')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-ink mb-2">
        Conversation With AI
      </h1>
      <p className="text-ink-muted mb-8">Enter the password to continue</p>
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full px-4 py-3 rounded-lg border border-border bg-card text-ink placeholder:text-ink-faint focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-colors"
        />
        {error && (
          <p className="mt-2 text-sm text-danger">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full mt-4 px-4 py-3 rounded-lg bg-amber text-white font-medium hover:bg-amber/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Checking...' : 'Enter'}
        </button>
      </form>
    </div>
  )
}
