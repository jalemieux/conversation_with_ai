import { describe, it, expect, vi, beforeEach } from 'vitest'
import { braveSearch } from './brave-search'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('braveSearch', () => {
  beforeEach(() => {
    vi.stubEnv('CWAI_BRAVE_API_KEY', 'test-key')
    mockFetch.mockReset()
  })

  it('should call Brave API and return simplified results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: 'Article One', url: 'https://example.com/one', description: 'First result' },
            { title: 'Article Two', url: 'https://example.com/two', description: 'Second result' },
          ],
        },
      }),
    })

    const results = await braveSearch('test query')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.search.brave.com/res/v1/web/search?q=test+query&count=5',
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': 'test-key',
        },
      }
    )
    expect(results).toEqual([
      { title: 'Article One', url: 'https://example.com/one', description: 'First result' },
      { title: 'Article Two', url: 'https://example.com/two', description: 'Second result' },
    ])
  })

  it('should return empty array on API failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const results = await braveSearch('test query')

    expect(results).toEqual([])
  })

  it('should return empty array when no API key', async () => {
    vi.stubEnv('CWAI_BRAVE_API_KEY', '')

    const results = await braveSearch('test query')

    expect(results).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
