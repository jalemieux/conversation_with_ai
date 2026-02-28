# Text-to-Speech Design

## Overview

Add text-to-speech playback to AI roundtable responses using OpenAI's TTS API. Each model gets a unique voice, reinforcing the "distinct speakers" feel. A speaker icon in the collapsible header toggles playback on-demand.

## Decisions

- **Model**: `gpt-4o-mini-tts` — newest, supports instructions parameter
- **Trigger**: On-demand only (no pre-generation, no caching)
- **Playback**: Toggle — click to play, click again to stop. Only one response plays at a time.
- **Voices**: Each AI model gets a distinct voice

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│                                                     │
│  ResponseCard <summary>                             │
│  ● Claude  anthropic/claude-4-...  🔊              │
│         │ click                                      │
│         ▼                                            │
│  useTTS() hook  ──▶  Web Audio API (playback)       │
│         │ fetch                                      │
│         ▼                                            │
│  POST /api/tts  { text, model }                     │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  API Route: /api/tts                                │
│  - Strips markdown from text                        │
│  - Maps model → voice                              │
│  - Calls OpenAI TTS (streaming)                     │
│  - Returns audio/mpeg stream                        │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  OpenAI TTS API                                     │
│  Model: gpt-4o-mini-tts                             │
│  Format: mp3                                        │
└─────────────────────────────────────────────────────┘
```

## Components

| Component | Location | Purpose | Reusable? |
|-----------|----------|---------|-----------|
| `useTTS` hook | `src/hooks/useTTS.ts` | Manages playback state, fetching, Audio API | Yes |
| `SpeakerButton` | `src/components/SpeakerButton.tsx` | Icon with loading/playing/idle states | Yes |
| `/api/tts` route | `src/app/api/tts/route.ts` | Server-side TTS proxy | Yes |
| `MODEL_VOICES` | `src/lib/tts.ts` | Voice config + stripMarkdown util | Yes |

## Voice Mapping

| Model | Voice | Character |
|-------|-------|-----------|
| claude | coral | warm, measured |
| gpt | nova | bright, clear |
| gemini | sage | calm, thoughtful |
| grok | ash | direct, energetic |

## useTTS State Machine

```
idle ──click──▶ loading ──audio ready──▶ playing
 ▲                                         │
 └────────click or audio ends──────────────┘
```

- Tracks currently playing response by `round-model` key
- Clicking a new speaker stops the current one first
- Returns `{ playingKey, loadingKey, toggle(key, text, model) }`

## SpeakerButton States

- **Idle** — muted speaker icon, subtle hover
- **Loading** — small spinner (matches existing streaming style)
- **Playing** — speaker with sound waves, accent-colored

## API Route

```
POST /api/tts
Body: { text: string, model: string }
Response: audio/mpeg stream

Steps:
1. Validate input
2. Strip markdown (remove #, *, [], etc.)
3. Look up voice from MODEL_VOICES[model]
4. Call OpenAI TTS with instructions: "Read naturally, conversational tone"
5. Stream audio bytes back to client
```

## Error Handling

- **API failure** — SpeakerButton shows brief red flash, returns to idle
- **Long responses** — Chunk at sentence boundaries if >4096 chars, play sequentially
- **Double-click** — Debounced, second click during loading ignored
- **Browser autoplay** — Not an issue (user-initiated)
- **API key** — Reuses existing `CWAI_OPENAI_API_KEY`

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/hooks/useTTS.ts` |
| Create | `src/components/SpeakerButton.tsx` |
| Create | `src/app/api/tts/route.ts` |
| Create | `src/lib/tts.ts` |
| Modify | `src/app/conversation/page.tsx` |
| Modify | `src/app/conversation/[id]/page.tsx` |
| Create | Tests for all new files |

## Testing

- `useTTS` hook — mock fetch/Audio, verify state transitions
- `/api/tts` route — mock OpenAI client, verify markdown stripping, voice mapping, errors
- `stripMarkdown` — pure function, edge cases
- `SpeakerButton` — render states based on props
