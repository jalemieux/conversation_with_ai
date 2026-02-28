# Shared Password Gate Design

## Problem

The app is completely open — anyone with the URL can trigger AI API calls that burn tokens. Need a simple gate to prevent unauthorized usage.

## Approach

Shared password gate. A single passphrase stored as an env var. User enters it once, gets an HttpOnly cookie, and has access for 30 days.

## Architecture

```
Middleware (all routes)
    │
    Has valid cookie? ──yes──→ Pass through to app
    │
    no
    │
    Redirect to /login
    │
    Password form → POST /api/auth
    │
    Match? ──yes──→ Set cookie + redirect to home
    │
    no → Show error
```

## Components

| Component | Purpose |
|-----------|---------|
| `src/middleware.ts` | Check auth cookie, redirect to `/login` if missing |
| `src/app/login/page.tsx` | Password form (client component) |
| `src/app/api/auth/route.ts` | Validate password, set HttpOnly cookie |
| `CWAI_ACCESS_PASSWORD` env var | The shared password |

## Cookie Design

- Name: `cwai-auth`
- Value: HMAC-SHA256 of the password using a server-derived key
- Flags: HttpOnly, Secure (production), SameSite=Lax
- Expiry: 30 days

## Security

- Timing-safe password comparison
- HttpOnly cookie (no JS access)
- HMAC-based cookie value prevents forgery
- Password never stored in cookie

## Excluded from Scope

- User accounts / DB changes
- Logout button (cookie expires naturally)
- Per-user usage tracking
- Rate limiting
