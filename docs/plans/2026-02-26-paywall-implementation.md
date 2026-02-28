# Shared Password Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Gate the entire app behind a shared password so strangers can't burn API tokens.

**Architecture:** Next.js middleware checks for an HMAC-based auth cookie on every request. Missing/invalid cookie redirects to `/login`. A POST to `/api/auth` validates the password against `CWAI_ACCESS_PASSWORD` env var and sets the cookie. No DB changes needed.

**Tech Stack:** Next.js middleware, Node.js `crypto` (HMAC-SHA256, `timingSafeEqual`), HttpOnly cookies.

---

### Task 1: Auth Library (`src/lib/auth.ts`)

Core auth utilities used by both middleware and API route.

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/__tests__/auth.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('auth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  describe('generateToken', () => {
    it('returns a hex string', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { generateToken } = await import('@/lib/auth')
      const token = generateToken()
      expect(token).toMatch(/^[a-f0-9]{64}$/)
    })

    it('produces the same token for the same password', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { generateToken } = await import('@/lib/auth')
      expect(generateToken()).toBe(generateToken())
    })

    it('produces different tokens for different passwords', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'password-a')
      const authA = await import('@/lib/auth')
      const tokenA = authA.generateToken()

      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'password-b')
      // Need fresh import to pick up new env
      vi.resetModules()
      const authB = await import('@/lib/auth')
      const tokenB = authB.generateToken()

      expect(tokenA).not.toBe(tokenB)
    })
  })

  describe('verifyPassword', () => {
    it('returns true for correct password', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { verifyPassword } = await import('@/lib/auth')
      expect(verifyPassword('test-password')).toBe(true)
    })

    it('returns false for wrong password', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { verifyPassword } = await import('@/lib/auth')
      expect(verifyPassword('wrong')).toBe(false)
    })

    it('returns false when no password is configured', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', '')
      const { verifyPassword } = await import('@/lib/auth')
      expect(verifyPassword('anything')).toBe(false)
    })
  })

  describe('verifyToken', () => {
    it('returns true for a valid token', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { generateToken, verifyToken } = await import('@/lib/auth')
      const token = generateToken()
      expect(verifyToken(token)).toBe(true)
    })

    it('returns false for an invalid token', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { verifyToken } = await import('@/lib/auth')
      expect(verifyToken('bad-token')).toBe(false)
    })

    it('returns false for empty token', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { verifyToken } = await import('@/lib/auth')
      expect(verifyToken('')).toBe(false)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/auth.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/auth.ts
import { createHmac, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'cwai-auth'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

function getPassword(): string {
  return process.env.CWAI_ACCESS_PASSWORD || ''
}

export function generateToken(): string {
  const password = getPassword()
  return createHmac('sha256', 'cwai-auth-key').update(password).digest('hex')
}

export function verifyPassword(input: string): boolean {
  const password = getPassword()
  if (!password) return false
  const a = Buffer.from(input)
  const b = Buffer.from(password)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function verifyToken(token: string): boolean {
  if (!token || !getPassword()) return false
  const expected = generateToken()
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export { COOKIE_NAME, COOKIE_MAX_AGE }
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/auth.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "feat: add auth library with HMAC token generation and verification"
```

---

### Task 2: Auth API Route (`src/app/api/auth/route.ts`)

POST endpoint that validates the password and sets the auth cookie.

**Files:**
- Create: `src/app/api/auth/route.ts`
- Create: `src/app/api/auth/__tests__/route.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/app/api/auth/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')

// Import after stubbing env
const { POST } = await import('../route')

describe('POST /api/auth', () => {
  it('returns 200 and sets cookie for correct password', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-password' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain('cwai-auth=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Path=/')
  })

  it('returns 401 for wrong password', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toBeNull()
  })

  it('returns 400 for missing password', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/auth/__tests__/route.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/app/api/auth/route.ts
import { NextResponse } from 'next/server'
import { verifyPassword, generateToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { password } = body

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  }

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = generateToken()
  const isProduction = process.env.NODE_ENV === 'production'

  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })

  return response
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/auth/__tests__/route.test.ts`
Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add src/app/api/auth/route.ts src/app/api/auth/__tests__/route.test.ts
git commit -m "feat: add POST /api/auth endpoint for password validation"
```

---

### Task 3: Middleware (`src/middleware.ts`)

Next.js middleware that checks the auth cookie on every request.

**Files:**
- Create: `src/middleware.ts`

**Step 1: Write the middleware**

Note: Next.js middleware runs in the Edge Runtime and can't easily be unit tested with Vitest. We'll test it via integration in Task 5.

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token || !verifyToken(token)) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware to protect all routes"
```

---

### Task 4: Login Page (`src/app/login/page.tsx`)

Simple password form matching the app's warm editorial design.

**Files:**
- Create: `src/app/login/page.tsx`

**Step 1: Write the login page**

```tsx
// src/app/login/page.tsx
'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        router.push('/')
      } else {
        setError('Wrong password')
        setPassword('')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-ink mb-2">
        Conversation With AI
      </h1>
      <p className="text-ink-muted mb-8">Enter the password to continue</p>
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full px-4 py-3 rounded-lg border border-border bg-card text-ink placeholder:text-ink-faint focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-colors"
        />
        {error && (
          <p className="mt-2 text-sm text-danger">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full mt-4 px-4 py-3 rounded-lg bg-amber text-white font-medium hover:bg-amber/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Checking...' : 'Enter'}
        </button>
      </form>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add login page with password form"
```

---

### Task 5: Add Env Var to Config and Verify

Wire up the env var in local dev and Render config.

**Files:**
- Modify: `render.yaml` — add `CWAI_ACCESS_PASSWORD` env var
- Modify: `.env.local` — add password for local dev

**Step 1: Update render.yaml**

Add after the existing env vars:

```yaml
      - key: CWAI_ACCESS_PASSWORD
        sync: false
```

**Step 2: Add to local `.env.local`**

```
CWAI_ACCESS_PASSWORD=your-local-dev-password
```

**Step 3: Manual smoke test**

Run: `npm run dev`

1. Open `http://localhost:3000` — should redirect to `/login`
2. Enter wrong password — should show "Wrong password"
3. Enter correct password — should redirect to home page
4. Refresh home page — should stay (cookie persists)
5. Open `/api/conversations` directly — should work (cookie present)
6. Clear cookies and try `/api/conversations` — should redirect to `/login`

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All existing tests + new auth tests pass

**Step 5: Commit**

```bash
git add render.yaml
git commit -m "feat: add CWAI_ACCESS_PASSWORD env var to Render config"
```

---

### Task 6: Update Documentation

**Files:**
- Modify: `docs/architecture.md` — add auth section
- Modify: `README.md` — add password setup instructions

**Step 1: Update architecture.md**

Add to component table:
- `src/lib/auth.ts` — HMAC token generation, password verification
- `src/middleware.ts` — Auth gate, redirects unauthenticated users to `/login`
- `src/app/login/page.tsx` — Password entry form
- `src/app/api/auth/route.ts` — Password validation, sets auth cookie

Add ADR:
- ADR: Chose shared password gate over OAuth/invite codes for simplicity. Single `CWAI_ACCESS_PASSWORD` env var + HMAC cookie. No DB changes needed.

Add changelog entry.

**Step 2: Update README.md**

Add to setup section:
- `CWAI_ACCESS_PASSWORD` — shared password to gate access (required)

**Step 3: Commit**

```bash
git add docs/architecture.md README.md
git commit -m "docs: add auth gate to architecture docs and README"
```
