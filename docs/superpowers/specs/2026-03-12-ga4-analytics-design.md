# Comprehensive GA4 Analytics for Conversation With AI

## Overview

Enhance the existing bare-bones GA4 setup with custom events, user identification, conversion tracking, and cost metrics to provide full visibility into user acquisition, engagement, monetization, and retention.

**Approach:** GA4-only. No new dependencies, no database changes, no new infrastructure. A typed analytics utility module plus event calls in existing components and API routes.

## Architecture

### Analytics Module: `src/lib/analytics.ts`

A typed wrapper around `gtag()` providing:

- `trackEvent(name, params)` — fire a custom GA4 event
- `identifyUser(userId, properties)` — set user ID (SHA-256 hash of DB user ID) and user properties
- `trackLandingVariant(variant)` — record which landing variant was seen
- `GA_ENABLED` guard — no-ops in development, SSR, and when `window.gtag` is unavailable

All functions are safe to call anywhere — they silently no-op when analytics isn't available.

### Server-Side Events: GA4 Measurement Protocol

For events that originate on the server (Stripe webhooks, auth callbacks), use the GA4 Measurement Protocol HTTP API to send events directly to GA4.

- Requires a Measurement Protocol API secret (free, configured in GA4 admin → Data Streams → Measurement Protocol)
- New env var: `CWAI_GA4_MEASUREMENT_PROTOCOL_SECRET`
- Utility function in `src/lib/analytics-server.ts`: `sendServerEvent(clientId, userId, events)`

### User Identification

On session load (client-side), call `gtag('config', GA_MEASUREMENT_ID, { user_id: hashedUserId })` and set user properties. The hash is SHA-256 of the user's database ID to keep it opaque.

**User properties** (set once per session):
- `subscription_status` — active / inactive / trialing
- `has_byok_keys` — true / false
- `account_age_days` — integer

### Landing Variant Attribution

When a user visits `/landing-a`, `/landing-b`, or `/landing-c`:
1. Fire `landing_view` event with `variant` parameter
2. Store `variant` in `sessionStorage` under key `landing_variant`
3. On CTA click, fire `landing_cta_click` with `variant`
4. On sign-up, read `landing_variant` from `sessionStorage` and include it in the `sign_up` event

This connects the landing variant to the conversion without cookies or database changes.

## Event Taxonomy

All events use `snake_case` naming per GA4 conventions. Custom parameters stay within GA4 limits (25 custom dimensions, 50 custom metrics).

### Acquisition Events

| Event | Parameters | Trigger | Client/Server |
|---|---|---|---|
| `landing_view` | `variant` (a/b/c) | Landing page component mounts | Client |
| `landing_cta_click` | `variant` | CTA button clicked | Client |
| `sign_up` | `variant` (from sessionStorage, nullable) | Account created via auth callback | Server |
| `login` | `method: "magic_link"` | Successful login | Client |

### Engagement Events

| Event | Parameters | Trigger | Client/Server |
|---|---|---|---|
| `conversation_started` | `topic_type`, `framework` | User submits topic from home page | Client |
| `round_completed` | `round` (1/2), `conversation_id` | All 4 models finish responding for a round | Client |
| `conversation_completed` | `conversation_id`, `total_cost`, `total_tokens` | Round 2 finishes (all models done) | Client |
| `model_response` | `model`, `round`, `input_tokens`, `output_tokens`, `cost` | Individual model response received | Client |
| `tts_played` | `model` | User clicks play on TTS | Client |
| `export_clicked` | `format` (markdown/text/x_thread) | User exports conversation | Client |
| `share_clicked` | `conversation_id` | User clicks share button | Client |
| `copy_clicked` | `model` | User copies a model's response | Client |

### Monetization Events

| Event | Parameters | Trigger | Client/Server |
|---|---|---|---|
| `begin_checkout` | — | User clicks subscribe button | Client |
| `purchase` | `value: 20`, `currency: "USD"` | Stripe webhook: `checkout.session.completed` | Server |
| `subscription_renewed` | `value: 20` | Stripe webhook: `invoice.paid` | Server |
| `subscription_cancelled` | — | Stripe webhook: `customer.subscription.deleted` | Server |

### BYOK Events

| Event | Parameters | Trigger | Client/Server |
|---|---|---|---|
| `api_key_added` | `provider` | User saves an API key | Client |
| `api_key_removed` | `provider` | User deletes an API key | Client |

## Files to Create

| File | Purpose |
|---|---|
| `src/lib/analytics.ts` | Client-side analytics wrapper (trackEvent, identifyUser, etc.) |
| `src/lib/analytics-server.ts` | Server-side GA4 Measurement Protocol utility |

## Files to Modify

| File | Changes |
|---|---|
| `src/app/layout.tsx` | Add user identification on session load |
| `src/app/landing-a/page.tsx` | Add `landing_view`, `landing_cta_click` events, store variant in sessionStorage |
| `src/app/landing-b/page.tsx` | Same as landing-a |
| `src/app/landing-c/page.tsx` | Same as landing-c |
| `src/app/page.tsx` | Add `conversation_started` event on topic submit |
| `src/app/conversation/page.tsx` | Add `round_completed`, `conversation_completed`, `model_response` events |
| `src/app/settings/page.tsx` | Add `begin_checkout`, `api_key_added`, `api_key_removed` events |
| `src/app/login/page.tsx` | Add `login` event on successful auth |
| `src/components/ShareButton.tsx` | Add `share_clicked` event |
| `src/components/CopyButton.tsx` | Add `copy_clicked` event |
| `src/components/SpeakerButton.tsx` | Add `tts_played` event |
| `src/app/api/stripe/webhook/route.ts` | Add server-side `purchase`, `subscription_renewed`, `subscription_cancelled` events |
| `src/lib/auth-config.ts` | Add server-side `sign_up` event in auth callback |

## GA4 Configuration Required (Manual)

These steps must be done in the GA4 admin console (not code):

1. **Create Measurement Protocol API secret** — GA4 Admin → Data Streams → select stream → Measurement Protocol → Create
2. **Register custom dimensions** — GA4 Admin → Custom definitions → Create:
   - `variant` (event-scoped)
   - `topic_type` (event-scoped)
   - `framework` (event-scoped)
   - `model` (event-scoped)
   - `round` (event-scoped)
   - `format` (event-scoped)
   - `provider` (event-scoped)
   - `conversation_id` (event-scoped)
3. **Register custom metrics** — GA4 Admin → Custom definitions → Create:
   - `total_cost` (currency)
   - `total_tokens` (number)
   - `input_tokens` (number)
   - `output_tokens` (number)
   - `cost` (currency)
4. **Mark conversions** — GA4 Admin → Events → mark as conversion:
   - `sign_up`
   - `purchase`
   - `subscription_cancelled`
5. **Register user properties** — GA4 Admin → Custom definitions → User properties:
   - `subscription_status`
   - `has_byok_keys`
   - `account_age_days`

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `CWAI_GA4_MEASUREMENT_PROTOCOL_SECRET` | For server-side events | GA4 Measurement Protocol API secret |

The existing `G-4WBHPXNRST` measurement ID will be used as a constant in the analytics module.

## Testing Strategy

- **Unit tests** for `analytics.ts` — verify events fire with correct parameters, verify no-op in SSR/dev
- **Unit tests** for `analytics-server.ts` — verify Measurement Protocol payloads are correctly formed
- **Manual verification** — use GA4 DebugView (real-time) to confirm events arrive with correct parameters
- **No integration tests against GA4** — the Measurement Protocol and gtag are external services; mock them in tests

## Privacy Considerations

- User IDs are SHA-256 hashed before sending to GA4 — no PII leaves the app
- No email addresses or names are sent to GA4
- GA4's IP anonymization is enabled by default
- The app's existing cookie consent (if any) should gate analytics loading
