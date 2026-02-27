import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../system-prompt'

describe('buildSystemPrompt', () => {
  it('returns prose style directive for round 1', () => {
    const result = buildSystemPrompt(1)
    expect(result).toContain('essay-style prose')
    expect(result).toContain('Think deeply')
    expect(result).toContain('up-to-date knowledge')
    expect(result).toContain('800')
    expect(result).not.toContain('generic praise')
  })

  it('returns prose style directive for round 2', () => {
    const result = buildSystemPrompt(2)
    expect(result).toContain('essay-style prose')
    expect(result).toContain('Think deeply')
    expect(result).toContain('300')
    expect(result).toContain('generic praise')
    expect(result).not.toContain('800')
  })
})
