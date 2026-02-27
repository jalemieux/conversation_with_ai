# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Home      │  │ Review       │  │ Conversation │  │
│  │ /         │──▶ /review      │──▶ /conversation│  │
│  │           │  │              │  │ (streaming)  │  │
│  └───────────┘  └──────────────┘  └──────┬──────┘  │
│                                          │         │
│                                   ┌──────▼──────┐  │
│                                   │ Export       │  │
│                                   │ (MD/text/X)  │  │
│                                   └─────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  API ROUTES                          │
│                                                      │
│  POST /api/augment      POST /api/conversation       │
│  GET /api/conversations  GET /api/conversations/[id]  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ AI Provider Adapters (Vercel AI SDK)         │   │
│  │ Claude │ GPT-4 │ Gemini │ Grok              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ SQLite Database (Drizzle ORM)                │   │
│  │ conversations │ responses                    │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## Components

| Component | Path | Purpose |
|-----------|------|---------|
| DB Schema | `src/db/schema.ts` | Drizzle table definitions |
| DB Singleton | `src/db/index.ts` | SQLite connection + table creation |
| Model Config | `src/lib/models.ts` | 4 AI provider configurations |
| Augmenter | `src/lib/augmenter.ts` | Multi-augmentation: generates all 5 topic framings + prompt rewriting |
| Orchestrator | `src/lib/orchestrator.ts` | Round 1 + Round 2 prompt builders |
| Types | `src/lib/types.ts` | Shared TypeScript interfaces |
| Export | `src/lib/export.ts` | Markdown, text, X-thread formatters |

## Augmenter Types

```typescript
AugmentationEntry    { framework, augmentedPrompt }
AugmentationsMap     Record<TopicType, AugmentationEntry>  // all 5 framings
MultiAugmenterResult { recommended: TopicType, augmentations: AugmentationsMap }
```

The `/api/augment` route returns a `MultiAugmenterResult` — all 5 topic type augmentations in a single Haiku call. The review page renders clickable tags for each type; clicking a tag swaps the textarea content. The selected augmentation is passed downstream to the conversation API.

## Data Flow

```
1. User types topic → Home page
2. POST /api/augment → Claude Haiku generates all 5 augmentations + recommends best fit
3. User reviews augmented prompt → Review page (clickable topic type tags)
4. POST /api/conversation → SSE stream begins
5. Round 1: 4 models stream responses in parallel (token-by-token)
6. Round 2: 4 models stream reactions in parallel (token-by-token)
7. Responses saved to SQLite after each model completes
8. User exports via clipboard
```

## SSE Protocol

| Event | When | Data |
|-------|------|------|
| `round_start` | Round begins | `{round}` |
| `token` | Each text chunk from a model | `{round, model, modelName, chunk}` |
| `response` | Model completes streaming | `{round, model, modelName, content}` |
| `round_complete` | All models done for round | `{round}` |
| `done` | Everything finished | `{conversationId}` |
| `error` | On failure | `{message}` |

The backend uses `streamText()` from Vercel AI SDK to iterate over `textStream`, sending `token` events per chunk. The frontend accumulates chunks per model in a Map and renders partial text with a pulsing cursor indicator.

## Data Model

```sql
conversations
├── id              TEXT PK (uuid)
├── created_at      TEXT (ISO timestamp)
├── raw_input       TEXT
├── augmented_prompt TEXT
├── topic_type      TEXT
├── framework       TEXT
└── models          TEXT (JSON array)

responses
├── id              TEXT PK (uuid)
├── conversation_id TEXT FK → conversations.id
├── round           INTEGER (1 or 2)
├── model           TEXT
└── content         TEXT
```

## Changelog

- 2026-02-26: Initial implementation — full conversation flow with 4 models, 2 rounds, SSE streaming, export
- 2026-02-26: Token-level streaming — switched from generateText to streamText, added token SSE events, real-time UI rendering with cursor indicator
- 2026-02-26: Multi-augmentation — generate all 5 topic type augmentations in one call, clickable tags on review page to switch between framings
