# Multi-Augmentation Prompt Selection — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate augmented prompts for all 5 topic types and let users pick their preferred framing via clickable tags on the review page.

**Architecture:** Modify the single Haiku call to return all 5 augmentations. Pass them through the API route to the review page. Make the existing tags interactive — clicking one swaps the textarea content. Everything downstream of the review page (conversation API, orchestrator) stays unchanged.

**Tech Stack:** Next.js 16, TypeScript, Vercel AI SDK, Vitest

---

### Task 1: Update types and interfaces

**Files:**
- Modify: `src/lib/augmenter.ts:1-15`

**Step 1: Write the failing test**

Create test file:

```typescript
// src/lib/__tests__/augmenter.test.ts
import { describe, it, expect } from 'vitest'
import { TOPIC_TYPES, type TopicType } from '../augmenter'

describe('augmenter types', () => {
  it('exports TOPIC_TYPES with all 5 types', () => {
    expect(TOPIC_TYPES).toEqual([
      'prediction', 'opinion', 'comparison', 'trend_analysis', 'open_question',
    ])
  })
})
```

**Step 2: Run test to verify it passes (types already exist)**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx vitest run src/lib/__tests__/augmenter.test.ts`
Expected: PASS

**Step 3: Add new interfaces**

In `src/lib/augmenter.ts`, replace the `AugmenterResult` interface with:

```typescript
export interface AugmentationEntry {
  framework: string
  augmentedPrompt: string
}

export type AugmentationsMap = Record<TopicType, AugmentationEntry>

export interface MultiAugmenterResult {
  recommended: TopicType
  augmentations: AugmentationsMap
}

// Keep for backward compat during migration
export interface AugmenterResult {
  topicType: TopicType
  framework: string
  augmentedPrompt: string
}
```

**Step 4: Add test for new types**

```typescript
it('MultiAugmenterResult has correct shape', () => {
  const result: MultiAugmenterResult = {
    recommended: 'prediction',
    augmentations: {
      prediction: { framework: 'scenario analysis', augmentedPrompt: 'test' },
      opinion: { framework: 'steel man vs straw man', augmentedPrompt: 'test' },
      comparison: { framework: 'strongest case', augmentedPrompt: 'test' },
      trend_analysis: { framework: 'timeline framing', augmentedPrompt: 'test' },
      open_question: { framework: 'multiple angles', augmentedPrompt: 'test' },
    },
  }
  expect(result.recommended).toBe('prediction')
  expect(Object.keys(result.augmentations)).toHaveLength(5)
})
```

**Step 5: Run tests**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx vitest run src/lib/__tests__/augmenter.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/augmenter.ts src/lib/__tests__/augmenter.test.ts
git commit -m "feat: add multi-augmentation type interfaces"
```

---

### Task 2: Update buildAugmenterPrompt

**Files:**
- Modify: `src/lib/augmenter.ts:17-43`
- Test: `src/lib/__tests__/augmenter.test.ts`

**Step 1: Write the failing test**

```typescript
describe('buildAugmenterPrompt', () => {
  it('asks for all 5 topic types in JSON output', () => {
    const prompt = buildAugmenterPrompt('SaaS stocks are oversold')
    // Should mention all 5 types
    expect(prompt).toContain('prediction')
    expect(prompt).toContain('opinion')
    expect(prompt).toContain('comparison')
    expect(prompt).toContain('trend_analysis')
    expect(prompt).toContain('open_question')
    // Should ask for recommended
    expect(prompt).toContain('recommended')
    // Should include the raw input
    expect(prompt).toContain('SaaS stocks are oversold')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx vitest run src/lib/__tests__/augmenter.test.ts`
Expected: FAIL — current prompt doesn't contain "recommended"

**Step 3: Update buildAugmenterPrompt**

Replace the function in `src/lib/augmenter.ts`:

```typescript
export function buildAugmenterPrompt(rawInput: string): string {
  return `You are a prompt augmenter. Given a user's raw topic or question, you must generate an augmented prompt for EACH of the 5 topic types below, using the appropriate analytical framework for each.

Topic types and their frameworks:
- prediction → scenario analysis, 1st/2nd order effects
- opinion → steel man vs straw man
- comparison → strongest case for each side
- trend_analysis → timeline framing, recent context
- open_question → multiple angles, trade-offs

For each type, rewrite the user's input to fit that analytical framing. Add at most 1-2 sentences of analytical framing per type.

Principles:
- Add structure and depth, not fluff
- Keep each augmented prompt concise
- Preserve the user's nuance and framing
- Don't over-constrain with too many sub-questions
- Some framings may fit the input better than others — do your best for each

Also pick which topic_type best fits the input as "recommended".

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "recommended": "one of: prediction, opinion, comparison, trend_analysis, open_question",
  "augmentations": {
    "prediction": { "framework": "brief framework name", "augmented_prompt": "rewritten prompt" },
    "opinion": { "framework": "brief framework name", "augmented_prompt": "rewritten prompt" },
    "comparison": { "framework": "brief framework name", "augmented_prompt": "rewritten prompt" },
    "trend_analysis": { "framework": "brief framework name", "augmented_prompt": "rewritten prompt" },
    "open_question": { "framework": "brief framework name", "augmented_prompt": "rewritten prompt" }
  }
}

User's raw input: "${rawInput}"`
}
```

**Step 4: Run tests**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx vitest run src/lib/__tests__/augmenter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/augmenter.ts src/lib/__tests__/augmenter.test.ts
git commit -m "feat: update augmenter prompt to request all 5 types"
```

---

### Task 3: Update parseAugmenterResponse

**Files:**
- Modify: `src/lib/augmenter.ts:45-59`
- Test: `src/lib/__tests__/augmenter.test.ts`

**Step 1: Write the failing test**

```typescript
import { parseMultiAugmenterResponse } from '../augmenter'

describe('parseMultiAugmenterResponse', () => {
  it('parses valid JSON response', () => {
    const json = JSON.stringify({
      recommended: 'prediction',
      augmentations: {
        prediction: { framework: 'scenario analysis', augmented_prompt: 'pred prompt' },
        opinion: { framework: 'steel man', augmented_prompt: 'opinion prompt' },
        comparison: { framework: 'strongest case', augmented_prompt: 'comp prompt' },
        trend_analysis: { framework: 'timeline', augmented_prompt: 'trend prompt' },
        open_question: { framework: 'multiple angles', augmented_prompt: 'open prompt' },
      },
    })
    const result = parseMultiAugmenterResponse(json)
    expect(result.recommended).toBe('prediction')
    expect(result.augmentations.prediction.augmentedPrompt).toBe('pred prompt')
    expect(result.augmentations.prediction.framework).toBe('scenario analysis')
    expect(Object.keys(result.augmentations)).toHaveLength(5)
  })

  it('handles markdown-wrapped JSON', () => {
    const json = '```json\n' + JSON.stringify({
      recommended: 'opinion',
      augmentations: {
        prediction: { framework: 'f', augmented_prompt: 'p' },
        opinion: { framework: 'f', augmented_prompt: 'p' },
        comparison: { framework: 'f', augmented_prompt: 'p' },
        trend_analysis: { framework: 'f', augmented_prompt: 'p' },
        open_question: { framework: 'f', augmented_prompt: 'p' },
      },
    }) + '\n```'
    const result = parseMultiAugmenterResponse(json)
    expect(result.recommended).toBe('opinion')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx vitest run src/lib/__tests__/augmenter.test.ts`
Expected: FAIL — `parseMultiAugmenterResponse` doesn't exist yet

**Step 3: Implement parseMultiAugmenterResponse**

Add to `src/lib/augmenter.ts`:

```typescript
export function parseMultiAugmenterResponse(text: string): MultiAugmenterResult {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const parsed = JSON.parse(cleaned)

  const augmentations: AugmentationsMap = {} as AugmentationsMap
  for (const type of TOPIC_TYPES) {
    const entry = parsed.augmentations[type]
    augmentations[type] = {
      framework: entry.framework,
      augmentedPrompt: entry.augmented_prompt,
    }
  }

  return {
    recommended: parsed.recommended as TopicType,
    augmentations,
  }
}
```

**Step 4: Run tests**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx vitest run src/lib/__tests__/augmenter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/augmenter.ts src/lib/__tests__/augmenter.test.ts
git commit -m "feat: add multi-augmentation response parser"
```

---

### Task 4: Update API route

**Files:**
- Modify: `src/app/api/augment/route.ts`

**Step 1: Update the route to use new parser and bump maxOutputTokens**

Replace `src/app/api/augment/route.ts`:

```typescript
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { buildAugmenterPrompt, parseMultiAugmenterResponse } from '@/lib/augmenter'

const anthropic = createAnthropic({
  apiKey: process.env.CWAI_ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  const { rawInput } = await request.json()

  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })
  }

  const prompt = buildAugmenterPrompt(rawInput.trim())

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    prompt,
    maxOutputTokens: 2000,
  })

  const result = parseMultiAugmenterResponse(text)

  return NextResponse.json({
    rawInput: rawInput.trim(),
    recommended: result.recommended,
    augmentations: result.augmentations,
  })
}
```

**Step 2: Verify build compiles**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/augment/route.ts
git commit -m "feat: update augment API to return all 5 augmentations"
```

---

### Task 5: Update home page to pass new data shape

**Files:**
- Modify: `src/app/page.tsx:39-63`

**Step 1: Update handleSubmit to pass new params**

Replace the `handleSubmit` function's success path (inside the `try` block after `const data = await res.json()`):

```typescript
const params = new URLSearchParams({
  rawInput: data.rawInput,
  recommended: data.recommended,
  augmentations: JSON.stringify(data.augmentations),
  models: selectedModels.join(','),
})
window.location.href = `/review?${params.toString()}`
```

**Step 2: Verify build compiles**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: pass all augmentations to review page"
```

---

### Task 6: Update review page with clickable tags

**Files:**
- Modify: `src/app/review/page.tsx`

**Step 1: Write the failing test**

```typescript
// src/app/review/__tests__/page.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => {
    const augmentations = JSON.stringify({
      prediction: { framework: 'scenario analysis', augmentedPrompt: 'pred prompt' },
      opinion: { framework: 'steel man', augmentedPrompt: 'opinion prompt' },
      comparison: { framework: 'strongest case', augmentedPrompt: 'comp prompt' },
      trend_analysis: { framework: 'timeline', augmentedPrompt: 'trend prompt' },
      open_question: { framework: 'multiple angles', augmentedPrompt: 'open prompt' },
    })
    return new URLSearchParams({
      rawInput: 'test input',
      recommended: 'prediction',
      augmentations,
      models: 'claude,gpt',
    })
  },
}))

import ReviewPage from '../page'

describe('ReviewPage', () => {
  it('renders all 5 topic type tags', () => {
    render(<ReviewPage />)
    expect(screen.getByText('prediction')).toBeInTheDocument()
    expect(screen.getByText('opinion')).toBeInTheDocument()
    expect(screen.getByText('comparison')).toBeInTheDocument()
    expect(screen.getByText('trend_analysis')).toBeInTheDocument()
    expect(screen.getByText('open_question')).toBeInTheDocument()
  })

  it('shows recommended type augmented prompt by default', () => {
    render(<ReviewPage />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue('pred prompt')
  })

  it('switches prompt when clicking a different tag', () => {
    render(<ReviewPage />)
    fireEvent.click(screen.getByText('opinion'))
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue('opinion prompt')
  })

  it('shows framework badge matching selected type', () => {
    render(<ReviewPage />)
    expect(screen.getByText('scenario analysis')).toBeInTheDocument()
    fireEvent.click(screen.getByText('opinion'))
    expect(screen.getByText('steel man')).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx vitest run src/app/review/__tests__/page.test.tsx`
Expected: FAIL — review page still uses old params

**Step 3: Rewrite review page**

Replace `src/app/review/page.tsx`:

```tsx
'use client'

import { Suspense, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { TOPIC_TYPES, type TopicType, type AugmentationsMap } from '@/lib/augmenter'

function ReviewContent() {
  const searchParams = useSearchParams()

  const rawInput = searchParams.get('rawInput') ?? ''
  const recommended = (searchParams.get('recommended') ?? 'prediction') as TopicType
  const models = searchParams.get('models') ?? ''

  const augmentations: AugmentationsMap = useMemo(() => {
    try {
      return JSON.parse(searchParams.get('augmentations') ?? '{}')
    } catch {
      return {} as AugmentationsMap
    }
  }, [searchParams])

  const [selectedType, setSelectedType] = useState<TopicType>(recommended)
  const [augmentedPrompt, setAugmentedPrompt] = useState(
    augmentations[recommended]?.augmentedPrompt ?? ''
  )
  const [isEdited, setIsEdited] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [currentAugmentations, setCurrentAugmentations] = useState(augmentations)

  const currentFramework = currentAugmentations[selectedType]?.framework ?? ''

  const handleTagClick = (type: TopicType) => {
    if (type === selectedType) return
    if (isEdited) {
      const confirmed = window.confirm('You have unsaved edits. Switching will discard them. Continue?')
      if (!confirmed) return
    }
    setSelectedType(type)
    setAugmentedPrompt(currentAugmentations[type]?.augmentedPrompt ?? '')
    setIsEdited(false)
  }

  const handlePromptChange = (value: string) => {
    setAugmentedPrompt(value)
    setIsEdited(value !== currentAugmentations[selectedType]?.augmentedPrompt)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch('/api/augment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput }),
      })
      const data = await res.json()
      setCurrentAugmentations(data.augmentations)
      setAugmentedPrompt(data.augmentations[selectedType]?.augmentedPrompt ?? '')
      setIsEdited(false)
    } finally {
      setRegenerating(false)
    }
  }

  const handleRun = () => {
    const params = new URLSearchParams({
      rawInput,
      augmentedPrompt,
      topicType: selectedType,
      framework: currentFramework,
      models,
    })
    window.location.href = `/conversation?${params.toString()}`
  }

  return (
    <div>
      <a href="/" className="text-ink-faint hover:text-amber text-sm mb-8 inline-flex items-center gap-1.5 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back
      </a>

      <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight mb-8 animate-fade-up">
        Review <span className="text-amber italic">Prompt</span>
      </h1>

      <div className="animate-fade-up stagger-1 mb-6">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-2">Your Input</p>
        <p className="text-ink-light leading-relaxed bg-card border border-border rounded-xl px-5 py-4">{rawInput}</p>
      </div>

      <div className="animate-fade-up stagger-2 mb-2">
        <div className="flex gap-2 flex-wrap mb-2">
          {TOPIC_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => handleTagClick(type)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                type === selectedType
                  ? 'bg-amber-faint text-amber ring-1 ring-amber/30'
                  : 'bg-cream-dark text-ink-faint hover:text-ink-muted'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <span className="px-2.5 py-1 bg-cream-dark text-ink-muted rounded-lg text-xs font-medium">{currentFramework}</span>
      </div>

      <div className="animate-fade-up stagger-3 mb-8">
        <p className="text-xs font-medium tracking-widest uppercase text-ink-faint mb-2">Augmented Prompt</p>
        <textarea
          value={augmentedPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          className="w-full h-44 bg-card border border-border rounded-xl p-5 text-ink focus:outline-none focus:border-amber transition-colors resize-none text-base leading-relaxed"
        />
      </div>

      <div className="animate-fade-up stagger-4 flex gap-3">
        <button
          onClick={() => window.history.back()}
          className="px-5 py-3 bg-card border border-border hover:border-border-strong rounded-xl font-medium transition-all duration-200 text-ink-muted hover:text-ink"
        >
          Back
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-5 py-3 bg-ink text-cream hover:bg-ink-light disabled:bg-cream-dark disabled:text-ink-faint rounded-xl font-medium transition-all duration-200"
        >
          {regenerating ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
              Regenerating...
            </span>
          ) : (
            'Regenerate'
          )}
        </button>
        <button
          onClick={handleRun}
          className="flex-1 py-3 bg-amber text-white hover:bg-amber-light rounded-xl font-medium transition-all duration-200 active:scale-[0.995]"
        >
          Run Conversation
        </button>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="text-ink-faint">Loading...</div>}>
      <ReviewContent />
    </Suspense>
  )
}
```

**Step 4: Run tests**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx vitest run src/app/review/__tests__/page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/review/page.tsx src/app/review/__tests__/page.test.tsx
git commit -m "feat: clickable topic type tags on review page"
```

---

### Task 7: Verify full build and manual test

**Step 1: Run all tests**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx vitest run`
Expected: All tests PASS

**Step 2: Type check**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npx tsc --noEmit`
Expected: No errors

**Step 3: Build**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npm run build`
Expected: Build succeeds

**Step 4: Manual smoke test**

Run: `cd /Users/jac/Dev/src/conversation_with_ai && npm run dev`

1. Enter a topic on home page, click "Start Conversation"
2. Verify review page shows all 5 tags
3. Verify recommended tag is highlighted
4. Click different tags — textarea should swap content
5. Edit the textarea, click a different tag — confirm dialog should appear
6. Click "Regenerate" — all 5 should refresh
7. Click "Run Conversation" — conversation should work normally

**Step 5: Commit**

```bash
git commit --allow-empty -m "chore: verified multi-augmentation feature"
```

---

### Task 8: Update documentation

**Files:**
- Modify: `docs/architecture.md`
- Modify: `README.md`

**Step 1: Update architecture docs**

Add to the augmenter section of `docs/architecture.md`:
- Updated data flow showing all 5 augmentations
- New `MultiAugmenterResult` and `AugmentationsMap` types
- Updated API response shape
- Changelog entry

**Step 2: Update README**

Add "Multi-augmentation prompt selection" to features list.

**Step 3: Commit**

```bash
git add docs/architecture.md README.md
git commit -m "docs: update architecture and readme for multi-augmentation"
```
