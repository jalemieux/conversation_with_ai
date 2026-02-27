# Essay Mode Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a toggle on the Review Prompt page that lets users enable/disable essay-style prose before generating a conversation.

**Architecture:** Boolean `essayMode` flows as a query parameter through the existing chain: Review page → conversation page → API route. The route handler conditionally applies the system prompt.

**Tech Stack:** React (Next.js), TypeScript, Tailwind CSS, Vercel AI SDK

---

### Task 1: Add essayMode state and toggle UI to Review page

**Files:**
- Modify: `src/app/review/page.tsx`
- Test: `src/app/review/__tests__/page.test.tsx`

**Step 1: Write the failing test**

Add to `src/app/review/__tests__/page.test.tsx`:

```typescript
it('renders essay mode toggle defaulting to on', () => {
  render(<ReviewPage />)
  const toggle = screen.getByRole('checkbox', { name: /essay mode/i })
  expect(toggle).toBeChecked()
})

it('includes essayMode=true in run URL by default', () => {
  render(<ReviewPage />)
  fireEvent.click(screen.getByText('Run Conversation'))
  expect(window.location.href).toContain('essayMode=true')
})

it('includes essayMode=false when toggle is off', () => {
  render(<ReviewPage />)
  const toggle = screen.getByRole('checkbox', { name: /essay mode/i })
  fireEvent.click(toggle)
  fireEvent.click(screen.getByText('Run Conversation'))
  expect(window.location.href).toContain('essayMode=false')
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/review/__tests__/page.test.tsx`
Expected: FAIL — no checkbox with name "essay mode" found

**Step 3: Implement the toggle**

In `src/app/review/page.tsx`:

1. Add state: `const [essayMode, setEssayMode] = useState(true)`

2. Add `essayMode` to the `handleRun` params:

```typescript
const handleRun = () => {
  const params = new URLSearchParams({
    rawInput,
    augmentedPrompt,
    topicType: selectedType,
    framework: currentFramework,
    models,
    essayMode: String(essayMode),
  })
  window.location.href = `/conversation?${params.toString()}`
}
```

3. Add toggle UI between the Topic Type section (stagger-2, mb-2) and the Augmented Prompt section (stagger-3, mb-8). Insert this block:

```tsx
<div className="animate-fade-up stagger-2 mb-6 flex items-center gap-3">
  <label htmlFor="essay-mode" className="text-xs font-medium tracking-widest uppercase text-ink-faint cursor-pointer">
    Essay Mode
  </label>
  <button
    id="essay-mode"
    role="checkbox"
    aria-checked={essayMode}
    aria-label="Essay mode"
    onClick={() => setEssayMode(!essayMode)}
    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
      essayMode ? 'bg-amber' : 'bg-border-strong'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
        essayMode ? 'translate-x-4' : 'translate-x-0'
      }`}
    />
  </button>
</div>
```

Note: Update the stagger classes — the Topic Type div keeps `stagger-2`, the new toggle div gets `stagger-2` as well (or no stagger, since it's small), the Augmented Prompt div becomes `stagger-3`, and the actions footer becomes `stagger-4`. Check the current stagger values and adjust so the sequence is preserved.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/review/__tests__/page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/review/page.tsx src/app/review/__tests__/page.test.tsx
git commit -m "feat: add essay mode toggle to review page"
```

---

### Task 2: Pass essayMode from conversation page to API

**Files:**
- Modify: `src/app/conversation/page.tsx`

**Step 1: Add essayMode to the URL param extraction and API call**

In `src/app/conversation/page.tsx`, inside the `useEffect`, after line 53 (`const models = ...`), add:

```typescript
const essayMode = searchParams.get('essayMode') !== 'false'
```

Then add `essayMode` to the `JSON.stringify` body on line 62:

```typescript
body: JSON.stringify({ rawInput, augmentedPrompt, topicType, framework, models, essayMode }),
```

**Step 2: Run existing tests**

Run: `npx vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/conversation/page.tsx
git commit -m "feat: pass essayMode from conversation page to API"
```

---

### Task 3: Conditionally apply system prompt in route handler

**Files:**
- Modify: `src/app/api/conversation/route.ts`

**Step 1: Read essayMode from request body**

On line 12, add `essayMode` to the destructured body:

```typescript
const { rawInput, augmentedPrompt, topicType, framework, models, essayMode } = await request.json()
```

**Step 2: Conditionally pass system to both streamText calls**

Change Round 1 `streamText` call (around line 47-52) from:

```typescript
const result = streamText({
  model: getModelProvider(modelKey),
  system: buildSystemPrompt(1),
  prompt,
  ...(config.providerOptions && { providerOptions: config.providerOptions }),
})
```

to:

```typescript
const result = streamText({
  model: getModelProvider(modelKey),
  ...(essayMode !== false && { system: buildSystemPrompt(1) }),
  prompt,
  ...(config.providerOptions && { providerOptions: config.providerOptions }),
})
```

Apply the same pattern to Round 2 `streamText` call (around line 84-89):

```typescript
const result = streamText({
  model: getModelProvider(modelKey),
  ...(essayMode !== false && { system: buildSystemPrompt(2) }),
  prompt,
  ...(config.providerOptions && { providerOptions: config.providerOptions }),
})
```

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/conversation/route.ts
git commit -m "feat: conditionally apply system prompt based on essayMode flag"
```

---

### Task 4: Build verification and docs

**Step 1: Build**

Run: `npx next build`
Expected: Build succeeds with no errors

**Step 2: Update docs/architecture.md**

Add a note about the essayMode toggle in the data flow section — mention that it's a boolean query param that controls whether the system prompt is applied.

**Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add essay mode toggle to architecture docs"
```
