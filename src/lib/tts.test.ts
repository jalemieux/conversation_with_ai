import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MODEL_VOICES,
  stripMarkdown,
  chunkText,
  REWRITE_SYSTEM_PROMPT,
  rewriteForAudio,
} from './tts'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@/lib/models', () => ({
  getModelProvider: vi.fn(),
}))

import { generateText } from 'ai'
import { getModelProvider } from '@/lib/models'

const mockGenerateText = vi.mocked(generateText)
const mockGetModelProvider = vi.mocked(getModelProvider)

describe('REWRITE_SYSTEM_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(REWRITE_SYSTEM_PROMPT).toBeTruthy()
    expect(typeof REWRITE_SYSTEM_PROMPT).toBe('string')
  })

  it('should instruct to preserve substance and tone', () => {
    expect(REWRITE_SYSTEM_PROMPT).toMatch(/preserve/i)
  })

  it('should instruct to output plain text only', () => {
    expect(REWRITE_SYSTEM_PROMPT).toMatch(/no markdown/i)
  })
})

describe('rewriteForAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call generateText with the correct model and prompt', async () => {
    const mockModel = {} as any
    mockGetModelProvider.mockReturnValue(mockModel)
    mockGenerateText.mockResolvedValue({ text: 'rewritten text' } as any)

    const result = await rewriteForAudio('original text', 'claude')

    expect(mockGetModelProvider).toHaveBeenCalledWith('claude')
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: mockModel,
        system: REWRITE_SYSTEM_PROMPT,
        prompt: 'original text',
      })
    )
    expect(result).toBe('rewritten text')
  })

  it('should not pass providerOptions (no thinking/reasoning)', async () => {
    const mockModel = {} as any
    mockGetModelProvider.mockReturnValue(mockModel)
    mockGenerateText.mockResolvedValue({ text: 'rewritten' } as any)

    await rewriteForAudio('text', 'gpt')

    const callArgs = mockGenerateText.mock.calls[0][0]
    expect(callArgs).not.toHaveProperty('providerOptions')
    expect(callArgs).not.toHaveProperty('tools')
  })

  it('should propagate errors from generateText', async () => {
    const mockModel = {} as any
    mockGetModelProvider.mockReturnValue(mockModel)
    mockGenerateText.mockRejectedValue(new Error('Model error'))

    await expect(rewriteForAudio('text', 'claude')).rejects.toThrow('Model error')
  })
})

describe('MODEL_VOICES', () => {
  it('should have a voice for each model', () => {
    expect(MODEL_VOICES.claude).toBe('coral')
    expect(MODEL_VOICES.gpt).toBe('nova')
    expect(MODEL_VOICES.gemini).toBe('sage')
    expect(MODEL_VOICES.grok).toBe('ash')
  })

  it('should have exactly 4 voice mappings', () => {
    expect(Object.keys(MODEL_VOICES)).toHaveLength(4)
  })
})

describe('stripMarkdown', () => {
  it('should remove heading markers', () => {
    expect(stripMarkdown('# Hello')).toBe('Hello')
    expect(stripMarkdown('## Sub heading')).toBe('Sub heading')
    expect(stripMarkdown('### Deep heading')).toBe('Deep heading')
  })

  it('should remove bold and italic markers', () => {
    expect(stripMarkdown('**bold text**')).toBe('bold text')
    expect(stripMarkdown('*italic text*')).toBe('italic text')
    expect(stripMarkdown('__bold__')).toBe('bold')
    expect(stripMarkdown('_italic_')).toBe('italic')
  })

  it('should remove link syntax but keep text', () => {
    expect(stripMarkdown('[click here](https://example.com)')).toBe('click here')
  })

  it('should remove image syntax', () => {
    expect(stripMarkdown('![alt text](image.png)')).toBe('alt text')
  })

  it('should remove inline code backticks', () => {
    expect(stripMarkdown('use `console.log`')).toBe('use console.log')
  })

  it('should remove code block fences', () => {
    expect(stripMarkdown('```javascript\nconst x = 1\n```')).toBe('const x = 1')
  })

  it('should remove bullet markers', () => {
    expect(stripMarkdown('- item one\n- item two')).toBe('item one\nitem two')
    expect(stripMarkdown('* item one')).toBe('item one')
  })

  it('should remove numbered list markers', () => {
    expect(stripMarkdown('1. first\n2. second')).toBe('first\nsecond')
  })

  it('should remove blockquote markers', () => {
    expect(stripMarkdown('> quoted text')).toBe('quoted text')
  })

  it('should remove horizontal rules', () => {
    expect(stripMarkdown('---')).toBe('')
    expect(stripMarkdown('***')).toBe('')
  })

  it('should handle mixed markdown', () => {
    const input = '## **Bold Heading**\n\n- Item with `code`\n- [Link](url)'
    const result = stripMarkdown(input)
    expect(result).toBe('Bold Heading\n\nItem with code\nLink')
  })

  it('should collapse multiple blank lines', () => {
    expect(stripMarkdown('line one\n\n\n\nline two')).toBe('line one\n\nline two')
  })
})

describe('chunkText', () => {
  it('should return single chunk for short text', () => {
    const text = 'Hello world.'
    expect(chunkText(text, 4096)).toEqual(['Hello world.'])
  })

  it('should split at sentence boundaries', () => {
    const sentence = 'A'.repeat(2050) + '. '
    const text = sentence + 'B'.repeat(100) + '.'
    const chunks = chunkText(text, 4096)
    expect(chunks.length).toBe(1) // fits in one chunk
  })

  it('should split long text into multiple chunks', () => {
    // Create text with multiple sentences that exceeds limit
    const sentences = Array.from({ length: 50 }, (_, i) => `Sentence number ${i} has some content here.`)
    const text = sentences.join(' ')
    const chunks = chunkText(text, 200)
    expect(chunks.length).toBeGreaterThan(1)
    // Each chunk should be within limit (with some tolerance for sentence boundaries)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(250) // some tolerance
    }
    // Joined chunks should reconstruct original
    expect(chunks.join(' ')).toBe(text)
  })

  it('should not split mid-sentence', () => {
    const text = 'First sentence. Second sentence. Third sentence.'
    const chunks = chunkText(text, 30)
    for (const chunk of chunks) {
      // Each chunk should end with a period (complete sentence)
      expect(chunk.trimEnd()).toMatch(/\.$/)
    }
  })
})
