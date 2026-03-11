import { describe, it, expect } from 'vitest'
import { buildUserPrompt, buildSystemPrompt } from './orchestrator'

describe('Conversation Orchestrator', () => {
  describe('buildUserPrompt (round 1 — no R1 responses)', () => {
    it('should return the augmented prompt directly', () => {
      const prompt = buildUserPrompt('Analyze the future of software...', 'Claude')
      expect(prompt).toContain('Analyze the future of software...')
    })
  })

  describe('buildSystemPrompt', () => {
    it('R1 + essayMode=true includes essay style', () => {
      const result = buildSystemPrompt(1, true)
      expect(result).toContain('essay-style prose')
      expect(result).toContain('Think deeply')
    })

    it('R1 + essayMode=false omits essay style but keeps base guidance', () => {
      const result = buildSystemPrompt(1, false)
      expect(result).toContain('Think deeply')
      expect(result).not.toContain('essay-style prose')
    })

    it('R2 + essayMode=true includes essay style', () => {
      const result = buildSystemPrompt(2, true)
      expect(result).toContain('essay-style prose')
      expect(result).toContain('Think deeply')
    })

    it('R2 + essayMode=false omits essay style but keeps base guidance', () => {
      const result = buildSystemPrompt(2, false)
      expect(result).toContain('Think deeply')
      expect(result).not.toContain('essay-style prose')
    })
  })

  describe('buildUserPrompt (round 2 — with R1 responses)', () => {
    it('should include all other models responses', () => {
      const round1Responses = [
        { model: 'Claude', content: 'Claude says...' },
        { model: 'GPT-4', content: 'GPT-4 says...' },
        { model: 'Gemini', content: 'Gemini says...' },
        { model: 'Grok', content: 'Grok says...' },
      ]

      const prompt = buildUserPrompt(
        'Analyze the future of software...',
        'Claude',
        round1Responses
      )

      expect(prompt).toContain('Claude')
      expect(prompt).toContain('GPT-4 says...')
      expect(prompt).toContain('Gemini says...')
      expect(prompt).toContain('Grok says...')
    })

    it('should not include the current model in "other responses"', () => {
      const round1Responses = [
        { model: 'Claude', content: 'Claude says...' },
        { model: 'GPT-4', content: 'GPT-4 says...' },
      ]

      const prompt = buildUserPrompt(
        'Some topic',
        'Claude',
        round1Responses
      )

      expect(prompt).toContain('GPT-4')
    })
  })
})
