import { describe, it, expect } from 'vitest'
import {
  AugmentRequestSchema,
  UpdateConversationSchema,
  RespondRequestSchema,
} from './validation'

describe('AugmentRequestSchema', () => {
  it('accepts valid input', () => {
    const result = AugmentRequestSchema.safeParse({ rawInput: 'Will AI replace jobs?' })
    expect(result.success).toBe(true)
  })

  it('rejects empty string', () => {
    const result = AugmentRequestSchema.safeParse({ rawInput: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects missing rawInput', () => {
    const result = AugmentRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('UpdateConversationSchema', () => {
  it('accepts valid update', () => {
    const result = UpdateConversationSchema.safeParse({
      selectedType: 'prediction',
      augmentedPrompt: 'some prompt',
      models: ['claude', 'gpt'],
      essayMode: true,
      responseLength: 'standard',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid responseLength', () => {
    const result = UpdateConversationSchema.safeParse({
      selectedType: 'prediction',
      augmentedPrompt: 'prompt',
      models: ['claude'],
      essayMode: false,
      responseLength: 'enormous',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty models array', () => {
    const result = UpdateConversationSchema.safeParse({
      selectedType: 'prediction',
      augmentedPrompt: 'prompt',
      models: [],
      essayMode: false,
      responseLength: 'standard',
    })
    expect(result.success).toBe(false)
  })
})

describe('RespondRequestSchema', () => {
  it('accepts valid request', () => {
    const result = RespondRequestSchema.safeParse({
      conversationId: 'abc-123',
      model: 'claude',
      round: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects round 3', () => {
    const result = RespondRequestSchema.safeParse({
      conversationId: 'abc-123',
      model: 'claude',
      round: 3,
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional essayMode and responseLength', () => {
    const result = RespondRequestSchema.safeParse({
      conversationId: 'abc-123',
      model: 'claude',
      round: 1,
      essayMode: true,
      responseLength: 'detailed',
    })
    expect(result.success).toBe(true)
  })
})
