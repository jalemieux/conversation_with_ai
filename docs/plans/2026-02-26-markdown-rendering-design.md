# Markdown Rendering for AI Responses

**Date**: 2026-02-26
**Status**: Approved

## Problem

AI responses render as plain text with `whitespace-pre-wrap`. Markdown syntax (`**bold**`, `# headings`, code blocks, etc.) appears as literal characters instead of formatted content.

## Decision

Use `react-markdown` + `remark-gfm` with Tailwind `@tailwindcss/typography` prose classes to render AI responses as formatted markdown. User messages remain plain text.

## Architecture

```
┌─────────────────────────────────────┐
│  MarkdownContent component          │
│  (src/components/MarkdownContent)   │
│                                     │
│  react-markdown + remark-gfm        │
│  Tailwind prose prose-invert        │
└──────────┬──────────┬───────────────┘
           │          │
    ┌──────┘          └──────┐
    ▼                        ▼
 conversation/           conversation/
 page.tsx                [id]/page.tsx
 (streaming view)        (history view)
```

## Changes

### New dependencies
- `react-markdown` — markdown to React renderer
- `remark-gfm` — GitHub Flavored Markdown support
- `@tailwindcss/typography` — Tailwind prose classes

### New files
- `src/components/MarkdownContent.tsx` — shared component wrapping react-markdown

### Modified files
- `src/app/globals.css` — import typography plugin
- `src/app/conversation/page.tsx` — swap plain text divs for MarkdownContent (4 sites: round1, round2, streaming1, streaming2)
- `src/app/conversation/[id]/page.tsx` — swap plain text divs for MarkdownContent (2 sites: round1, round2)

## Scope

- AI responses only — user messages stay as plain text
- No syntax highlighting for code blocks (can add later)
