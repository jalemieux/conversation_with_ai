# Multi-Augmentation Prompt Selection

## Problem

The augmenter currently picks a single topic type and generates one augmented prompt. Users have no control over which analytical framing is applied to their input.

## Solution

Generate augmented prompts for all 5 topic types in a single Haiku call. Display them as clickable tags on the review page so the user can pick the framing they want.

## Design

### Augmenter Changes (`src/lib/augmenter.ts`)

Modify `buildAugmenterPrompt` to request all 5 augmented prompts. New response shape:

```json
{
  "recommended": "prediction",
  "augmentations": {
    "prediction":     { "framework": "...", "augmented_prompt": "..." },
    "opinion":        { "framework": "...", "augmented_prompt": "..." },
    "comparison":     { "framework": "...", "augmented_prompt": "..." },
    "trend_analysis": { "framework": "...", "augmented_prompt": "..." },
    "open_question":  { "framework": "...", "augmented_prompt": "..." }
  }
}
```

- `recommended` indicates which type best fits the input (used as default selection)
- `maxOutputTokens` bumps from 500 to ~2000
- Update `parseAugmenterResponse` for new shape

### API Route Changes (`src/app/api/augment/route.ts`)

Pass through the new response shape. Returns:

```json
{
  "rawInput": "...",
  "recommended": "prediction",
  "augmentations": { ... }
}
```

### Review Page Changes (`src/app/review/page.tsx`)

- All 5 topic type tags are always visible and clickable
- `recommended` type is pre-selected on load
- Clicking a tag swaps the textarea content to that type's augmented prompt and updates the framework badge
- If user has edited the textarea, show `confirm()` dialog before switching (edits would be lost)
- Selected tag gets a filled/highlighted visual state; unselected tags get outline style
- Regenerate re-fetches all 5 augmentations, keeps current tag selection

### Data Flow

```
Home → POST /api/augment → returns all 5 augmentations + recommended
     → Redirect to /review with augmentations as JSON param
     → User picks tag, optionally edits prompt
     → /conversation receives single: augmentedPrompt, topicType, framework
```

### Unchanged

- Conversation page, orchestrator, conversation API, models, database schema — no changes needed. The review page still passes a single selected prompt downstream.

### URL Params

- `augmentations`: JSON-encoded string (~1-2KB, within URL limits)
- `recommended`: replaces old `topicType` param
- `framework`: removed from top level (now per-augmentation)

## Risks

- **Forced framings may be lower quality** — e.g. "comparison" when there's nothing to compare. Acceptable; user just won't pick those.
- **Larger Haiku response** — increases chance of malformed JSON. Mitigated by bumping `maxOutputTokens` and keeping strict JSON format.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/augmenter.ts` | New prompt template, new response shape, updated parser |
| `src/app/api/augment/route.ts` | Pass through new shape |
| `src/app/review/page.tsx` | Clickable tags, swap prompt on selection, confirm on edit loss |
