# Markdown Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render AI responses as formatted markdown instead of plain text.

**Architecture:** A shared `MarkdownContent` component wraps `react-markdown` with `remark-gfm` and Tailwind prose classes. Both conversation pages swap their plain-text divs for this component.

**Tech Stack:** react-markdown, remark-gfm, @tailwindcss/typography, Tailwind v4

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run: `npm install react-markdown remark-gfm @tailwindcss/typography`

**Step 2: Verify installation**

Run: `npm ls react-markdown remark-gfm @tailwindcss/typography`
Expected: All three packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown, remark-gfm, and tailwind typography"
```

---

### Task 2: Import typography plugin in CSS

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add typography import**

Update `src/app/globals.css` to:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "chore: import tailwind typography plugin"
```

---

### Task 3: Create MarkdownContent component

**Files:**
- Create: `src/components/MarkdownContent.tsx`

**Step 1: Create the component**

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-blockquote:my-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
```

Note: `max-w-none` prevents prose from constraining width. `prose-sm` keeps text compact. The `prose-*:my-*` utilities tighten vertical spacing so responses don't feel too spread out. `prose-invert` applies dark-mode colors.

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/MarkdownContent.tsx
git commit -m "feat: add MarkdownContent component for rendering AI responses"
```

---

### Task 4: Update streaming conversation page

**Files:**
- Modify: `src/app/conversation/page.tsx`

**Step 1: Add import**

Add to top of file:
```tsx
import MarkdownContent from '@/components/MarkdownContent'
```

**Step 2: Replace 4 render sites**

Replace all instances of:
```tsx
<div className="text-gray-300 whitespace-pre-wrap">{r.content}</div>
```
with:
```tsx
<MarkdownContent content={r.content} />
```

For streaming messages, replace:
```tsx
<div className="text-gray-300 whitespace-pre-wrap">{r.content}<span className="animate-pulse">▍</span></div>
```
with:
```tsx
<div>
  <MarkdownContent content={r.content} />
  <span className="animate-pulse">▍</span>
</div>
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/conversation/page.tsx
git commit -m "feat: render AI responses as markdown in streaming conversation view"
```

---

### Task 5: Update history conversation page

**Files:**
- Modify: `src/app/conversation/[id]/page.tsx`

**Step 1: Add import**

Add to top of file:
```tsx
import MarkdownContent from '@/components/MarkdownContent'
```

**Step 2: Replace 2 render sites**

Replace both instances of:
```tsx
<div className="text-gray-300 whitespace-pre-wrap">{r.content}</div>
```
with:
```tsx
<MarkdownContent content={r.content} />
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/conversation/[id]/page.tsx
git commit -m "feat: render AI responses as markdown in conversation history view"
```

---

### Task 6: Visual smoke test

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test with a new conversation**

Navigate to the app and start a conversation. Verify:
- Headings render as headings (not `# raw text`)
- Bold/italic render correctly
- Code blocks have background styling
- Lists are properly formatted
- Tables render (if present)

**Step 3: Test history view**

Navigate to a past conversation. Verify same formatting applies.
