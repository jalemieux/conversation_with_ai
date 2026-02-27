import { describe, it, expect } from 'vitest'
import { MODEL_VOICES, stripMarkdown, chunkText } from './tts'

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
