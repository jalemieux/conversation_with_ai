# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Home      │  │ Review       │  │ Conversation │  │
│  │ /         │──▶ /review      │──▶ /conversation│  │
│  │           │  │              │  │ (parallel)   │  │
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
│  POST /api/augment      POST /api/conversation        │
│  POST /api/conversation/respond   POST /api/tts      │
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
| Orchestrator | `src/lib/orchestrator.ts` | Round 1 + Round 2 prompt builders, system prompt construction (essay mode, depth, word targets) |
| Types | `src/lib/types.ts` | Shared TypeScript interfaces |
| Export | `src/lib/export.ts` | Markdown, text, X-thread formatters |
| TTS Utils | `src/lib/tts.ts` | Voice mapping, markdown stripping, text chunking, `rewriteForAudio()` LLM rewrite, `REWRITE_SYSTEM_PROMPT` |
| TTS API Route | `src/app/api/tts/route.ts` | Proxy to OpenAI gpt-4o-mini-tts |
| useTTS Hook | `src/hooks/useTTS.ts` | Audio playback state management (toggle/stop/pause/seek/skip) with progress tracking |
| SpeakerButton | `src/components/SpeakerButton.tsx` | Speaker icon with idle/loading/playing/error states; green dot when audio is cached |
| AudioPlayer | `src/components/AudioPlayer.tsx` | Inline mini-player with play/pause, -10s/+10s skip, seekable progress bar, time display |
| Auth Utils | `src/lib/auth.ts` | HMAC token generation, password verification, timing-safe comparison |
| Auth Middleware | `src/middleware.ts` | Auth gate, checks cookie on all routes, redirects to /login if missing/invalid |
| Login Page | `src/app/login/page.tsx` | Password entry form |
| Auth API Route | `src/app/api/auth/route.ts` | Password validation endpoint, sets HttpOnly auth cookie |
| Respond Route | `src/app/api/conversation/respond/route.ts` | Per-model response generation with search/sources support |
| Auth Config | `src/lib/auth-config.ts` | NextAuth v5 config with Resend magic link, custom Drizzle adapter |
| Encryption | `src/lib/encryption.ts` | AES-256-GCM encrypt/decrypt for BYOK API keys |
| Access Check | `src/lib/access.ts` | Determines if user has access (subscription or BYOK keys) |
| User Access | `src/lib/user-access.ts` | Resolves available models based on user subscription/keys |
| Stripe Checkout | `src/app/api/stripe/checkout/route.ts` | Creates Stripe Checkout Session for subscription |
| Stripe Webhook | `src/app/api/stripe/webhook/route.ts` | Handles Stripe subscription lifecycle events |
| Stripe Portal | `src/app/api/stripe/portal/route.ts` | Creates Stripe Customer Portal session |
| Key Management | `src/app/api/keys/route.ts` | BYOK API key CRUD (encrypted storage) |
| User Info | `src/app/api/user/route.ts` | Returns user email, subscription status, configured providers |
| Setup Page | `src/app/setup/page.tsx` | Access gate — subscribe or add BYOK keys |
| Settings Page | `src/app/settings/page.tsx` | Account, subscription management, API key config |

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
4. POST /api/conversation → saves metadata, returns conversationId
5. Round 1: N parallel POST /api/conversation/respond calls (one per model) → generateText → responses appear as each model finishes
6. User clicks "Start Round 2" button (optional)
7. Round 2: N parallel POST /api/conversation/respond calls → each model reacts to Round 1 responses
8. Responses saved to SQLite after each model completes
8. User exports via clipboard
9. (Optional) User clicks speaker icon → useTTS hook fetches /api/tts → OpenAI TTS → audio playback
```

## TTS Flow

```
SpeakerButton (click) → useTTS.toggle()
  → POST /api/tts { text, model, conversationId, round }
    → sanitize conversationId (strip path traversal)
    → check cache: data/audio/{conversationId}/{round}-{model}.mp3
    → IF cached .mp3 → serve file from disk
    → ELSE:
      → check script cache: data/audio/{conversationId}/{round}-{model}.script.txt
      → IF cached .script.txt → use cached rewrite
      → ELSE IF conversationId present:
        → rewriteForAudio(text, model) — calls the same model to rewrite for spoken delivery
        → save to data/audio/{conversationId}/{round}-{model}.script.txt
        → on failure → fall back to original text
      → ELSE → stripMarkdown(text) (no rewrite when conversationId missing)
      → MODEL_VOICES[model] → voice
      → OpenAI gpt-4o-mini-tts (voice, input)
      → save to data/audio/{conversationId}/{round}-{model}.mp3
      → audio/mpeg response
  → HTMLAudioElement.play()
  → AudioPlayer renders inline mini-player in response card
    → play/pause, skip -10s/+10s, seekable progress bar, m:ss time display
```

Each AI model has a unique voice: Claude=coral, GPT=nova, Gemini=sage, Grok=ash. Only one response plays at a time (toggle behavior). Generated audio is cached on disk so replaying the same response does not re-call OpenAI. The SpeakerButton shows a green dot indicator when cached audio exists on the server.

## Conversation API Protocol

The conversation flow uses two endpoints instead of a single SSE stream:

| Endpoint | Method | Purpose | Returns |
|----------|--------|---------|---------|
| `/api/conversation` | POST | Save conversation metadata | `{ conversationId }` |
| `/api/conversation/respond` | POST | Generate one model's response for one round | `{ content, model, modelName, provider, modelId, round, sources }` |

The client fires N parallel `/api/conversation/respond` calls per round (one per model). Each call uses `generateText()` from Vercel AI SDK and returns the full response when complete. Round 2 is optional and user-triggered via a "Start Round 2" button.

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

**Decision:** Extract all behavioural meta-instructions into `buildSystemPrompt()` in `orchestrator.ts`. The route handler always passes `system: buildSystemPrompt(round, essayMode)` to each `generateText` call. The user prompt carries only topic content; the system message carries behavioural directives. The `essayMode` flag controls only the prose-style portion — base guidance (think deeply, word counts, R2 directness) is always included.

**Consequences:**
- Behavioural instructions are invisible to users — cleaner review page
- Single source of truth for prose style, depth, and word targets
- System prompt is always present — toggling essay mode off no longer strips all guidance
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

### ADR-003: LLM Rewrite Step for Read-Aloud Audio

**Status:** Accepted

**Context:** Raw model responses contain markdown formatting, lists, headers, and written-style constructions that sound unnatural when spoken by TTS. Simply stripping markdown leaves text that is technically speakable but reads like an essay rather than spoken narration.

**Decision:** Before sending text to OpenAI TTS, call the same model that wrote the response to rewrite it for spoken delivery via `rewriteForAudio()`. The rewrite prompt (`REWRITE_SYSTEM_PROMPT`) instructs the model to convert written prose into natural speech — removing visual formatting, expanding abbreviations, and restructuring for listening. Rewritten scripts are cached as `.script.txt` files alongside the audio `.mp3`. If the rewrite call fails, the pipeline falls back to the original stripped-markdown text. When no `conversationId` is provided, rewriting is skipped entirely.

**Consequences:**
- Audio sounds natural and conversational rather than like someone reading an essay aloud
- Two-layer cache (script + audio) avoids redundant LLM calls on TTS retries
- Graceful fallback means TTS never breaks due to a rewrite failure
- Using the same model preserves the voice and personality of the original response
- Additional LLM call adds latency on first play (mitigated by caching)

### ADR-004: Monetization Architecture

**Decision:** Magic link auth (NextAuth + Resend), $20/mo Stripe subscription, and BYOK (Bring Your Own Keys) with AES-256-GCM encryption.

**Rationale:**
- Magic links eliminate password management complexity
- Flat-rate subscription is simplest to implement and reason about
- BYOK lets power users avoid subscription while covering their own API costs
- AES-256-GCM is industry-standard authenticated encryption for key storage
- SQLite stays as the database — no need for Postgres at current scale

**Access model:** Users must have either an active subscription (uses platform API keys) or at least one BYOK key. BYOK keys are resolved first, falling back to platform keys for subscribers.

## Changelog

- 2026-02-26: Initial implementation — full conversation flow with 4 models, 2 rounds, SSE streaming, export
- 2026-02-26: Token-level streaming — switched from generateText to streamText, added token SSE events, real-time UI rendering with cursor indicator
- 2026-02-26: Multi-augmentation — generate all 5 topic type augmentations in one call, clickable tags on review page to switch between framings
- 2026-02-26: Text-to-Speech — on-demand TTS via OpenAI gpt-4o-mini-tts, unique voice per model, speaker button on all response cards
- 2026-02-26: System prompt module — extracted behavioural meta-instructions (prose style, deep thinking, current knowledge, word targets) into dedicated system messages, invisible to users
- 2026-02-26: Auth gate — shared password protection with HMAC cookie, middleware redirect, login page
- 2026-02-27: Essay mode toggle — boolean toggle on review page (default: on) controls whether system prompts are applied; flows as query param through conversation page to API route
- 2026-02-27: Optional Round 2 — replaced SSE stream with parallel per-model fetch calls via new `/api/conversation/respond` endpoint; Round 2 is now user-triggered via button click; preserved search/sources support
- 2026-02-28: TTS audio caching + inline player — generated audio cached to `data/audio/{conversationId}/{round}-{model}.mp3` (cache-first, no re-generation on replay); new AudioPlayer component with play/pause, skip -10s/+10s, seekable progress bar, time display; SpeakerButton shows green dot when cached; useTTS hook extended with pauseToggle, skipForward, skipBack, seek, and progress tracking
- 2026-02-28: Read-aloud rewriting — `rewriteForAudio()` calls the original model to rewrite responses for spoken delivery before TTS; rewritten scripts cached as `.script.txt`; graceful fallback to original text on failure; skipped when no conversationId
- 2026-03-01: Fold system-prompt into orchestrator — merged `system-prompt.ts` into `orchestrator.ts`; system prompt is now always passed (essay mode only controls prose style, not entire system guidance); deleted standalone module

### 2026-03-05 — Monetization: Auth, Stripe, BYOK
- Added magic link authentication via NextAuth + Resend (replaces password gate)
- Added $20/mo Stripe subscription with checkout, webhooks, and customer portal
- Added BYOK (Bring Your Own Keys) with AES-256-GCM encrypted storage
- Added settings page with subscription management and API key configuration
- Added setup page as access gate for new users
- Model selector now filters by user's available providers
- Conversations are now associated with authenticated users
- TTS and conversation routes resolve BYOK keys per-user
