# Streaming LLM Responses — Design

**Date**: 2026-02-26
**Status**: Approved

## Problem

LLM responses currently use `generateText()` which waits for full completion before displaying anything. Users see no output until an entire model response is ready, creating a poor experience especially with 4 models generating 1500-token responses.

## Decision

Switch discussion model calls from `generateText()` to `streamText()` (Vercel AI SDK). Stream tokens to the frontend via a new `token` SSE event. Save to DB after full completion. Augmentation (Claude Haiku) remains non-streaming.

## Architecture

```
Backend (route.ts)                        Frontend (page.tsx)
──────────────────                        ───────────────────
For each model (parallel):                State:
  streamText()                              streamingResponses Map
    │                                         key: "${round}-${model}"
    ├─ chunk ──► SSE event:token ──────►    append chunk to entry
    │            {round,model,chunk}         re-render card
    │
    └─ complete ──► accumulate text
                    DB insert
                    SSE event:response ──►  move to responses[]
                    {round,model,content}    (final text)
```

## SSE Protocol

| Event | When | Data |
|-------|------|------|
| `round_start` | Round begins | `{round}` |
| `token` | Each text chunk (NEW) | `{round, model, modelName, chunk}` |
| `response` | Model completes | `{round, model, modelName, content}` |
| `round_complete` | All models done | `{round}` |
| `done` | Finished | `{conversationId}` |
| `error` | On failure | `{message}` |

## Scope

**Changed**:
- `src/app/api/conversation/route.ts` — `streamText()` + `token` events
- `src/app/conversation/page.tsx` — streaming state + `token` handler + render partial

**Unchanged**: DB schema, augmentation, orchestrator, export, all existing tests.

## Constraints

- Augmentation stays non-streaming (quick classification, not user-visible)
- DB save happens after full completion (no partial data)
- All 4 models stream in parallel
- `response` event still fires with full content for backwards compatibility
