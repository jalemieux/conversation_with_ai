# Read-Aloud Text Rewriting for TTS

## Problem

Response text is optimized for reading (lists, headers, markdown structure) but sounds stilted when read aloud by TTS. We need an LLM rewriting pass that transforms responses into natural spoken-word form while preserving substance, nuance, and tone.

## Design Decisions

- **Approach**: LLM rewrite step inside the existing `/api/tts` route (Approach A — single request, server-side pipeline)
- **Length**: Same length as original — restructure, don't summarize
- **Timing**: Lazy — rewrite on first speaker click, then cache
- **Model**: Same model that wrote the response (Claude rewrites Claude, GPT rewrites GPT, etc.)
- **Storage**: Filesystem (`data/audio/{conversationId}/{round}-{model}.script.txt`) — stored but not visible in UI
- **Client impact**: None — API contract unchanged

## Pipeline Flow

```
POST /api/tts { text, model, conversationId, round }
  │
  ├─ 1. Check audio cache (.mp3) → HIT → return MP3
  │
  ├─ 2. Check script cache (.script.txt) → HIT → use cached rewrite
  │     OR
  │     Call original model to rewrite text for audio
  │     Save rewritten text to .script.txt
  │
  ├─ 3. stripMarkdown(rewrittenText)  ← safety net for residual formatting
  │
  ├─ 4. OpenAI TTS → MP3
  │
  └─ 5. Cache MP3 to disk → return MP3
```

## Rewrite Prompt Design

System prompt instructs the model to:
- Preserve all substance, nuance, and tone
- Same length as original — don't summarize or cut
- Remove structural artifacts (bullet points, numbered lists, headers) — weave into flowing prose
- Replace visual references ("as shown above", "the following list") with spoken transitions
- Spell out abbreviations on first use
- Convert parenthetical asides into natural spoken digressions
- Keep the model's personality/voice intact
- Output pure plain text — no markdown

Model is called via `getModelProvider(modelKey)` without thinking/reasoning options and without search tools.

## Storage & Caching

```
data/audio/{conversationId}/
  ├── 1-claude.mp3          ← existing audio cache
  ├── 1-claude.script.txt   ← new: rewritten text
  ├── 1-gpt.mp3
  ├── 1-gpt.script.txt
  └── ...
```

Cache check order:
1. Audio MP3 exists → return immediately (fastest)
2. Script .txt exists → skip LLM rewrite, go straight to TTS
3. Neither → LLM rewrite → save script → TTS → save audio

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/tts/route.ts` | Add rewrite step between cache check and TTS generation. Import `getModelProvider` and `generateText`. Add script cache read/write. |
| `src/lib/tts.ts` | Add `REWRITE_SYSTEM_PROMPT` constant and `rewriteForAudio(text, modelKey)` function. |

No changes to: client code, database schema, or `src/lib/models.ts`.
