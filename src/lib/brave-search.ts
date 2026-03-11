export interface BraveSearchResult {
  title: string
  url: string
  description: string
}

// Serialize Brave API calls to respect rate limits (free tier: 1 req/sec)
const MIN_INTERVAL_MS = 1100
let queue: Promise<void> = Promise.resolve()

function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    queue = queue.then(async () => {
      try {
        const res = await fetch(url, options)
        resolve(res)
      } catch (err) {
        reject(err)
      }
      await new Promise(r => setTimeout(r, MIN_INTERVAL_MS))
    })
  })
}

export async function braveSearch(query: string, count = 5): Promise<BraveSearchResult[]> {
  const apiKey = process.env.CWAI_BRAVE_API_KEY
  if (!apiKey) return []

  try {
    const params = new URLSearchParams({ q: query, count: String(count) })
    const res = await rateLimitedFetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    })

    if (!res.ok) {
      console.warn(`[brave-search] HTTP ${res.status} for query: "${query}"`)
      return []
    }

    const data = await res.json()
    return (data.web?.results ?? []).map((r: { title: string; url: string; description: string }) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }))
  } catch (err) {
    console.warn(`[brave-search] Error for query "${query}":`, err instanceof Error ? err.message : err)
    return []
  }
}
