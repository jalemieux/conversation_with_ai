'use client'

import { useEffect } from 'react'
import { identifyUser } from '@/lib/analytics'

export function AnalyticsIdentify() {
  useEffect(() => {
    fetch('/api/user')
      .then((r) => r.json())
      .then(async (data) => {
        if (!data.id) return
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data.id))
        const hashedId = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
        const createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
        const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
        identifyUser(hashedId, {
          subscription_status: data.subscriptionStatus || 'none',
          has_byok_keys: (data.providers?.length ?? 0) > 0,
          account_age_days: accountAgeDays,
        })
      })
      .catch(() => {})
  }, [])

  return null
}
