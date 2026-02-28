# TTS Audio Caching + Inline Mini-Player Design

**Date:** 2026-02-28
**Status:** Approved

## Problem

Currently, every click on the speaker button regenerates audio via the OpenAI TTS API. This is wasteful (costs money, adds latency) and provides no way to rewind/seek within the audio.

## Solution

Two changes:
1. **Server-side audio caching** — save generated MP3 files to disk, serve cached files on subsequent requests
2. **Inline mini-player** — replace the simple speaker button with a player UI when audio is loaded

## 1. Server-Side Audio Cache

### Storage Layout

```
data/audio/{conversationId}/{round}-{model}.mp3
```

Example:
```
data/
├── conversations.db
└── audio/
    ├── abc123/
    │   ├── 1-claude.mp3
    │   ├── 1-gpt.mp3
    │   └── 2-claude.mp3
    └── def456/
        ├── 1-gemini.mp3
        └── 1-grok.mp3
```

### API Changes

**POST `/api/tts`** — Updated request body:
```typescript
{
  text: string
  model: string
  conversationId: string  // NEW
  round: number           // NEW
}
```

**Flow:**
1. Compute cache path: `data/audio/{conversationId}/{round}-{model}.mp3`
2. If file exists → read from disk, return as `audio/mpeg`
3. If not → call OpenAI TTS API, save to disk, return as `audio/mpeg`

```
┌─────────┐  POST /api/tts   ┌──────────┐  cache miss  ┌──────────┐
│ Client  │ ───────────────→ │ API Route│ ──────────→  │ OpenAI   │
│         │ ←─── audio/mpeg  │          │ ←── mp3 ──── │ TTS API  │
└─────────┘                  │  ┌─────┐ │              └──────────┘
                             │  │disk │ │
                             │  │cache│ │ ← save + serve
                             │  └─────┘ │
                             └──────────┘
```

### Cache Key

`{conversationId}/{round}-{model}` — maps 1:1 to the `responses` table schema (conversationId + round + model uniquely identifies a response).

## 2. Inline Mini-Player

### State Flow

```
Speaker Button (idle)
    │ click
    ▼
Speaker Button (loading spinner)
    │ audio ready
    ▼
┌──────────────────────────────────────────┐
│  ⏪10s   ▶⏸   10s⏩   ──●───── 1:23/3:45 │
└──────────────────────────────────────────┘
    │ click ⏸ or audio ends
    ▼
Speaker Button (idle, cached indicator)
```

### Controls

| Control | Action |
|---------|--------|
| Play/Pause | Toggle playback |
| -10s | `audio.currentTime -= 10` |
| +10s | `audio.currentTime += 10` |
| Progress bar | Click/drag to seek |
| Time display | Shows `current / total` |

### Component Structure

```
ResponseCard
├── <summary>
│   ├── Model name, score, etc.
│   └── SpeakerButton (handles initial click, shows cached indicator)
└── <details body>
    ├── AudioPlayer (visible when audio loaded)
    │   ├── SkipBackButton (-10s)
    │   ├── PlayPauseButton
    │   ├── SkipForwardButton (+10s)
    │   ├── ProgressBar (seekable)
    │   └── TimeDisplay
    └── Markdown content
```

### Behavior

- `AudioPlayer` appears inline at the top of the response card body
- Speaker button shows a subtle dot/indicator when audio is cached on server
- Clicking speaker when cached → instant playback (no API call, no loading spinner for generation)
- Progress bar updates via `timeupdate` event on HTMLAudioElement
- When audio ends, player stays visible (paused at end) so user can replay/seek back
- Clicking speaker button while player is visible → stops and hides player

### Hook Changes (`useTTS`)

- Store audio Blob URL per key in a Map (session-level client cache)
- Add `currentTime`, `duration` state for progress tracking
- Add `seek(time)`, `skipBack()`, `skipForward()` methods
- Accept `conversationId` and `round` params in `toggle()`
- Track which keys have server-side cache (optional: check via HEAD request or flag from initial load)

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/tts/route.ts` | Add caching logic, accept conversationId/round |
| `src/hooks/useTTS.ts` | Add seek/skip, progress tracking, client blob cache |
| `src/components/SpeakerButton.tsx` | Add cached indicator |
| `src/components/AudioPlayer.tsx` | **NEW** — inline mini-player |
| `src/app/conversation/page.tsx` | Pass conversationId/round to TTS, render AudioPlayer |
| `src/app/conversation/[id]/page.tsx` | Same integration |
| `.gitignore` | Add `data/audio/` |

## Testing

- Unit tests for cache hit/miss logic in API route
- Unit tests for useTTS hook (seek, skip, progress)
- Component tests for AudioPlayer (controls, state transitions)
- Integration: verify cached file is served without OpenAI call
