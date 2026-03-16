const GA_MEASUREMENT_ID = 'G-4WBHPXNRST'

type EventParams = Record<string, string | number | boolean | undefined>

function getGtag(): ((...args: unknown[]) => void) | null {
  if (typeof window === 'undefined') return null
  if (process.env.NODE_ENV === 'development') return null
  return (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag ?? null
}

export function trackEvent(name: string, params?: EventParams): void {
  const gtag = getGtag()
  if (!gtag) return
  gtag('event', name, params)
}

export function identifyUser(
  hashedUserId: string,
  properties: {
    subscription_status: string
    has_byok_keys: boolean
    account_age_days: number
  }
): void {
  const gtag = getGtag()
  if (!gtag) return
  gtag('config', GA_MEASUREMENT_ID, { user_id: hashedUserId })
  gtag('set', 'user_properties', properties)
}

export function trackLandingVariant(variant: string): void {
  trackEvent('landing_view', { variant })
  try {
    sessionStorage.setItem('landing_variant', variant)
  } catch {
    // sessionStorage unavailable
  }
}

export function getLandingVariant(): string | null {
  try {
    return sessionStorage.getItem('landing_variant')
  } catch {
    return null
  }
}
