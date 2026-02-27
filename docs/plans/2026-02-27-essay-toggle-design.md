# Essay Mode Toggle — Design

**Date:** 2026-02-27
**Status:** Approved

## Problem

The essay-style prose enforcement is always on. Users should be able to toggle it off on the Review Prompt page before generating a conversation.

## Approach

Pass `essayMode` as a query parameter through the existing flow: Review page toggle → query param → conversation page → API body → route handler conditionally applies system prompt.

## Data Flow

```
Review page                    Conversation page              API route
┌──────────────┐              ┌──────────────────┐           ┌─────────────────┐
│ essayMode     │──query──────│ reads essayMode   │──POST────│ reads essayMode  │
│ toggle (bool) │  param      │ from URL params   │  body    │ conditionally    │
└──────────────┘              └──────────────────┘           │ adds system msg  │
                                                              └─────────────────┘
```

## Behaviour

- Default: ON (essay mode enabled)
- When ON: `system: buildSystemPrompt(round)` passed to `streamText`
- When OFF: no `system` param passed to `streamText`
- Not persisted across sessions — resets to ON each visit
- Setting applies before generation only; once generated, no change

## Files Changed

| File | Change |
|------|--------|
| `src/app/review/page.tsx` | Add toggle state + UI, include `essayMode` in query params |
| `src/app/conversation/page.tsx` | Read `essayMode` from URL, pass to API |
| `src/app/api/conversation/route.ts` | Read `essayMode` from body, conditionally pass `system` to `streamText` |

## UI Placement

Toggle placed on the Review Prompt page between the Topic Type selector and the Augmented Prompt textarea. Simple labeled toggle — "Essay mode" — defaulting to ON.
