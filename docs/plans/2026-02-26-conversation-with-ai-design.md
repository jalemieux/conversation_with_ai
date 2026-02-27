# Conversation With AI — Design Document

## Problem

Sharing interesting ideas publicly is hard if you're not a strong writer. AI ghostwriting feels dishonest. Instead, act as a **moderator** of a roundtable discussion between frontier AI models — your contribution is the questions and editorial choices, the models speak for themselves.

## Solution

A web app where you type a topic/question and it automatically:

1. Polishes your input (grammar, clarity, keeps your voice)
2. Augments it with the right analytical framework (auto-detected)
3. Shows you the augmented prompt for review/edit
4. Sends it to 4 frontier models in parallel
5. Collects initial answers (Round 1)
6. Gives each model all other models' full responses to react to (Round 2)
7. Produces a clean, publishable conversation transcript

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Topic     │  │ Augmented    │  │ Conversation │  │
│  │ Input     │──▶ Prompt       │──▶ View         │  │
│  │ Form      │  │ Review/Edit  │  │ (streaming)  │  │
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
│  ┌──────────────┐    ┌───────────────────────────┐   │
│  │ Prompt       │    │ Conversation Orchestrator  │   │
│  │ Augmenter    │    │                           │   │
│  │              │    │  Round 1: Initial answers  │   │
│  │ - Classify   │    │  Round 2: Reactions        │   │
│  │   topic type │    │                           │   │
│  │ - Pick       │    │  Calls 4 providers in     │   │
│  │   framework  │    │  parallel per round       │   │
│  │ - Augment    │    └───────────────────────────┘   │
│  │ - Keep tight │                                    │
│  └──────────────┘    ┌───────────────────────────┐   │
│                      │ AI Provider Adapters      │   │
│                      │ (Vercel AI SDK)           │   │
│                      │ ┌───────┬───────┬───────┐ │   │
│                      │ │Claude │Gemini │ Grok  │ │   │
│                      │ ├───────┼───────┼───────┤ │   │
│                      │ │ GPT   │       │       │ │   │
│                      │ └───────┴───────┴───────┘ │   │
│                      └───────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## Conversation Flow

```
You type raw input
       │
       ▼
 1. AUGMENT — classify topic, pick framework, rewrite concisely
       │
       ▼
 2. REVIEW — show augmented prompt, [Edit] [Regenerate] [Run]
       │
       ▼
 3. ROUND 1 — same prompt → 4 models in parallel → initial answers
       │
       ▼
 4. ROUND 2 — each model sees all others' full Round 1 answers, reacts
       │
       ▼
 5. COMPOSE — assemble final transcript
       │
       ▼
 6. EXPORT — copy / markdown / X-thread format
```

## Prompt Augmenter

The augmenter auto-detects topic type and applies the appropriate analytical framework.

| Topic type | Framework | Example input |
|-----------|-----------|---------------|
| Prediction / future | Scenario analysis, 1st/2nd order effects | "Future of software" |
| Opinion / valuation | Steel man vs straw man | "SaaS is oversold" |
| Comparison | Strongest case for each side | "Rust vs Go" |
| Trend analysis | Timeline framing, recent context | "AI agent adoption" |
| Open question | Multiple angles, trade-offs | "Should we regulate AI?" |

### Augmenter principles

- Add structure (framework, depth) but not fluff
- Keep it concise — add at most 1-2 sentences of structure
- Preserve the user's nuance and framing
- Don't over-constrain models with too many sub-questions

### Augmenter implementation

Uses Claude Haiku — fast (~200ms), cheap, sufficient for classification + rewrite.

## Data Model

SQLite database with two tables:

```
conversations
├─ id            (text, PK, uuid)
├─ created_at    (text, ISO timestamp)
├─ raw_input     (text)
├─ augmented_prompt (text)
├─ topic_type    (text)
├─ framework     (text)
└─ models        (text, JSON array)

responses
├─ id              (text, PK, uuid)
├─ conversation_id (text, FK → conversations.id)
├─ round           (integer, 1 or 2)
├─ model           (text)
└─ content         (text)
```

## UI

Three screens:

1. **Home** — text area for topic input, model selector, recent conversations list
2. **Review Prompt** — shows polished input + augmented prompt, edit/regenerate/run
3. **Conversation** — streams all model responses in parallel, round 1 then round 2, export options

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js (App Router) | Single codebase, API routes, streaming |
| DB | SQLite via better-sqlite3 | Simple, zero config, file-based |
| ORM | Drizzle | Lightweight, type-safe, good SQLite support |
| AI SDKs | Vercel AI SDK | Unified interface for all 4 providers |
| Styling | Tailwind CSS | Fast, clean defaults |
| Augmenter model | Claude Haiku | Fast, cheap for classification + rewrite |

## V2 Candidates (not in scope)

- Audio generation (text-to-speech with different voices per model)
- User accounts
- Conversation search
- More models / custom model selection
- Sharing links
