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

## Shared Component: Example Conversation

A static mocked conversation showing a topic + 2-3 model responses with visible disagreement. Topic should be substantive (market prediction, policy question) to resonate with the target audience. Reused by both pages.

---

## Landing A: "The Quiet Tool"

Minimal copy, generous whitespace. Each section is one sentence + a visual. Feels like a well-typeset one-pager.

### Sections

#### 1. Hero
- App title in Source Serif
- One sentence (the value prop, not a tagline)
- `[ Sign in ]` amber button

#### 2. How It Works
- Three-step horizontal grid (stacks vertical on mobile)
- `1. Ask` → `2. Frame` → `3. Compare`
- One sentence under each step

#### 3. Models
- Four models with colored dots: Claude, GPT, Gemini, Grok
- One sentence about breadth of perspective

#### 4. Example
- Static mocked conversation card
- Topic + 2-3 model response snippets showing disagreement

#### 5. Features
- 3x2 grid of short feature cards (2-col on mobile)
- Prompt framing, Multi-round, Text-to-speech, Export, BYOK, History

#### 6. Pricing
- Two cards side-by-side (stack on mobile)
- `$20/mo — all models` and `BYOK — free, bring your keys`

#### 7. Footer CTA
- One sentence
- `[ Sign in ]` amber button

---

## Landing B: "The Argument"

Text-forward. Each section builds on the previous like paragraphs in an essay. Reads like a short investment memo.

### Sections

#### 1. Hero (The Problem)
- App title in Source Serif
- 2-3 sentences: the problem with asking one model. Blind spots. Framing effects.
- `[ Sign in ]` amber button

#### 2. The Mechanism
- Short paragraph (prose, not numbered grid)
- Why framing matters. Why multiple models. Why structured rounds.

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
- Each feature: bold label + one explanatory sentence
- Reads like a bulleted brief

#### 6. Pricing
- Same two-card layout as A

#### 7. Footer CTA
- Closing sentence that ties back to the opening thesis
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

## Files to Modify

None. Current home page and routing stay untouched.
