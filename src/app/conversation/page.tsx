'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function Redirect() {
  const searchParams = useSearchParams()
  // Legacy support: redirect old URL-param-based navigation to the new ID-based route
  const id = searchParams.get('id')
  if (typeof window !== 'undefined') {
    if (id) {
      window.location.href = `/conversation/${id}`
    } else {
      window.location.href = '/'
    }
  }
  return <div className="text-ink-faint">Redirecting...</div>
}

export default function ConversationPage() {
  return (
    <Suspense fallback={<div className="text-ink-faint">Redirecting...</div>}>
      <Redirect />
    </Suspense>
  )
}
