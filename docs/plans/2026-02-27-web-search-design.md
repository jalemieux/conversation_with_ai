# Web Search & Citations Design

## Goal

Add web search grounding to Round 1 model responses so that:
1. Models use live web data for more accurate, up-to-date answers
2. Readers see footnoted source citations below each response

## Architecture

```
                         Round 1 (with web search)
                         ─────────────────────────
┌─────────┐
│ Claude   │──► custom braveSearch tool ──► Brave API ──► sources[]
├─────────┤
│ GPT      │──► openai.tools.webSearch()  (built-in)  ──► sources[]
├─────────┤
│ Gemini   │──► google.tools.googleSearch() (built-in) ──► sources[]
├─────────┤
│ Grok     │──► providerOptions.xai.searchParameters   ──► sources[]
└─────────┘
                              │
                              ▼
                    Unified sources[] per model
                              │
                              ▼
                    ┌──────────────────┐
                    │ Footnotes UI     │
                    │ [1] url, title   │
                    │ [2] url, title   │
                    └──────────────────┘
```

- GPT, Gemini, Grok use native provider-executed search (zero extra infra)
- Claude gets a custom Brave Search tool via AI SDK `tool()` definition
- All 4 paths produce the same `sources[]` shape for the UI
- Search only in Round 1; Round 2 inherits context from Round 1 responses
- One new env var: `CWAI_BRAVE_API_KEY`

## Search Configuration Per Model

**Grok** — providerOptions:
```ts
providerOptions: {
  xai: {
    searchParameters: { mode: 'auto', returnCitations: true },
  },
}
```

**GPT** — provider-executed tool:
```ts
tools: {
  web_search: openai.tools.webSearch({ searchContextSize: 'medium' }),
}
```

**Gemini** — provider-executed tool:
```ts
tools: {
  google_search: google.tools.googleSearch({}),
}
```

**Claude** — custom client-executed tool:
```ts
tools: {
  web_search: tool({
    description: 'Search the web for current information',
    parameters: z.object({ query: z.string() }),
    execute: async ({ query }) => {
      // Call Brave Search API, return results
    },
  }),
}
```

Note: GPT/Gemini/Grok tools are provider-executed (server-side). Claude's Brave tool is client-executed (our server calls Brave, returns results to Claude). Claude may take slightly longer due to the extra round-trip.

## Data Flow & Sources Normalization

Common shape:
```ts
interface Source {
  url: string
  title: string
}
```

Extraction:
- GPT/Gemini/Grok: `result.sources` → `{ url, title }[]`
- Claude: Brave search tool results → `{ url, title }[]`

Storage:
- New nullable `sources` text column on `responses` table (JSON stringified)
- Included in `response` SSE event

## Frontend: Footnotes UI

```
┌─────────────────────────────────────────────┐
│ Claude                                       │
│                                              │
│ [essay-style prose response text...]         │
│                                              │
│ ─────────────────────────────────────────── │
│ Sources                                      │
│ [1] The Atlantic — atlantic.com/article...   │
│ [2] Reuters — reuters.com/world/...          │
└─────────────────────────────────────────────┘
```

- Only shown when `sources.length > 0`
- Clickable links (open in new tab)
- Deduplicated by URL
- Compact: title + domain

## Error Handling

Search is best-effort. If it fails, the model responds without web grounding.

- **Brave API down/timeout** — Claude responds from training data, `sources: []`
- **Provider search fails** — Same fallback, respond without sources
- **Rate limits** — Degrade gracefully (no sources, no crash)
- **No `CWAI_BRAVE_API_KEY`** — Claude's search tool not included; other models still search

No retry logic. No circuit breakers.

## Changes Summary

| Area | Change |
|------|--------|
| `src/lib/models.ts` | Add search config per model |
| New: `src/lib/brave-search.ts` | Brave Search API client + custom AI SDK tool |
| `src/app/api/conversation/route.ts` | Wire up search tools in Round 1, extract sources, include in SSE events |
| `src/db/schema.ts` | Add nullable `sources` column to `responses` table |
| New migration | Add `sources` column |
| Frontend response component | Render footnotes when sources exist |
| `.env` | New `CWAI_BRAVE_API_KEY` |
| `package.json` | Add `brave-search` dependency |

**Not changing:** Round 2, augmentation pipeline, TTS, system prompts.
