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
│  POST /api/tts                                       │
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
| System Prompt | `src/lib/system-prompt.ts` | Builds invisible system messages for LLM calls (prose style, depth, word targets) |
| Types | `src/lib/types.ts` | Shared TypeScript interfaces |
| Export | `src/lib/export.ts` | Markdown, text, X-thread formatters |
| TTS Utils | `src/lib/tts.ts` | Voice mapping, markdown stripping, text chunking |
| TTS API Route | `src/app/api/tts/route.ts` | Proxy to OpenAI gpt-4o-mini-tts |
| useTTS Hook | `src/hooks/useTTS.ts` | Audio playback state management (toggle/stop) |
| SpeakerButton | `src/components/SpeakerButton.tsx` | Speaker icon with idle/loading/playing/error states |
| Auth Utils | `src/lib/auth.ts` | HMAC token generation, password verification, timing-safe comparison |
| Auth Middleware | `src/middleware.ts` | Auth gate, checks cookie on all routes, redirects to /login if missing/invalid |
| Login Page | `src/app/login/page.tsx` | Password entry form |
| Auth API Route | `src/app/api/auth/route.ts` | Password validation endpoint, sets HttpOnly auth cookie |

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
3. User reviews augmented prompt → Review page (clickable topic type tags, essay mode toggle)
4. POST /api/conversation (includes essayMode boolean) → SSE stream begins
5. Round 1: if essayMode, buildSystemPrompt(1) + user prompt → streamText(system, prompt) → 4 models in parallel
6. Round 2: if essayMode, buildSystemPrompt(2) + reaction prompt → streamText(system, prompt) → 4 models in parallel
7. Responses saved to SQLite after each model completes
8. User exports via clipboard
9. (Optional) User clicks speaker icon → useTTS hook fetches /api/tts → OpenAI TTS → audio playback
```

## TTS Flow

```
SpeakerButton (click) → useTTS.toggle()
  → POST /api/tts { text, model }
    → stripMarkdown(text)
    → MODEL_VOICES[model] → voice
    → OpenAI gpt-4o-mini-tts (voice, input)
    → audio/mpeg response
  → HTMLAudioElement.play()
```

Each AI model has a unique voice: Claude=coral, GPT=nova, Gemini=sage, Grok=ash. Only one response plays at a time (toggle behavior).

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

## ADRs

### ADR-001: System messages for behavioural meta-instructions

**Status:** Accepted

**Context:** Behavioural instructions (essay-style prose, think deeply, use current knowledge, word-count targets) were previously embedded directly in the augmented user prompt and the Round 2 orchestrator prompt. This made them visible to users on the review page and tangled formatting concerns with content concerns.

**Decision:** Extract all behavioural meta-instructions into a dedicated `system-prompt.ts` module. The route handler passes `system: buildSystemPrompt(round)` to each `streamText` call. The user prompt carries only topic content; the system message carries only behavioural directives.

**Consequences:**
- Behavioural instructions are invisible to users — cleaner review page
- Single source of truth for prose style, depth, and word targets
- User prompt and system prompt are independently testable and editable
- Round-specific additions (word counts) are isolated in one place

### ADR-002: Shared Password Gate

**Status:** Accepted

**Context:** The app uses API keys for multiple AI providers. Deploying without access control would let anyone with the URL consume those keys. Need a simple mechanism to prevent unauthorized usage.

**Decision:** Implement a shared password gate using a single `CWAI_ACCESS_PASSWORD` environment variable. On login, the server verifies the password and sets an HMAC-signed HttpOnly cookie. Middleware checks this cookie on every request and redirects unauthenticated users to `/login`.

**Consequences:**
- Single env var — no database changes, no user management, no OAuth setup
- HMAC cookie is tamper-proof and HttpOnly (not accessible to client JS)
- Timing-safe comparison prevents timing attacks on password verification
- Easy to upgrade to per-user auth later without changing the middleware contract

## Changelog

- 2026-02-26: Initial implementation — full conversation flow with 4 models, 2 rounds, SSE streaming, export
- 2026-02-26: Token-level streaming — switched from generateText to streamText, added token SSE events, real-time UI rendering with cursor indicator
- 2026-02-26: Multi-augmentation — generate all 5 topic type augmentations in one call, clickable tags on review page to switch between framings
- 2026-02-26: Text-to-Speech — on-demand TTS via OpenAI gpt-4o-mini-tts, unique voice per model, speaker button on all response cards
- 2026-02-26: System prompt module — extracted behavioural meta-instructions (prose style, deep thinking, current knowledge, word targets) into dedicated system messages, invisible to users
- 2026-02-26: Auth gate — shared password protection with HMAC cookie, middleware redirect, login page
- 2026-02-27: Essay mode toggle — boolean toggle on review page (default: on) controls whether system prompts are applied; flows as query param through conversation page to API route
