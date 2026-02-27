import { describe, it, expect } from 'vitest'
import { buildRound1Prompt, buildRound2Prompt } from './orchestrator'

describe('Conversation Orchestrator', () => {
  describe('buildRound1Prompt', () => {
    it('should format the augmented prompt for a model', () => {
      const prompt = buildRound1Prompt('Analyze the future of software...', 'Claude')
      expect(prompt).toContain('Analyze the future of software...')
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
