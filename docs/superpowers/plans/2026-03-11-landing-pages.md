# Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two landing page variants (`/landing-a` and `/landing-b`) that convert unauthenticated visitors into subscribers.

**Architecture:** Two new Next.js page routes, three shared components (`ScrollFadeIn`, `ExampleConversation`, `LandingPricing`), one shared constants file (`model-colors.ts`). Pages are static server components — no client-side data fetching. The auth proxy is updated to allow public access to both routes.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-11-landing-pages-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/model-colors.ts` | Shared model dot/accent/faint color constants |
| `src/components/ScrollFadeIn.tsx` | Intersection observer wrapper — fade-up on scroll, once only |
| `src/components/ExampleConversation.tsx` | Static mocked conversation (dollar reserve currency topic) |
| `src/components/LandingPricing.tsx` | Two-card pricing section (subscription + BYOK) |
| `src/app/landing-a/page.tsx` | Landing A — "The Quiet Tool" |
| `src/app/landing-b/page.tsx` | Landing B — "The Argument" |
| `src/proxy.ts` | Add `/landing-a`, `/landing-b` to PUBLIC_PATHS |

---

## Chunk 1: Shared Infrastructure

### Task 1: Model color constants

**Files:**
- Create: `src/lib/model-colors.ts`

- [ ] **Step 1: Create model-colors.ts**

```ts
export const MODEL_DOTS: Record<string, string> = {
  claude: 'bg-claude',
  gpt: 'bg-gpt',
  gemini: 'bg-gemini',
  grok: 'bg-grok',
}

export const MODEL_ACCENTS: Record<string, string> = {
  claude: 'text-claude',
  gpt: 'text-gpt',
  gemini: 'text-gemini',
  grok: 'text-grok',
}

export const MODEL_FAINT_BGS: Record<string, string> = {
  claude: 'bg-claude-faint',
  gpt: 'bg-gpt-faint',
  gemini: 'bg-gemini-faint',
  grok: 'bg-grok-faint',
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/model-colors.ts
git commit -m "feat: add shared model color constants"
```

---

### Task 2: ScrollFadeIn component

**Files:**
- Create: `src/components/ScrollFadeIn.tsx`

- [ ] **Step 1: Create ScrollFadeIn.tsx**

```tsx
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface ScrollFadeInProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function ScrollFadeIn({ children, delay = 0, className = '' }: ScrollFadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 0.4s ease-out ${delay}ms, transform 0.4s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ScrollFadeIn.tsx
git commit -m "feat: add ScrollFadeIn intersection observer component"
```

---

### Task 3: ExampleConversation component

**Files:**
- Create: `src/components/ExampleConversation.tsx`
- Read: `src/lib/model-colors.ts`

- [ ] **Step 1: Create ExampleConversation.tsx**

The component renders a static card mimicking the conversation UI. Three model responses on the dollar reserve currency topic. Uses model color constants for dots and accents.

```tsx
import { MODEL_DOTS, MODEL_ACCENTS } from '@/lib/model-colors'

const MOCK_TOPIC = 'Will the US dollar lose its reserve currency status within 20 years?'

const MOCK_RESPONSES = [
  {
    model: 'claude',
    name: 'Claude',
    snippet:
      'The dollar\'s reserve status rests on deep structural advantages — network effects in trade invoicing, the depth of US Treasury markets, and the absence of a credible alternative. Gradual erosion is plausible, but full displacement within 20 years requires a coordination event that no rival currency can yet trigger.',
  },
  {
    model: 'gpt',
    name: 'GPT',
    snippet:
      'History offers a template: sterling\'s decline took roughly 30 years after Bretton Woods shifted the center of gravity. BRICS nations are actively de-dollarizing, but the transition timeline is more likely 30–50 years than 20. The dollar\'s share of reserves has already dropped from 71% to 58% — the trend is real, the pace is slow.',
  },
  {
    model: 'grok',
    name: 'Grok',
    snippet:
      'The consensus timeline is the consensus because it\'s comfortable, not because it\'s right. Digital yuan settlement, commodity repricing in non-dollar pairs, and US fiscal trajectory are accelerating trends. Markets price regime shifts faster than academics model them.',
  },
]

export function ExampleConversation() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Topic header */}
      <div className="px-6 py-4 border-b border-border">
        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted block mb-2">
          Topic
        </span>
        <p className="text-ink text-[15px] leading-relaxed font-[family-name:var(--font-serif)]">
          {MOCK_TOPIC}
        </p>
      </div>

      {/* Responses */}
      <div className="divide-y divide-border">
        {MOCK_RESPONSES.map((r) => {
          const dot = MODEL_DOTS[r.model] ?? 'bg-amber'
          const accent = MODEL_ACCENTS[r.model] ?? 'text-amber'
          return (
            <div key={r.model} className="px-6 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <span className={`text-sm font-semibold ${accent}`}>{r.name}</span>
              </div>
              <p className="text-ink-light text-[14px] leading-relaxed">{r.snippet}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ExampleConversation.tsx
git commit -m "feat: add ExampleConversation mock component for landing pages"
```

---

### Task 4: LandingPricing component

**Files:**
- Create: `src/components/LandingPricing.tsx`

- [ ] **Step 1: Create LandingPricing.tsx**

Two side-by-side cards. Both link to `/login`. Stack vertically on mobile.

```tsx
import Link from 'next/link'

export function LandingPricing() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Subscription card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-1">
          $20 / month
        </div>
        <p className="text-ink-muted text-[14px] leading-relaxed mb-5">
          All four models. Unlimited conversations. No API keys needed.
        </p>
        <Link
          href="/login"
          className="block w-full py-3 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide text-center transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
        >
          Sign in
        </Link>
      </div>

      {/* BYOK card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-1">
          Bring your own keys
        </div>
        <p className="text-ink-muted text-[14px] leading-relaxed mb-5">
          Free. Use your own API keys. Same features.
        </p>
        <Link
          href="/login"
          className="block w-full py-3 bg-card border border-border text-ink rounded-lg font-semibold text-sm tracking-wide text-center transition-all duration-200 hover:border-border-strong"
        >
          Sign in
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LandingPricing.tsx
git commit -m "feat: add LandingPricing component for landing pages"
```

---

### Task 5: Update auth proxy for public access

**Files:**
- Modify: `src/proxy.ts:3`

- [ ] **Step 1: Add landing routes to PUBLIC_PATHS**

In `src/proxy.ts`, change:

```ts
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/stripe/webhook', '/api/augment', '/api/conversation']
```

to:

```ts
const PUBLIC_PATHS = ['/login', '/landing-a', '/landing-b', '/api/auth', '/api/stripe/webhook', '/api/augment', '/api/conversation']
```

- [ ] **Step 2: Commit**

```bash
git add src/proxy.ts
git commit -m "feat: allow public access to landing page routes"
```

---

## Chunk 2: Landing A — "The Quiet Tool"

### Task 6: Landing A page

**Files:**
- Create: `src/app/landing-a/page.tsx`
- Read: `src/components/ScrollFadeIn.tsx`, `src/components/ExampleConversation.tsx`, `src/components/LandingPricing.tsx`, `src/lib/model-colors.ts`

- [ ] **Step 1: Create the page file**

A server component with Next.js metadata export. Seven sections, each wrapped in `<ScrollFadeIn>` with staggered delays. Semantic HTML with `<main>`, `<section>`, proper heading hierarchy.

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollFadeIn } from '@/components/ScrollFadeIn'
import { ExampleConversation } from '@/components/ExampleConversation'
import { LandingPricing } from '@/components/LandingPricing'
import { MODEL_DOTS, MODEL_ACCENTS } from '@/lib/model-colors'

export const metadata: Metadata = {
  title: 'Conversation With AI — Structured analysis from frontier models',
  description:
    'Frame your question, compare answers from Claude, GPT, Gemini, and Grok, and surface what one model misses.',
  openGraph: {
    title: 'Conversation With AI',
    description:
      'Structured analysis from the frontier models. Frame the question, compare the answers, surface what one model misses.',
    type: 'website',
  },
}

const MODELS = [
  { key: 'claude', name: 'Claude' },
  { key: 'gpt', name: 'GPT' },
  { key: 'gemini', name: 'Gemini' },
  { key: 'grok', name: 'Grok' },
]

const STEPS = [
  { number: '1', label: 'Ask', description: 'Pose a question on any topic.' },
  { number: '2', label: 'Frame', description: 'AI refines your prompt for depth and precision.' },
  { number: '3', label: 'Compare', description: 'Multiple models respond. Then they respond to each other.' },
]

const FEATURES = [
  { label: 'Prompt framing', description: 'AI analyzes your input and suggests the sharpest angle.' },
  { label: 'Multi-round debate', description: 'Models read each other\u2019s responses and push back.' },
  { label: 'Text-to-speech', description: 'Listen to any response. Each model has a distinct voice.' },
  { label: 'Export', description: 'Download the full discussion as Markdown, text, or X thread.' },
  { label: 'Bring your own keys', description: 'Use your API keys instead of subscribing.' },
  { label: 'History', description: 'Every conversation saved and searchable.' },
]

export default function LandingA() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="pt-16 pb-20 text-center">
        <ScrollFadeIn>
          <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl font-semibold tracking-tight leading-tight text-ink mb-5">
            Conversation With AI
          </h1>
          <p className="text-ink-muted text-[16px] leading-relaxed max-w-lg mx-auto mb-8">
            Structured analysis from the frontier models. Frame the question, compare the answers, surface what one model misses.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3.5 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
          >
            Sign in
          </Link>
        </ScrollFadeIn>
      </section>

      {/* ── How It Works ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-8 text-center">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <div key={step.number} className="text-center">
                <div className="text-amber font-[family-name:var(--font-serif)] text-3xl font-semibold mb-2">
                  {step.number}.
                </div>
                <div className="font-semibold text-ink text-[15px] mb-1">{step.label}</div>
                <p className="text-ink-muted text-[14px] leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── Models ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-6 text-center">
            The panel
          </h2>
          <div className="flex justify-center gap-6 flex-wrap mb-4">
            {MODELS.map((m) => {
              const dot = MODEL_DOTS[m.key] ?? 'bg-amber'
              const accent = MODEL_ACCENTS[m.key] ?? 'text-amber'
              return (
                <div key={m.key} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  <span className={`text-sm font-semibold ${accent}`}>{m.name}</span>
                </div>
              )
            })}
          </div>
          <p className="text-ink-muted text-[14px] text-center">
            Four reasoning styles. Each sees what the others don't.
          </p>
        </ScrollFadeIn>
      </section>

      {/* ── Example ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <ExampleConversation />
        </ScrollFadeIn>
      </section>

      {/* ── Features ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-8 text-center">
            Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-card border border-border rounded-xl p-5">
                <div className="font-semibold text-ink text-[15px] mb-1">{f.label}</div>
                <p className="text-ink-muted text-[14px] leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── Pricing ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-8 text-center">
            Pricing
          </h2>
          <LandingPricing />
        </ScrollFadeIn>
      </section>

      {/* ── Footer CTA ── */}
      <section className="pb-16 text-center">
        <ScrollFadeIn>
          <p className="font-[family-name:var(--font-serif)] text-xl text-ink mb-6">
            One question. Four perspectives.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3.5 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
          >
            Sign in
          </Link>
        </ScrollFadeIn>
      </section>
    </>
  )
}
```

- [ ] **Step 2: Verify the page renders**

Run: `npx next dev` and open `http://localhost:3000/landing-a` in a browser. Confirm:
- All seven sections render
- Scroll animations trigger on scroll
- Model dots show correct colors
- Example conversation displays three model responses
- Pricing cards show side-by-side on desktop, stacked on mobile
- "Sign in" buttons link to `/login`
- Page is accessible without authentication

- [ ] **Step 3: Commit**

```bash
git add src/app/landing-a/page.tsx
git commit -m "feat: add Landing A page — The Quiet Tool"
```

---

## Chunk 3: Landing B — "The Argument"

### Task 7: Landing B page

**Files:**
- Create: `src/app/landing-b/page.tsx`
- Read: `src/components/ScrollFadeIn.tsx`, `src/components/ExampleConversation.tsx`, `src/components/LandingPricing.tsx`, `src/lib/model-colors.ts`

- [ ] **Step 1: Create the page file**

Same structure as A but with prose-forward copy, vertical feature list, and thesis-driven narrative.

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollFadeIn } from '@/components/ScrollFadeIn'
import { ExampleConversation } from '@/components/ExampleConversation'
import { LandingPricing } from '@/components/LandingPricing'
import { MODEL_DOTS, MODEL_ACCENTS } from '@/lib/model-colors'

export const metadata: Metadata = {
  title: 'Conversation With AI — Every model has blind spots',
  description:
    'A structured roundtable between frontier AI models. Surface disagreements, not consensus.',
  openGraph: {
    title: 'Conversation With AI',
    description:
      'Every model has blind spots. This tool lets you hear from all of them, in a structured format designed to surface the differences.',
    type: 'website',
  },
}

const MODELS = [
  { key: 'claude', name: 'Claude', style: 'Careful, nuanced' },
  { key: 'gpt', name: 'GPT', style: 'Broad, synthetic' },
  { key: 'gemini', name: 'Gemini', style: 'Analytical, grounded' },
  { key: 'grok', name: 'Grok', style: 'Direct, contrarian' },
]

const FEATURES = [
  { label: 'Prompt framing', description: 'AI analyzes your input and suggests the sharpest angle.' },
  { label: 'Multi-round debate', description: 'Models read each other\u2019s responses and push back.' },
  { label: 'Text-to-speech', description: 'Listen to any response. Each model has a distinct voice.' },
  { label: 'Export', description: 'Download the full discussion as Markdown, text, or X thread.' },
  { label: 'Bring your own keys', description: 'Use your API keys instead of subscribing.' },
  { label: 'History', description: 'Every conversation saved and searchable.' },
]

export default function LandingB() {
  return (
    <>
      {/* ── Hero (The Problem) ── */}
      <section className="pt-16 pb-20">
        <ScrollFadeIn>
          <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl font-semibold tracking-tight leading-tight text-ink mb-6">
            Conversation With AI
          </h1>
          <div className="max-w-xl">
            <p className="text-ink-light text-[16px] leading-relaxed mb-6">
              Every model has blind spots. Ask Claude a policy question and it hedges. Ask GPT and it synthesizes toward consensus. Ask Grok and it provokes. None of them is wrong — but none of them is complete.
            </p>
            <p className="text-ink-light text-[16px] leading-relaxed mb-8">
              This tool lets you hear from all of them, in a structured format designed to surface the differences.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block px-8 py-3.5 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
          >
            Sign in
          </Link>
        </ScrollFadeIn>
      </section>

      {/* ── The Mechanism ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-4">
            How it works
          </h2>
          <div className="max-w-xl">
            <p className="text-ink-light text-[15px] leading-relaxed">
              You start with a question. Before it reaches any model, AI analyzes your input and suggests framings — prediction, comparison, trend analysis — that draw out more substantive responses. Then multiple models answer in parallel. In a second round, each model reads the others and responds: agreements, objections, refinements. The result is a structured discussion, not a monologue.
            </p>
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── The Models ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-6">
            The models
          </h2>
          <div className="space-y-3 max-w-xl">
            {MODELS.map((m) => {
              const dot = MODEL_DOTS[m.key] ?? 'bg-amber'
              const accent = MODEL_ACCENTS[m.key] ?? 'text-amber'
              return (
                <div key={m.key} className="flex items-baseline gap-3">
                  <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0 translate-y-[-1px]`} />
                  <span className={`font-semibold text-[15px] ${accent}`}>{m.name}</span>
                  <span className="text-ink-muted text-[14px]">— {m.style}</span>
                </div>
              )
            })}
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── The Evidence (Example) ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-2">
            A real roundtable
          </h2>
          <p className="text-ink-muted text-[14px] mb-6">
            Here's what a structured discussion looks like.
          </p>
          <ExampleConversation />
        </ScrollFadeIn>
      </section>

      {/* ── What You Get (Features) ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-6">
            What you get
          </h2>
          <div className="space-y-4 max-w-xl">
            {FEATURES.map((f) => (
              <div key={f.label}>
                <span className="font-semibold text-ink text-[15px]">{f.label}.</span>{' '}
                <span className="text-ink-muted text-[14px]">{f.description}</span>
              </div>
            ))}
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── Pricing ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-6">
            Pricing
          </h2>
          <LandingPricing />
        </ScrollFadeIn>
      </section>

      {/* ── Footer CTA ── */}
      <section className="pb-16">
        <ScrollFadeIn>
          <p className="font-[family-name:var(--font-serif)] text-xl text-ink mb-6">
            The best answer is rarely the first one you hear.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3.5 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
          >
            Sign in
          </Link>
        </ScrollFadeIn>
      </section>
    </>
  )
}
```

- [ ] **Step 2: Verify the page renders**

Run: `npx next dev` and open `http://localhost:3000/landing-b` in a browser. Confirm:
- All seven sections render with prose-forward styling
- Hero has the thesis paragraph (not centered, left-aligned)
- Models section shows style descriptions
- Features render as a vertical list
- Scroll animations work
- "Sign in" buttons link to `/login`
- Page is accessible without authentication

- [ ] **Step 3: Commit**

```bash
git add src/app/landing-b/page.tsx
git commit -m "feat: add Landing B page — The Argument"
```

---

## Chunk 4: Final Verification

### Task 8: Cross-page verification

- [ ] **Step 1: Verify both pages side-by-side**

Open both `/landing-a` and `/landing-b` in separate tabs. Confirm:
- Both load without errors
- Both are accessible without auth (not redirected to `/login`)
- Shared components (ExampleConversation, LandingPricing) render identically on both
- ScrollFadeIn triggers on scroll, animates once, does not replay
- Mobile responsive: resize to 375px width, verify single-column layouts
- All "Sign in" links navigate to `/login`
- No console errors

- [ ] **Step 2: Verify existing app is unaffected**

Navigate to `/` while logged in. Confirm:
- Current home page renders as before
- No visual or functional regressions

- [ ] **Step 3: Final commit**

If any fixes were needed, commit them. Otherwise this step is a no-op.
