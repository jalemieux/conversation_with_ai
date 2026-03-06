import { describe, it, expect } from 'vitest'
import { hasAccess } from '../access'

describe('hasAccess', () => {
  it('returns true if user has active subscription', () => {
    expect(hasAccess({ subscriptionStatus: 'active', hasKeys: false })).toBe(true)
  })

  it('returns true if user has BYOK keys', () => {
    expect(hasAccess({ subscriptionStatus: 'none', hasKeys: true })).toBe(true)
  })

  it('returns false if user has neither', () => {
    expect(hasAccess({ subscriptionStatus: 'none', hasKeys: false })).toBe(false)
  })

  it('returns true if subscription is active even without keys', () => {
    expect(hasAccess({ subscriptionStatus: 'active', hasKeys: false })).toBe(true)
  })

  it('returns false for canceled subscription without keys', () => {
    expect(hasAccess({ subscriptionStatus: 'canceled', hasKeys: false })).toBe(false)
  })
})
