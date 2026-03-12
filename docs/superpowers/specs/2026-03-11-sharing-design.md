# Sharing Conversations

## Problem
Users want to share conversations with anyone via a link.

## Design

### Approach
Make the existing `/conversation/[id]` URL publicly accessible. The conversation UUID serves as the access key — no new tables, tokens, or share toggles needed. All conversations are shareable by default.

### API Changes

**`GET /api/conversations/[id]`**
- Remove auth requirement for GET requests
- Return conversation data regardless of auth status
- DELETE remains auth-protected (owner only)

### UI Changes

**`/conversation/[id]/page.tsx`**

Detect whether the viewer is the conversation owner:

- **Owner**: Current full experience (delete, export, TTS, etc.)
- **Non-owner / not logged in**: Read-only view with:
  - Same conversation layout (both rounds, all model responses, sources)
  - Export buttons (copy markdown/text/thread) remain visible — they're read-only
  - TTS hidden (costs API calls)
  - Delete button hidden
  - CTA banner encouraging sign-up

### CTA Banner

Displayed for non-owners. Copy:

> "Explore complex questions from different angles. AI helps you frame the right question, then every frontier model responds and they critique each other's answers."

With a "Try it" or "Get started" button linking to `/login`.

### What's Not Included
- No privacy toggle (can add later)
- No share view analytics
- No new database tables or columns
