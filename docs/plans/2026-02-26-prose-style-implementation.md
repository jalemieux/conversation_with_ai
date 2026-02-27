# Prose Style Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce essay-style prose output from LLMs by introducing a system message layer and cleaning meta-instructions out of the augmenter.

**Architecture:** New `system-prompt.ts` module builds per-round system messages. Route handler passes them as `system` param to `streamText`. Augmenter and orchestrator lose their behavioural directives.

**Tech Stack:** TypeScript, Vercel AI SDK (`streamText`), Next.js API routes

---

### Task 1: Create system-prompt module

**Files:**
- Create: `src/lib/system-prompt.ts`
- Test: `src/lib/__tests__/system-prompt.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/__tests__/system-prompt.test.ts
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../system-prompt'

describe('buildSystemPrompt', () => {
  it('returns prose style directive for round 1', () => {
    const result = buildSystemPrompt(1)
    expect(result).toContain('essay-style prose')
    expect(result).toContain('Think deeply')
    expect(result).toContain('up-to-date knowledge')
    expect(result).toContain('800')
    expect(result).not.toContain('generic praise')
  })

  it('returns prose style directive for round 2', () => {
    const result = buildSystemPrompt(2)
    expect(result).toContain('essay-style prose')
    expect(result).toContain('Think deeply')
    expect(result).toContain('300')
    expect(result).toContain('generic praise')
    expect(result).not.toContain('800')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/system-prompt.test.ts`
Expected: FAIL with "Cannot find module '../system-prompt'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/system-prompt.ts
const SHARED = `You are a participant in a published multi-model conversation. Write in flowing, essay-style prose — the kind you'd find in The Economist or The Atlantic. Develop your argument through connected paragraphs, not bullet points or numbered lists. You may occasionally use a brief structured element (a short comparison, a key enumeration) when it genuinely serves clarity, but the default mode is always discursive prose.

Think deeply and carefully — the questions asked can be complex and nuanced. Draw on the most up-to-date knowledge available to you.`

const ROUND_1_ADDITIONS = `Aim for roughly 800–1200 words.`

const ROUND_2_ADDITIONS = `Be direct and substantive — avoid generic praise. Aim for roughly 300–500 words.`

export function buildSystemPrompt(round: 1 | 2): string {
  const additions = round === 1 ? ROUND_1_ADDITIONS : ROUND_2_ADDITIONS
  return `${SHARED}\n\n${additions}`
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/system-prompt.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/system-prompt.ts src/lib/__tests__/system-prompt.test.ts
git commit -m "feat: add system prompt module for prose style enforcement"
```

---

### Task 2: Clean meta-instructions from augmenter

**Files:**
- Modify: `src/lib/augmenter.ts:47-48`
- Test: `src/lib/__tests__/augmenter.test.ts` (if exists, otherwise skip test step)

**Step 1: Check for existing augmenter tests**

Run: `find src -path '*augmenter*test*' -o -path '*test*augmenter*' 2>/dev/null`

If tests exist, read them to understand current coverage.

**Step 2: Edit augmenter.ts — remove two meta-instruction lines**

In `src/lib/augmenter.ts`, remove these two lines from the principles section (lines 47-48):

```
- Instruct the model to think deeply and carefully — the questions asked can be complex and nuanced
- Instruct the model to use the most up-to-date knowledge available
```

The principles section should become:

```typescript
Principles:
- Add structure and depth, not fluff
- Keep each augmented prompt concise
- Preserve the user's nuance and framing
- Don't over-constrain with too many sub-questions
- Some framings may fit the input better than others — do your best for each
```

**Step 3: Run existing tests if any**

Run: `npx vitest run src/lib/__tests__/`
Expected: PASS (no behaviour change, just prompt wording)

**Step 4: Commit**

```bash
git add src/lib/augmenter.ts
git commit -m "refactor: remove meta-instructions from augmenter prompt"
```

---

### Task 3: Clean behavioural directives from orchestrator Round 2

**Files:**
- Modify: `src/lib/orchestrator.ts:33`

**Step 1: Edit orchestrator.ts — remove behavioural directives from Round 2 prompt**

In `src/lib/orchestrator.ts`, change the last line of `buildRound2Prompt` from:

```typescript
Now react to what the others said. You may agree, disagree, build on ideas, or offer new perspectives. Be direct and substantive — avoid generic praise. Aim for roughly 300-500 words. This is Round 2 of a published conversation.`
```

to:

```typescript
Now react to what the others said. You may agree, disagree, build on ideas, or offer new perspectives.`
```

The behavioural directives ("be direct", "avoid generic praise", length target, "published conversation") are now in the system prompt.

**Step 2: Run existing tests**

Run: `npx vitest run src/lib/__tests__/`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/orchestrator.ts
git commit -m "refactor: move behavioural directives from orchestrator to system prompt"
```

---

### Task 4: Wire system prompt into route handler

**Files:**
- Modify: `src/app/api/conversation/route.ts:1,46,85`

**Step 1: Add import**

At the top of `route.ts`, add:

```typescript
import { buildSystemPrompt } from '@/lib/system-prompt'
```

**Step 2: Add system param to Round 1 streamText call**

Change the Round 1 `streamText` call (around line 46) from:

```typescript
const result = streamText({
  model: getModelProvider(modelKey),
  prompt,
  ...(config.providerOptions && { providerOptions: config.providerOptions }),
})
```

to:

```typescript
const result = streamText({
  model: getModelProvider(modelKey),
  system: buildSystemPrompt(1),
  prompt,
  ...(config.providerOptions && { providerOptions: config.providerOptions }),
})
```

**Step 3: Add system param to Round 2 streamText call**

Change the Round 2 `streamText` call (around line 85) from:

```typescript
const result = streamText({
  model: getModelProvider(modelKey),
  prompt,
  ...(config.providerOptions && { providerOptions: config.providerOptions }),
})
```

to:

```typescript
const result = streamText({
  model: getModelProvider(modelKey),
  system: buildSystemPrompt(2),
  prompt,
  ...(config.providerOptions && { providerOptions: config.providerOptions }),
})
```

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/conversation/route.ts
git commit -m "feat: wire system prompt into streamText calls for both rounds"
```

---

### Task 5: Manual smoke test

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Submit a test conversation**

Use a topic like "Is remote work better than office work?" and verify:
- Round 1 responses are in prose form (paragraphs, not bullet lists)
- Round 2 responses are in prose form
- No meta-instructions visible in the augmented prompt shown to users

**Step 3: Commit any fixes if needed**

---

### Task 6: Update documentation

**Files:**
- Modify: `docs/architecture.md`

**Step 1: Add system prompt module to architecture docs**

Add `system-prompt.ts` to the component table and update the data flow diagram to show the system message path.

**Step 2: Add ADR entry**

Add an ADR for the decision to use system messages for behavioural meta-instructions.

**Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add system prompt module to architecture docs"
```
