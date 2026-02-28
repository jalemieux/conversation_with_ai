# Delete Conversation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to delete conversations from the home page via a trash icon on each card.

**Architecture:** Add a DELETE handler to the existing `[id]` API route, then add a trash icon button to each conversation card in `page.tsx` with optimistic removal.

**Tech Stack:** Next.js App Router, Drizzle ORM, SQLite

---

### Task 1: Add DELETE handler to API route

**Files:**
- Modify: `src/app/api/conversations/[id]/route.ts`

**Step 1: Add the DELETE export**

Add this function to the existing route file (which already has GET):

```typescript
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const conv = await db.select().from(conversations).where(eq(conversations.id, id))
  if (conv.length === 0) {
    return new Response(null, { status: 404 })
  }

  await db.delete(responses).where(eq(responses.conversationId, id))
  await db.delete(conversations).where(eq(conversations.id, id))

  return new Response(null, { status: 204 })
}
```

Note: `db`, `conversations`, `responses`, `eq` are already imported in this file.

**Step 2: Verify manually**

Run: `curl -X DELETE http://localhost:3000/api/conversations/nonexistent-id -v`
Expected: 404 response

**Step 3: Commit**

```bash
git add src/app/api/conversations/\[id\]/route.ts
git commit -m "feat: add DELETE endpoint for conversations"
```

---

### Task 2: Add trash icon to conversation cards

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add delete handler function**

Inside the `Home` component, after `handleSubmit`, add:

```typescript
const handleDelete = async (e: React.MouseEvent, id: string) => {
  e.preventDefault()
  e.stopPropagation()
  if (!confirm('Delete this conversation?')) return

  setRecent((prev) => prev.filter((c) => c.id !== id))

  try {
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error()
  } catch {
    // Re-fetch to restore on failure
    fetch('/api/conversations')
      .then((r) => r.json())
      .then(setRecent)
      .catch(() => {})
  }
}
```

**Step 2: Add trash icon button to each card**

In the conversation card's `<a>` element, after the date `<span>`, add a delete button:

```tsx
<button
  onClick={(e) => handleDelete(e, conv.id)}
  className="p-1.5 rounded-md text-ink-faint/0 group-hover:text-ink-faint hover:!text-red-400 hover:bg-red-50 transition-all duration-200 flex-shrink-0"
  aria-label="Delete conversation"
>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
  </svg>
</button>
```

The icon is invisible by default (`text-ink-faint/0`) and fades in on card hover (`group-hover:text-ink-faint`), turning red on direct hover.

**Step 3: Verify manually**

- Hover over a conversation card — trash icon should appear
- Click trash icon — confirm dialog appears
- Confirm — card disappears from list

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add delete button to conversation cards"
```
