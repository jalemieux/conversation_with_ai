# Token & Cost Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Track input/output tokens and cost for each model response, display inline in the ResponseCard summary.

**Architecture:** Capture `result.usage` from Vercel AI SDK's `generateText()`, calculate cost using hardcoded per-model pricing, persist to SQLite, display in both live conversation and history pages.

**Tech Stack:** Vercel AI SDK (`ai` v6), Drizzle ORM, SQLite, Next.js, React

---

### Task 1: Add pricing to ModelConfig

**Files:**
- Modify: `src/lib/models.ts:15-63`

**Step 1: Add pricing field to ModelConfig interface**

In `src/lib/models.ts`, add `pricing` to the `ModelConfig` interface:

```typescript
export interface ModelConfig {
  id: string
  name: string
  provider: string
  modelId: string
  pricing: { inputPerMTok: number; outputPerMTok: number }
  providerOptions?: ProviderOptions
}
```

**Step 2: Add pricing values to each model config**

Add `pricing` to each entry in `MODEL_CONFIGS`:

```typescript
claude: {
  ...existing fields,
  pricing: { inputPerMTok: 15, outputPerMTok: 75 },
},
gpt: {
  ...existing fields,
  pricing: { inputPerMTok: 10, outputPerMTok: 30 },
},
gemini: {
  ...existing fields,
  pricing: { inputPerMTok: 2.50, outputPerMTok: 15 },
},
grok: {
  ...existing fields,
  pricing: { inputPerMTok: 3, outputPerMTok: 15 },
},
```

**Step 3: Add cost calculation helper**

Add a `calculateCost` function at the bottom of `src/lib/models.ts`:

```typescript
export function calculateCost(
  modelKey: string,
  inputTokens: number,
  outputTokens: number
): number {
  const config = MODEL_CONFIGS[modelKey]
  if (!config) return 0
  const { inputPerMTok, outputPerMTok } = config.pricing
  return (inputTokens * inputPerMTok + outputTokens * outputPerMTok) / 1_000_000
}
```

**Step 4: Commit**

```bash
git add src/lib/models.ts
git commit -m "feat: add per-model pricing config and cost calculator"
```

---

### Task 2: Add token columns to DB

**Files:**
- Modify: `src/db/schema.ts:14-21`
- Modify: `src/db/index.ts:20-46`

**Step 1: Add columns to schema**

In `src/db/schema.ts`, add three nullable columns to the `responses` table:

```typescript
export const responses = sqliteTable('responses', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  round: integer('round').notNull(),
  model: text('model').notNull(),
  content: text('content').notNull(),
  sources: text('sources'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cost: text('cost'), // stored as text to avoid floating point issues, parsed as number
})
```

**Step 2: Add migration in db/index.ts**

After the existing `sources` migration block (line 46), add:

```typescript
// Migration: add token tracking columns if missing
const hasInputTokens = sqlite.prepare(
  `SELECT COUNT(*) as cnt FROM pragma_table_info('responses') WHERE name = 'input_tokens'`
).get() as { cnt: number }
if (hasInputTokens.cnt === 0) {
  sqlite.exec(`ALTER TABLE responses ADD COLUMN input_tokens INTEGER`)
  sqlite.exec(`ALTER TABLE responses ADD COLUMN output_tokens INTEGER`)
  sqlite.exec(`ALTER TABLE responses ADD COLUMN cost TEXT`)
}
```

**Step 3: Add columns to CREATE TABLE statement**

Update the `CREATE TABLE responses` in `initDb()` to include the new columns for fresh databases:

```sql
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  round INTEGER NOT NULL,
  model TEXT NOT NULL,
  content TEXT NOT NULL,
  sources TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost TEXT
);
```

**Step 4: Commit**

```bash
git add src/db/schema.ts src/db/index.ts
git commit -m "feat: add token tracking columns to responses table"
```

---

### Task 3: Add usage type to shared types

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add Usage interface and update ConversationResponse**

```typescript
export interface Usage {
  inputTokens: number
  outputTokens: number
  cost: number
}

export interface ConversationResponse {
  id: string
  round: number
  model: string
  content: string
  sources?: Source[]
  usage?: Usage
}
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add Usage type to ConversationResponse"
```

---

### Task 4: Capture usage in respond route

**Files:**
- Modify: `src/app/api/conversation/respond/route.ts:51-84`

**Step 1: Import calculateCost**

Add `calculateCost` to the imports from `@/lib/models`:

```typescript
import { getModelProvider, getSearchConfig, MODEL_CONFIGS, calculateCost } from '@/lib/models'
```

**Step 2: Capture usage after generateText and calculate cost**

After line 63 (`const sources = await extractSources(result)`), add:

```typescript
const inputTokens = result.usage.inputTokens ?? 0
const outputTokens = result.usage.outputTokens ?? 0
const cost = calculateCost(modelKey, inputTokens, outputTokens)
```

**Step 3: Save tokens to DB**

Update the `db.insert` values to include token data:

```typescript
await db.insert(responses).values({
  id: respId,
  conversationId,
  round,
  model: modelKey,
  content: result.text,
  sources: sources.length > 0 ? JSON.stringify(sources) : null,
  inputTokens,
  outputTokens,
  cost: cost.toFixed(6),
})
```

**Step 4: Return usage in API response**

Add `usage` to the JSON response:

```typescript
return NextResponse.json({
  content: result.text,
  model: modelKey,
  modelName: config.name,
  provider: config.provider,
  modelId: config.modelId,
  round,
  sources,
  usage: { inputTokens, outputTokens, cost },
})
```

**Step 5: Commit**

```bash
git add src/app/api/conversation/respond/route.ts
git commit -m "feat: capture token usage and cost in respond route"
```

---

### Task 5: Return usage from GET conversation endpoint

**Files:**
- Modify: `src/app/api/conversations/[id]/route.ts:19-22`

**Step 1: Include usage in response mapping**

Update the response mapping to include token data:

```typescript
responses: resps.map((r) => ({
  ...r,
  sources: r.sources ? JSON.parse(r.sources) : undefined,
  usage: r.inputTokens != null ? {
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens ?? 0,
    cost: r.cost ? parseFloat(r.cost) : 0,
  } : undefined,
})),
```

**Step 2: Commit**

```bash
git add src/app/api/conversations/[id]/route.ts
git commit -m "feat: return usage data from conversation detail endpoint"
```

---

### Task 6: Display usage in live conversation page

**Files:**
- Modify: `src/app/conversation/page.tsx:12-20, 165-178`

**Step 1: Add usage to ModelResponse interface**

```typescript
interface ModelResponse {
  round: number
  model: string
  modelName: string
  provider: string
  modelId: string
  content: string
  sources?: { url: string; title: string }[]
  usage?: { inputTokens: number; outputTokens: number; cost: number }
}
```

**Step 2: Add a token formatting helper**

Add this function inside `ConversationContent` (or above it):

```typescript
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}
```

**Step 3: Add usage display in ResponseCard summary line**

In the `ResponseCard` component, add usage info after the provider/modelId span (line 170), before the `ml-auto` span (line 171):

```tsx
{r.usage && (
  <span className="text-xs text-ink-faint tabular-nums">
    {formatTokens(r.usage.inputTokens)}↑ {formatTokens(r.usage.outputTokens)}↓ {formatCost(r.usage.cost)}
  </span>
)}
```

**Step 4: Commit**

```bash
git add src/app/conversation/page.tsx
git commit -m "feat: display token usage and cost in live conversation page"
```

---

### Task 7: Display usage in history detail page

**Files:**
- Modify: `src/app/conversation/[id]/page.tsx:108-121, 164-176`

**Step 1: Add the same formatting helpers**

Add `formatTokens` and `formatCost` functions at the top of the file (same as Task 6).

**Step 2: Add usage display to Round 1 response cards**

In the Round 1 `<summary>` (line 110-121), after the provider/modelId span (line 113), before the `ml-auto` span (line 114):

```tsx
{r.usage && (
  <span className="text-xs text-ink-faint tabular-nums">
    {formatTokens(r.usage.inputTokens)}↑ {formatTokens(r.usage.outputTokens)}↓ {formatCost(r.usage.cost)}
  </span>
)}
```

**Step 3: Add usage display to Round 2 response cards**

Same pattern in the Round 2 `<summary>` (line 165-176), after the provider/modelId span (line 168), before the `ml-auto` span (line 169).

**Step 4: Commit**

```bash
git add src/app/conversation/[id]/page.tsx
git commit -m "feat: display token usage and cost in history detail page"
```

---

### Task 8: Verify end-to-end

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Run a conversation**

Create a new conversation with at least one model. Verify:
- Token counts appear in the ResponseCard summary line
- Cost is calculated and displayed
- Data persists — navigate to the history detail page and confirm usage shows there too

**Step 3: Verify backward compatibility**

Navigate to an old conversation (pre-migration). Verify:
- Page loads without errors
- Usage data is absent (no crash on undefined)

**Step 4: Final commit if any fixes needed**
