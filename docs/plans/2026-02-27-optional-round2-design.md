# Optional Round 2 with Parallel Model Calls

## Date: 2026-02-27

## Problem

Round 2 fires automatically after Round 1 completes. Users should be able to read Round 1 responses and decide whether to trigger Round 2.

## Approach: Split into parallel per-model fetch calls

Replace the single SSE stream with individual per-model API calls fired in parallel from the client.

## API Design

### `POST /api/conversation`

Saves conversation metadata only. No model calls.

```
Body: { rawInput, augmentedPrompt, topicType, framework, models, essayMode }
Returns: { conversationId }
```

### `POST /api/conversation/respond`

Calls a single model for a single round. Reused for both rounds.

```
Body: { conversationId, model, round, essayMode }
Returns: { content, model, modelName, provider, modelId, round }
```

For round=2: fetches Round 1 responses from DB to build the Round 2 prompt.

## Client Flow

```
1. POST /api/conversation → get conversationId
2. Fire N parallel calls: POST /api/conversation/respond (round=1)
3. Each resolves independently → card flips from spinner to content
4. All complete → show "Start Round 2" button + export buttons
5. User clicks "Start Round 2"
6. Fire N parallel calls: POST /api/conversation/respond (round=2)
7. Each resolves independently → Round 2 cards appear
8. All complete → final state with export buttons
```

## UI States

- Per-model loading: each card shows spinner until its fetch resolves
- Per-model errors: if one model fails, others continue; error shown on that card
- Round 1 complete: "Start Round 2" button appears alongside export buttons
- Round 2 complete: "Start Round 2" disappears, full export buttons shown

## What Changes

- `POST /api/conversation/route.ts` — simplified to save metadata + return ID
- New `POST /api/conversation/respond/route.ts` — single-model call endpoint
- `conversation/page.tsx` — replace SSE with parallel fetches + per-model state

## What Stays the Same

- `orchestrator.ts` — `buildRound1Prompt` and `buildRound2Prompt` reused
- `system-prompt.ts` — reused
- `conversation/[id]/page.tsx` — no changes
- DB schema — no changes
