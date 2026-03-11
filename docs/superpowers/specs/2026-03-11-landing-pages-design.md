# Landing Pages Design Spec

## Overview

Two landing pages for Conversation With AI, targeting educated investors and professionals. Both convert visitors to subscribers via magic link login. The user will choose which to promote to the home route.

## Value Proposition

- Structured insight extraction from multiple frontier models
- Built-in prompt engineering that frames questions for maximum signal
- Cross-model synthesis that surfaces blind spots no single model reveals

## Routing

```
/landing-a  →  "The Quiet Tool" (minimal, visual)
/landing-b  →  "The Argument" (thesis-driven)
/           →  current app home (unchanged for now; user picks winner later)
```

Both pages are public (no auth required). CTA buttons link to `/login`.

## Shared Constraints

- **Copy tone:** Declarative. No exclamation marks. No "revolutionary" or "supercharge." Write like The Economist, not Product Hunt.
- **No navigation bar.** Title in the hero + CTA. Sign-in link is the only exit.
- **Mobile:** Single-column stack. Grids and side-by-side cards go vertical. Same generous spacing.
- **Animations:** Existing `fade-up` stagger. Sections animate in on scroll via intersection observer.
- **Design system:** Same cream/card/amber palette, Source Serif 4 headings, DM Sans body, existing component patterns (rounded-xl cards, border-border, shadow-subtle).

## SEO & Accessibility

- Each page gets a unique `<title>` and `<meta name="description">` via Next.js `metadata` export.
- Open Graph tags (`og:title`, `og:description`, `og:type: website`).
- Semantic HTML: `<main>`, `<section>` per block, single `<h1>` (app title), `<h2>` per section heading.
- Heading hierarchy: h1 → h2 → h3 only. No skipped levels.
- CTA buttons use `<a>` with `role="link"` (they navigate to `/login`).

## Shared Constants: Model Colors

Extract model dot/accent colors to `src/lib/model-colors.ts` (shared by landing pages and existing conversation pages). Use the existing theme tokens: `--color-claude`, `--color-gpt`, `--color-gemini`, `--color-grok`.

## Shared Component: ScrollFadeIn

Intersection observer wrapper. Behavior:
- Trigger when 15% of element is visible (`threshold: 0.15`).
- Animate once only (no replay on re-entry). Disconnect observer after triggering.
- Apply existing `fade-up` animation (0.4s ease-out).
- Accept optional `delay` prop (ms) for staggering children.

## Shared Component: Example Conversation

A static mocked conversation showing a topic + 3 model responses with visible disagreement. Uses model color constants from `src/lib/model-colors.ts`. Reused by both pages.

**Mock data:**

Topic: *"Will the US dollar lose its reserve currency status within 20 years?"*

- **Claude:** Argues structural persistence — network effects, debt denomination, lack of viable alternative. Concludes unlikely within 20 years but gradual erosion is plausible.
- **GPT:** Takes a broader view — historical precedent of reserve currency transitions (sterling → dollar). Notes BRICS de-dollarization efforts but concludes the timeline is 30-50 years, not 20.
- **Grok:** Disagrees — points to accelerating trends (digital yuan, commodity repricing, US fiscal trajectory) and argues markets price these shifts faster than academics expect. "The consensus timeline is the consensus because it's comfortable, not because it's right."

This shows substantive disagreement on timeline and mechanism, not just tone.

---

## Landing A: "The Quiet Tool"

Minimal copy, generous whitespace. Each section is one sentence + a visual. Feels like a well-typeset one-pager.

### Sections

#### 1. Hero
- App title in Source Serif
- Copy: "Structured analysis from the frontier models. Frame the question, compare the answers, surface what one model misses."
- `[ Sign in ]` amber button

#### 2. How It Works
- Three-step horizontal grid (stacks vertical on mobile)
- `1. Ask` — "Pose a question on any topic." → `2. Frame` — "AI refines your prompt for depth and precision." → `3. Compare` — "Multiple models respond. Then they respond to each other."

#### 3. Models
- Four models with colored dots: Claude, GPT, Gemini, Grok
- Copy: "Four reasoning styles. Each sees what the others don't."

#### 4. Example
- Static mocked conversation card
- Topic + 2-3 model response snippets showing disagreement

#### 5. Features
- 3x2 grid of short feature cards (2-col on mobile)
- Each card: icon-free, bold label + one sentence
  - **Prompt framing** — "AI analyzes your input and suggests the sharpest angle."
  - **Multi-round debate** — "Models read each other's responses and push back."
  - **Text-to-speech** — "Listen to any response. Each model has a distinct voice."
  - **Export** — "Download the full discussion as Markdown, text, or X thread."
  - **Bring your own keys** — "Use your API keys instead of subscribing."
  - **History** — "Every conversation saved and searchable."

#### 6. Pricing
- Two cards side-by-side (stack on mobile)
- Card 1: "$20 / month" — "All four models. Unlimited conversations. No API keys needed."
- Card 2: "Bring your own keys" — "Free. Use your own API keys. Same features."
- Both tiers get all features (TTS, export, history, multi-round).

#### 7. Footer CTA
- Copy: "One question. Four perspectives."
- `[ Sign in ]` amber button

---

## Landing B: "The Argument"

Text-forward. Each section builds on the previous like paragraphs in an essay. Reads like a short investment memo.

### Sections

#### 1. Hero (The Problem)
- App title in Source Serif
- Copy: "Every model has blind spots. Ask Claude a policy question and it hedges. Ask GPT and it synthesizes toward consensus. Ask Grok and it provokes. None of them is wrong — but none of them is complete. This tool lets you hear from all of them, in a structured format designed to surface the differences."
- `[ Sign in ]` amber button

#### 2. The Mechanism
- Short paragraph (prose, not numbered grid)
- Copy: "You start with a question. Before it reaches any model, AI analyzes your input and suggests framings — prediction, comparison, trend analysis — that draw out more substantive responses. Then multiple models answer in parallel. In a second round, each model reads the others and responds: agreements, objections, refinements. The result is a structured discussion, not a monologue."

#### 3. The Models
- Four models with colored dots
- Each gets a one-line characterization of its reasoning style
  - Claude — careful, nuanced
  - GPT — broad, synthetic
  - Gemini — analytical, grounded
  - Grok — direct, contrarian

#### 4. The Evidence (Example)
- Introduced with a sentence: "Here's what a real roundtable looks like."
- Same mocked conversation component as A

#### 5. What You Get (Features)
- Vertical list (not grid)
- Each feature: bold label + one explanatory sentence. Same six features as Landing A, same copy, but rendered as a vertical list instead of a grid.

#### 6. Pricing
- Same two-card layout as A

#### 7. Footer CTA
- Copy: "The best answer is rarely the first one you hear."
- `[ Sign in ]` amber button

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/landing-a/page.tsx` | Landing A page |
| `src/app/landing-b/page.tsx` | Landing B page |
| `src/components/ExampleConversation.tsx` | Shared mocked conversation |
| `src/components/LandingPricing.tsx` | Shared pricing cards |
| `src/components/ScrollFadeIn.tsx` | Intersection observer wrapper for scroll animations |
| `src/lib/model-colors.ts` | Shared model dot/accent color constants |

## Files to Modify

None. Current home page and routing stay untouched. (Existing pages can optionally import from `model-colors.ts` later to reduce duplication, but that's not in scope.)
