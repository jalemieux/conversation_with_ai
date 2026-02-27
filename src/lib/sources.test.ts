import { describe, it, expect } from 'vitest'
import { extractSources, type Source } from './sources'

describe('extractSources', () => {
  it('should extract URL sources from result.sources', async () => {
    const mockResult = {
      sources: Promise.resolve([
        { sourceType: 'url', url: 'https://example.com/a', title: 'Article A' },
        { sourceType: 'url', url: 'https://example.com/b', title: 'Article B' },
      ]),
    }

    const sources = await extractSources(mockResult as any)
    expect(sources).toEqual([
      { url: 'https://example.com/a', title: 'Article A' },
      { url: 'https://example.com/b', title: 'Article B' },
    ])
  })

  it('should deduplicate by URL', async () => {
    const mockResult = {
      sources: Promise.resolve([
        { sourceType: 'url', url: 'https://example.com/a', title: 'Article A' },
        { sourceType: 'url', url: 'https://example.com/a', title: 'Article A duplicate' },
      ]),
    }

    const sources = await extractSources(mockResult as any)
    expect(sources).toHaveLength(1)
    expect(sources[0].url).toBe('https://example.com/a')
  })

  it('should return empty array when no sources', async () => {
    const mockResult = {
      sources: Promise.resolve([]),
    }

    const sources = await extractSources(mockResult as any)
    expect(sources).toEqual([])
  })

  it('should return empty array when sources rejects', async () => {
    const mockResult = {
      sources: Promise.reject(new Error('no sources')),
    }

    const sources = await extractSources(mockResult as any)
    expect(sources).toEqual([])
  })

  it('should filter out non-URL source types', async () => {
    const mockResult = {
      sources: Promise.resolve([
        { sourceType: 'url', url: 'https://example.com/a', title: 'A' },
        { sourceType: 'other', data: 'something' },
      ]),
    }

    const sources = await extractSources(mockResult as any)
    expect(sources).toHaveLength(1)
  })
})
