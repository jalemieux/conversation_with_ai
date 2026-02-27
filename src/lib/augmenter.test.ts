import { describe, it, expect } from 'vitest'
import { buildAugmenterPrompt, parseAugmenterResponse, parseMultiAugmenterResponse, TOPIC_TYPES, type MultiAugmenterResult } from './augmenter'

describe('augmenter types', () => {
  it('exports TOPIC_TYPES with all 5 types', () => {
    expect(TOPIC_TYPES).toEqual([
      'prediction', 'opinion', 'comparison', 'trend_analysis', 'open_question',
    ])
  })

  it('MultiAugmenterResult has correct shape', () => {
    const result: MultiAugmenterResult = {
      recommended: 'prediction',
      augmentations: {
        prediction: { framework: 'scenario analysis', augmentedPrompt: 'test' },
        opinion: { framework: 'steel man vs straw man', augmentedPrompt: 'test' },
        comparison: { framework: 'strongest case', augmentedPrompt: 'test' },
        trend_analysis: { framework: 'timeline framing', augmentedPrompt: 'test' },
        open_question: { framework: 'multiple angles', augmentedPrompt: 'test' },
      },
    }
    expect(result.recommended).toBe('prediction')
    expect(Object.keys(result.augmentations)).toHaveLength(5)
  })
})

describe('Prompt Augmenter', () => {
  describe('buildAugmenterPrompt', () => {
    it('should create a system prompt for topic classification and augmentation', () => {
      const prompt = buildAugmenterPrompt('Future of software')
      expect(prompt).toContain('Future of software')
      expect(prompt).toContain('recommended')
      expect(prompt).toContain('framework')
      expect(prompt).toContain('augmented_prompt')
    })

    it('asks for all 5 topic types in JSON output', () => {
      const prompt = buildAugmenterPrompt('SaaS stocks are oversold')
      expect(prompt).toContain('prediction')
      expect(prompt).toContain('opinion')
      expect(prompt).toContain('comparison')
      expect(prompt).toContain('trend_analysis')
      expect(prompt).toContain('open_question')
      expect(prompt).toContain('recommended')
      expect(prompt).toContain('SaaS stocks are oversold')
    })
  })

  describe('parseAugmenterResponse', () => {
    it('should parse a valid JSON response', () => {
      const json = JSON.stringify({
        topic_type: 'prediction',
        framework: 'scenario_analysis',
        augmented_prompt: 'Analyze the future of software engineering...',
      })

      const result = parseAugmenterResponse(json)
      expect(result.topicType).toBe('prediction')
      expect(result.framework).toBe('scenario_analysis')
      expect(result.augmentedPrompt).toContain('future of software')
    })

    it('should handle JSON wrapped in markdown code blocks', () => {
      const wrapped = '```json\n{"topic_type":"comparison","framework":"strongest_case","augmented_prompt":"Compare Rust and Go..."}\n```'
      const result = parseAugmenterResponse(wrapped)
      expect(result.topicType).toBe('comparison')
    })

    it('should throw on invalid JSON', () => {
      expect(() => parseAugmenterResponse('not json')).toThrow()
    })
  })

  describe('parseMultiAugmenterResponse', () => {
    it('parses valid JSON response', () => {
      const json = JSON.stringify({
        recommended: 'prediction',
        augmentations: {
          prediction: { framework: 'scenario analysis', augmented_prompt: 'pred prompt' },
          opinion: { framework: 'steel man', augmented_prompt: 'opinion prompt' },
          comparison: { framework: 'strongest case', augmented_prompt: 'comp prompt' },
          trend_analysis: { framework: 'timeline', augmented_prompt: 'trend prompt' },
          open_question: { framework: 'multiple angles', augmented_prompt: 'open prompt' },
        },
      })
      const result = parseMultiAugmenterResponse(json)
      expect(result.recommended).toBe('prediction')
      expect(result.augmentations.prediction.augmentedPrompt).toBe('pred prompt')
      expect(result.augmentations.prediction.framework).toBe('scenario analysis')
      expect(Object.keys(result.augmentations)).toHaveLength(5)
    })

    it('handles markdown-wrapped JSON', () => {
      const json = '```json\n' + JSON.stringify({
        recommended: 'opinion',
        augmentations: {
          prediction: { framework: 'f', augmented_prompt: 'p' },
          opinion: { framework: 'f', augmented_prompt: 'p' },
          comparison: { framework: 'f', augmented_prompt: 'p' },
          trend_analysis: { framework: 'f', augmented_prompt: 'p' },
          open_question: { framework: 'f', augmented_prompt: 'p' },
        },
      }) + '\n```'
      const result = parseMultiAugmenterResponse(json)
      expect(result.recommended).toBe('opinion')
    })
  })
})
