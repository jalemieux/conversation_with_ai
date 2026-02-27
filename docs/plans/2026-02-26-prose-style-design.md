# Prose Style Enforcement — Design

**Date:** 2026-02-26
**Status:** Approved

## Problem

LLM responses default to bullet-point/list-heavy formatting. We want essay-style prose — like The Economist or The Atlantic — as the default output form. Additionally, meta-instructions (think deeply, use current knowledge) are currently baked into the augmented prompt and visible to users; they should be invisible.

## Approach: System Message Layer

Introduce a `system` message in `streamText` calls. Move all behavioural meta-instructions into a dedicated system prompt module. The augmented prompt stays clean — topic framing only.

```
┌─────────────────────────────────────┐
│  system message (invisible to user) │
│  - Prose style directive            │
│  - Think deeply                     │
│  - Use up-to-date knowledge         │
│  - Length targets                   │
│  - Round-specific guidance          │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  user message (visible)             │
│  - Augmented topic prompt           │
└─────────────────────────────────────┘
```

## System Prompt Content

### Shared (both rounds)

> You are a participant in a published multi-model conversation. Write in flowing, essay-style prose — the kind you'd find in The Economist or The Atlantic. Develop your argument through connected paragraphs, not bullet points or numbered lists. You may occasionally use a brief structured element (a short comparison, a key enumeration) when it genuinely serves clarity, but the default mode is always discursive prose.
>
> Think deeply and carefully — the questions asked can be complex and nuanced. Draw on the most up-to-date knowledge available to you.

### Round 1 additions

> Aim for roughly 800–1200 words.

### Round 2 additions

> Be direct and substantive — avoid generic praise. Aim for roughly 300–500 words.

## Files Changed

| File | Action |
|------|--------|
| `src/lib/system-prompt.ts` | **New** — `buildSystemPrompt(round, modelName)` |
| `src/lib/augmenter.ts` | **Edit** — Remove meta-instruction lines from principles |
| `src/lib/orchestrator.ts` | **Edit** — Remove behavioural directives from Round 2 prompt |
| `src/app/api/conversation/route.ts` | **Edit** — Add `system` param to both `streamText` calls |

## Design Decisions

- **Prose enforcement strength:** Strong preference, not absolute. Occasional structured elements allowed when they genuinely serve clarity.
- **Scope:** Both Round 1 and Round 2.
- **Injection point:** System message (idiomatic, clean separation of concerns).
- **Visibility:** Meta-instructions are invisible to users — only the augmented topic prompt is shown.
