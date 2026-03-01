# Token & Cost Tracking Per Response

## Overview

Track input/output tokens and calculate cost for each model response. Display compactly in the ResponseCard summary line.

## Data Flow

```
generateText() → result.usage { promptTokens, completionTokens, totalTokens }
    → calculate cost using pricing config
    → save to DB (prompt_tokens, completion_tokens, cost)
    → return in API response
    → display in ResponseCard summary line
```

## Changes

### 1. Pricing Config (`src/lib/models.ts`)

Add `pricing` to `ModelConfig`:

```typescript
pricing: { inputPerMTok: number; outputPerMTok: number }
```

Prices per model (USD per million tokens):

| Model | Input | Output |
|-------|-------|--------|
| Claude Opus 4 | 15 | 75 |
| GPT 5.1 | 10 | 30 |
| Gemini 3.1 Pro | 2.50 | 15 |
| Grok 4.1 Fast | 3 | 15 |

### 2. DB Schema (`src/db/schema.ts`)

Add three nullable columns to `responses`:

- `prompt_tokens` INTEGER
- `completion_tokens` INTEGER
- `cost` REAL

Migration via check-and-add pattern in `src/db/index.ts`.

### 3. API Route (`src/app/api/conversation/respond/route.ts`)

- Capture `result.usage` from `generateText()`
- Calculate cost: `(promptTokens * inputPerMTok + completionTokens * outputPerMTok) / 1_000_000`
- Save tokens + cost to DB
- Return `usage: { promptTokens, completionTokens, totalTokens, cost }` in JSON response

### 4. Types (`src/lib/types.ts`)

Add to `ConversationResponse`:

```typescript
usage?: { promptTokens: number; completionTokens: number; totalTokens: number; cost: number }
```

### 5. Frontend (`src/app/conversation/page.tsx`)

Add `usage` to `ModelResponse` interface. Display in ResponseCard summary line next to provider info:

```
● Claude  anthropic/claude-opus-4-6  1.2k↑ 856↓ $0.04
```

- Numbers > 1000 abbreviated (1.2k, 15.4k)
- Styled `text-ink-faint` to stay unobtrusive
- Format: `{input}↑ {output}↓ ${cost}`

### 6. History page (`src/app/conversations/[id]/page.tsx`)

Same display — load usage from DB via the GET endpoint.

## Not in Scope

- Running totals / cost dashboard
- Augmentation call token tracking
- TTS cost tracking
- Historical price change tracking
