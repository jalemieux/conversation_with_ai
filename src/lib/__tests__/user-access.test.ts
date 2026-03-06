import { describe, it, expect } from 'vitest'
import { getAvailableModelKeys } from '../user-access'

describe('getAvailableModelKeys', () => {
  it('returns all models for subscribed user', () => {
    const result = getAvailableModelKeys('active', [])
    expect(result).toEqual(['claude', 'gpt', 'gemini', 'grok'])
  })

  it('returns only keyed models for BYOK user', () => {
    const result = getAvailableModelKeys('none', ['anthropic', 'openai'])
    expect(result).toEqual(['claude', 'gpt'])
  })

  it('returns empty for user with no access', () => {
    const result = getAvailableModelKeys('none', [])
    expect(result).toEqual([])
  })

  it('returns all models for subscriber even with some keys', () => {
    const result = getAvailableModelKeys('active', ['anthropic'])
    expect(result).toEqual(['claude', 'gpt', 'gemini', 'grok'])
  })
})
