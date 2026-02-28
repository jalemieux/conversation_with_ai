# Delete Conversation from Front Page

## Summary

Add ability to delete conversations from the home page's "Recent Conversations" list via an always-visible trash icon on each card.

## Architecture

```
┌─────────────────────┐     DELETE /api/conversations/[id]     ┌──────────┐
│  Home Page (page.tsx)│ ──────────────────────────────────────►│  SQLite  │
│                      │                                        │          │
│  [card] [card] [🗑️]  │◄─────────── 204 No Content ───────────│  DELETE   │
│                      │     optimistic UI removes card         │  cascade │
└─────────────────────┘                                        └──────────┘
```

## Components

### 1. API Route — `DELETE /api/conversations/[id]`

- Deletes responses first, then conversation record
- Returns 204 on success, 404 if not found

### 2. Frontend — Trash icon on each conversation card

- Small trash icon on right side of each card
- `stopPropagation` to prevent navigation when clicking delete
- `window.confirm()` for confirmation
- Optimistic removal from `recent` state
- Re-fetch list on error to restore

## Data Flow

```
User clicks 🗑️ → confirm dialog → DELETE /api/conversations/{id}
                                  → Remove from `recent` state (optimistic)
                                  → DB: DELETE responses WHERE conversation_id = id
                                  → DB: DELETE conversations WHERE id = id
```
