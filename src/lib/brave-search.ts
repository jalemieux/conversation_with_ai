export interface BraveSearchResult {
  title: string
  url: string
  description: string
}

export async function braveSearch(query: string, count = 5): Promise<BraveSearchResult[]> {
  const apiKey = process.env.CWAI_BRAVE_API_KEY
  if (!apiKey) return []

  try {
    const params = new URLSearchParams({ q: query, count: String(count) })
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    })

    if (!res.ok) return []

    const data = await res.json()
    return (data.web?.results ?? []).map((r: { title: string; url: string; description: string }) => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }))
  } catch {
    return []
  }
}
