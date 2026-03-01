import { describe, it, expect } from 'vitest'
import { buildRound1Prompt, buildRound2Prompt, buildSystemPrompt } from './orchestrator'

describe('Conversation Orchestrator', () => {
  describe('buildRound1Prompt', () => {
    it('should format the augmented prompt for a model', () => {
      const prompt = buildRound1Prompt('Analyze the future of software...', 'Claude')
      expect(prompt).toContain('Analyze the future of software...')
    })
  })

  describe('buildSystemPrompt', () => {
    it('R1 + essayMode=true includes essay style and word count', () => {
      const result = buildSystemPrompt(1, true)
      expect(result).toContain('essay-style prose')
      expect(result).toContain('Think deeply')
      expect(result).toContain('800')
      expect(result).not.toContain('generic praise')
    })

    it('R1 + essayMode=false omits essay style but keeps guidance', () => {
      const result = buildSystemPrompt(1, false)
      expect(result).toContain('Think deeply')
      expect(result).toContain('800')
      expect(result).not.toContain('essay-style prose')
    })

    it('R2 + essayMode=true includes essay style and R2 guidance', () => {
      const result = buildSystemPrompt(2, true)
      expect(result).toContain('essay-style prose')
      expect(result).toContain('300')
      expect(result).toContain('generic praise')
      expect(result).not.toContain('800')
    })

    it('R2 + essayMode=false omits essay style but keeps R2 guidance', () => {
      const result = buildSystemPrompt(2, false)
      expect(result).toContain('300')
      expect(result).toContain('generic praise')
      expect(result).toContain('Think deeply')
      expect(result).not.toContain('essay-style prose')
    })
  })

  describe('buildRound2Prompt', () => {
    it('should include all other models responses', () => {
      const round1Responses = [
        { model: 'Claude', content: 'Claude says...' },
        { model: 'GPT-4', content: 'GPT-4 says...' },
        { model: 'Gemini', content: 'Gemini says...' },
        { model: 'Grok', content: 'Grok says...' },
      ]

      const prompt = buildRound2Prompt(
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

      const prompt = buildRound2Prompt(
        'Some topic',
        'Claude',
        round1Responses
      )

      expect(prompt).toContain('GPT-4')
    })
  })
})
