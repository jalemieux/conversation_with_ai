# Monetization Design: Auth, Stripe, BYOK

## Overview

Add user authentication (magic link email login), Stripe subscription ($20/mo flat rate), and Bring Your Own Keys (BYOK) support. Users must either subscribe or provide at least one API key to use the app.

## Architecture

```
                     ┌──────────────┐
                     │   Middleware  │
                     │  1. Session?  │
                     │  2. Access?   │
                     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        ┌─────▼────┐  ┌────▼─────┐  ┌────▼────┐
        │  /login   │  │  /setup  │  │  App    │
        │  (no      │  │  (no sub │  │  (has   │
        │  session) │  │  & no    │  │  access)│
        │           │  │  keys)   │  │         │
        └──────────┘  └────┬─────┘  └─────────┘
                           │
              ┌────────────┼────────────┐
              │                         │
        ┌─────▼──────┐          ┌──────▼───────┐
        │ Subscribe  │          │ Add BYOK     │
        │ $20/mo     │          │ keys in      │
        │ → Stripe   │          │ /settings    │
        └────────────┘          └──────────────┘
```

## Auth: Magic Link via NextAuth + Resend

- **Login flow:** User enters email → receives magic link via Resend → clicks link → session created
- **No passwords, no OAuth**
- **Session strategy:** JWT with very long maxAge (~10 years, effectively forever)
- **Session never expires** in practice

### New DB Tables

```
users
  id              TEXT PK
  name            TEXT
  email           TEXT UNIQUE NOT NULL
  email_verified  TEXT (timestamp)
  image           TEXT
  stripe_customer_id              TEXT
  stripe_subscription_id          TEXT
  subscription_status             TEXT (active | canceled | past_due | none)
  subscription_current_period_end TEXT
  created_at      TEXT

accounts
  id                TEXT PK
  user_id           TEXT FK → users
  type              TEXT
  provider          TEXT
  provider_account_id TEXT
  (NextAuth standard fields)

verification_tokens
  identifier  TEXT
  token       TEXT UNIQUE
  expires     TEXT
```

### Removal

- Remove `CWAI_ACCESS_PASSWORD` env var
- Remove `src/lib/auth.ts` (HMAC token system)
- Remove current cookie-based auth from middleware
- Remove `/login` page (replace with new magic link login)

## Stripe Integration

### Product

- One product: "Conversation With AI Pro"
- One price: $20/month, recurring
- Flat rate, unlimited access to all 4 models

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/stripe/checkout` | POST | Create Stripe Checkout Session → redirect |
| `/api/stripe/webhook` | POST | Handle Stripe events |
| `/api/stripe/portal` | POST | Create Stripe Customer Portal session |

### Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set subscription_status = active, save IDs |
| `invoice.paid` | Update period_end |
| `customer.subscription.updated` | Update status + period_end |
| `customer.subscription.deleted` | Set subscription_status = none |

### Flow

```
User clicks "Subscribe"
  → POST /api/stripe/checkout
  → Redirect to Stripe Checkout
  → User pays
  → Stripe webhook fires
  → DB updated: subscription_status = active
  → User redirected back to app
```

## BYOK Key Management

### New DB Table

```
user_api_keys
  id          TEXT PK
  user_id     TEXT FK → users
  provider    TEXT (anthropic | openai | google | xai)
  encrypted_key TEXT (AES-256-GCM)
  created_at  TEXT
  UNIQUE(user_id, provider)
```

### Encryption

- AES-256-GCM encryption using server-side `CWAI_ENCRYPTION_KEY` env var
- Keys encrypted at rest, decrypted only when making API calls
- Each key stored with its own IV and auth tag

### Settings Page (`/settings`)

Sections:
1. **Account** — Email, linked accounts
2. **Subscription** — Status, manage/cancel button (→ Stripe Customer Portal)
3. **API Keys** — One field per provider (anthropic, openai, google, xai), masked after save, delete button per key

## Access Control

### Middleware Logic

```
Request
  │
  ├─ No session → redirect /login
  │
  ├─ Session, no subscription AND no BYOK keys → redirect /setup
  │
  └─ Session, has subscription OR has BYOK keys → proceed
```

Public routes (no auth required): `/login`, `/api/auth/*`, `/api/stripe/webhook`

### Setup Page (`/setup`)

Shown when user is authenticated but has no access. Two CTAs:
- "Subscribe for $20/month" → Stripe Checkout
- "Use your own API keys" → /settings

### API Key Resolution (per model request)

```
Resolve key for provider:
  1. User has BYOK key for this provider? → use BYOK key
  2. User has active subscription? → use platform key (env var)
  3. Neither? → 403 error
```

### Model Selector

- **Subscribed users:** All 4 models shown
- **BYOK users:** Only models for providers with configured keys

## New Dependencies

| Package | Purpose |
|---------|---------|
| `next-auth` | Authentication framework |
| `resend` | Email delivery for magic links |
| `stripe` | Stripe Node.js SDK |

## New Environment Variables

| Variable | Purpose |
|----------|---------|
| `CWAI_NEXTAUTH_SECRET` | NextAuth JWT signing secret |
| `CWAI_NEXTAUTH_URL` | App URL for NextAuth callbacks |
| `CWAI_RESEND_API_KEY` | Resend API key for sending magic link emails |
| `CWAI_RESEND_FROM_EMAIL` | Sender email address (e.g. login@yourdomain.com) |
| `CWAI_STRIPE_SECRET_KEY` | Stripe secret key |
| `CWAI_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (client-side) |
| `CWAI_STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `CWAI_STRIPE_PRICE_ID` | Stripe Price ID for the $20/mo plan |
| `CWAI_ENCRYPTION_KEY` | AES-256 key for encrypting BYOK API keys |

## Migration Notes

- Existing conversations in DB have no `user_id` — they become orphaned (acceptable for fresh launch)
- Add `user_id` column to `conversations` and `responses` tables
- All existing env var API keys (`CWAI_ANTHROPIC_API_KEY`, etc.) become platform keys used for subscribed users
