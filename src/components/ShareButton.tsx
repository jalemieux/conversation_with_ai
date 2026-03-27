'use client'

import { useState } from 'react'
import { trackEvent } from '@/lib/analytics'

interface ShareButtonProps {
  url: string
}

export function ShareButton({ url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleClick = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    const match = url.match(/\/conversation\/([^/?]+)/)
    trackEvent('share_clicked', { conversation_id: match?.[1] ?? '' })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? 'Link copied' : 'Share conversation'}
      className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors cursor-pointer text-sm ${
        copied
          ? 'text-green-500'
          : 'text-ink-faint hover:text-ink-muted'
      }`}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      )}
      {copied ? 'Link copied!' : 'Share this conversation'}
    </button>
  )
}
