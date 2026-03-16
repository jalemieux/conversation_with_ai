'use client'

import { useState, FormEvent } from 'react'
import { trackEvent } from '@/lib/analytics'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { signIn } = await import('next-auth/react')
      const result = await signIn('resend', {
        email,
        redirect: false,
        callbackUrl: '/',
      })

      if (result?.error) {
        setError('Failed to send login link. Please try again.')
      } else {
        trackEvent('login', { method: 'magic_link' })
        setSubmitted(true)
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-ink mb-2">
          Check your email
        </h1>
        <p className="text-ink-muted mb-2">
          We sent a login link to <strong>{email}</strong>
        </p>
        <p className="text-ink-faint text-sm">
          Click the link in the email to sign in. You can close this tab.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-ink mb-2">
        Conversation With AI
      </h1>
      <p className="text-ink-muted mb-8">Enter your email to sign in</p>
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoFocus
          required
          className="w-full px-4 py-3 rounded-lg border border-border bg-card text-ink placeholder:text-ink-faint focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-colors"
        />
        {error && (
          <p className="mt-2 text-sm text-danger">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !email}
          className="w-full mt-4 px-4 py-3 rounded-lg bg-amber text-white font-medium hover:bg-amber/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {loading ? 'Sending...' : 'Send login link'}
        </button>
      </form>
    </div>
  )
}
