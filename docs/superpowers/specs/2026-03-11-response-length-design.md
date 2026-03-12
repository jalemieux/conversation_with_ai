# Response Length Presets

## Summary

Add a user-facing control on the review page that lets users choose how long they want AI responses to be. Three named presets — Brief, Standard, Detailed — inject word-range guidance into the system prompt sent to each model.

## Presets

| Preset | Round 1 Range | Round 2 Range | Description |
|--------|--------------|--------------|-------------|
| Brief | 200–400 words | 100–200 words | Quick takes |
| Standard | 600–800 words | 300–500 words | Moderate depth (note: today no word guidance is sent; this adds it) |
| Detailed | 1000–1500 words | 500–800 words | Deep dives |

## UI

A row of three toggle buttons on the review page (`src/app/review/page.tsx`), placed between the Essay Mode toggle and the Augmented Prompt textarea. Same visual style as the existing topic type buttons — pill-shaped with amber highlight for the selected option. Default selection: **Standard**.

## Data Flow

1. **Review page** stores selection as `responseLength` state (`'brief' | 'standard' | 'detailed'`), default `'standard'`
2. **`handleRun`** passes `responseLength` as a URL param to the conversation page
3. **Conversation page** passes `responseLength` to each `/api/conversation/respond` POST call
4. **`respond/route.ts`** reads `responseLength` from the request body and passes it to `buildSystemPrompt()`
5. **`buildSystemPrompt()` in `orchestrator.ts`** maps the preset to a word-range string and appends it to the system prompt (e.g., "Aim for roughly 200–400 words.")

## Changes by File

### `src/lib/orchestrator.ts`
- Define a `ResponseLength` type: `'brief' | 'standard' | 'detailed'`
- Add a lookup mapping each preset + round to a word-range string
- Update `buildSystemPrompt()` signature to accept `responseLength?: ResponseLength`
- Append the word-range instruction to the system prompt parts
- When `responseLength` is `undefined`, no word-range instruction is appended (preserves current behavior for any callers that omit it)
- Remove the commented-out `ROUND_1_ADDITIONS`, the unused `ROUND_2_ADDITIONS` constant, and the commented-out `parts.push` line — the new preset lookup replaces all of this

### `src/app/review/page.tsx`
- Add `responseLength` state (default `'standard'`)
- Render three preset buttons between Essay Mode and Augmented Prompt
- Pass `responseLength` in URL params via `handleRun`

### `src/app/api/conversation/respond/route.ts`
- Destructure `responseLength` from request body
- Pass it to `buildSystemPrompt()`

### `src/app/conversation/page.tsx`
- Read `responseLength` from URL params
- Include it in each `/api/conversation/respond` POST body
- Add `responseLength` to `callModel`'s `useCallback` dependency array

## What This Does Not Change

- No database schema changes — length is a prompt-time instruction
- No hard token limits — models self-regulate based on the system prompt
- No changes to augmentation, TTS, export, or cost calculation
