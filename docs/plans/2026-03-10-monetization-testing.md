# Monetization Testing Guide

## Prerequisites

### 1. Generate Secrets

```bash
# NextAuth secret
openssl rand -hex 32

# Encryption key for BYOK (exactly 64 hex chars = 32 bytes)
openssl rand -hex 32
```

### 2. Set Up Resend

1. Sign up at https://resend.com (free tier = 3k emails/mo)
2. Get API key from dashboard
3. Use `onboarding@resend.dev` as from email for dev, or verify your own domain

### 3. Set Up Stripe (Test Mode)

1. Go to https://dashboard.stripe.com — toggle **Test mode** on
2. Copy test secret key (`sk_test_...`) and publishable key (`pk_test_...`)
3. Create product + price:
   - Products > Add product > "Conversation With AI Pro", $20/month recurring
   - Copy the Price ID (`price_...`)
4. Set up local webhook forwarding:

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret (`whsec_...`) from the output.

### 4. Add to `.env.local`

```bash
# Auth
CWAI_NEXTAUTH_SECRET=<generated-secret>
CWAI_NEXTAUTH_URL=http://localhost:3000
CWAI_RESEND_API_KEY=re_...
CWAI_RESEND_FROM_EMAIL=onboarding@resend.dev

# Stripe (test mode)
CWAI_STRIPE_SECRET_KEY=sk_test_...
CWAI_STRIPE_PUBLISHABLE_KEY=pk_test_...
CWAI_STRIPE_WEBHOOK_SECRET=whsec_...
CWAI_STRIPE_PRICE_ID=price_...

# Encryption
CWAI_ENCRYPTION_KEY=<generated-64-char-hex>

# Existing keys (platform keys for subscribers)
CWAI_ANTHROPIC_API_KEY=...
CWAI_OPENAI_API_KEY=...
CWAI_GOOGLE_API_KEY=...
CWAI_XAI_API_KEY=...
```

### 5. Run

```bash
cd .worktrees/monetization
npm run dev
```

Keep `stripe listen` running in a separate terminal.

---

## Test Flows

### Flow 1: Magic Link Login

1. Go to `localhost:3000` — should redirect to `/login`
2. Enter your email, click "Send login link"
3. Check inbox (or Resend dashboard for logs) — click the magic link
4. Should land on `/setup` (no subscription, no keys yet)

### Flow 2: BYOK (Bring Your Own Keys)

1. On `/setup` — click "Use your own API keys"
2. On `/settings` — select a provider (e.g. Anthropic), paste your API key, click Save
3. Go to `/` — only models matching your configured keys should appear
4. Start a conversation — should work using your key
5. Go back to `/settings` — remove the key, verify model disappears from selector

### Flow 3: Stripe Subscription

1. On `/setup` (or `/settings`) — click "Subscribe for $20/month"
2. Stripe Checkout opens — use test card `4242 4242 4242 4242`, any future expiry, any CVC
3. After payment — redirected back to app
4. Go to `/` — all 4 models should be available
5. Go to `/settings` — subscription shows "Active — $20/month" with renewal date
6. Click "Manage subscription" — Stripe Customer Portal opens

### Flow 4: Verify Webhooks

Watch the `stripe listen` terminal — you should see:
- `checkout.session.completed` — after successful payment
- `invoice.paid` — payment confirmed

### Flow 5: Mixed (Subscription + BYOK)

1. Subscribe via Stripe (all models available)
2. Also add a BYOK key in settings
3. BYOK key should be used preferentially for that provider
4. Platform key used for other providers

### Flow 6: Access Gate

1. Remove all BYOK keys from `/settings`
2. Cancel subscription via Stripe Portal
3. After cancellation webhook fires, navigating to `/` should redirect to `/setup`

---

## Stripe Test Cards

| Card | Scenario |
|------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0341` | Payment fails (card declined) |
| `4000 0000 0000 3220` | Requires 3D Secure auth |
| `4000 0000 0000 9995` | Insufficient funds |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Magic link not arriving | Check Resend dashboard for delivery logs. Verify `CWAI_RESEND_API_KEY` is set. |
| "Unauthorized" on API calls | Session may not be set. Check browser cookies for `authjs.session-token`. |
| Stripe checkout fails | Verify `CWAI_STRIPE_PRICE_ID` matches your test product. Check Stripe dashboard logs. |
| Webhook not updating DB | Make sure `stripe listen` is running and `CWAI_STRIPE_WEBHOOK_SECRET` matches. |
| Models not showing after subscribe | Webhook may not have fired. Check `stripe listen` output. Refresh the page. |
| "No API key for provider" error | User has no BYOK key for that provider AND no active subscription. |

---

## Branch Info

- **Worktree:** `.worktrees/monetization`
- **Branch:** `feat/monetization`
- **Tests:** `npx vitest run` — 146 tests, 17 suites, all passing
- **Status:** Implementation complete, needs manual testing of all flows above
