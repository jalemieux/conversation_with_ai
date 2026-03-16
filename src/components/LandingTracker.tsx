'use client'

import { useEffect } from 'react'
import { trackLandingVariant, trackEvent } from '@/lib/analytics'

export function LandingTracker({ variant }: { variant: string }) {
  useEffect(() => {
    trackLandingVariant(variant)
  }, [variant])

  return null
}

export function LandingCTA({ variant, href, className, children }: {
  variant: string
  href: string
  className: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      onClick={() => trackEvent('landing_cta_click', { variant })}
      className={className}
    >
      {children}
    </a>
  )
}
