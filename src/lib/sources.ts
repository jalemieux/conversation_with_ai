export interface Source {
  url: string
  title: string
}

export async function extractSources(result: { sources: Promise<unknown[]> }): Promise<Source[]> {
  try {
    const raw = await result.sources
    const urlSources = raw
      .filter((s: any) => s.sourceType === 'url' && s.url)
      .map((s: any) => ({ url: s.url, title: s.title ?? '' }))

    // Deduplicate by URL
    const seen = new Set<string>()
    return urlSources.filter((s) => {
      if (seen.has(s.url)) return false
      seen.add(s.url)
      return true
    })
  } catch {
    return []
  }
}
