# Monetization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add magic link auth, Stripe $20/mo subscription, and BYOK API key management so users must either pay or bring their own keys.

**Architecture:** NextAuth with Resend email provider for passwordless login. Stripe Checkout + webhooks for subscriptions. AES-256-GCM encrypted BYOK key storage. Middleware enforces auth + access. API routes resolve keys per-user (BYOK first, then platform key for subscribers).

**Tech Stack:** NextAuth v5, Resend, Stripe, AES-256-GCM (Node crypto), Drizzle ORM on SQLite

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run:
```bash
npm install next-auth@beta resend stripe
```

**Step 2: Verify installation**

Run: `npm ls next-auth resend stripe`
Expected: All three packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add next-auth, resend, stripe dependencies"
```

---

## Task 2: Add Auth DB Schema (users, accounts, verification_tokens)

**Files:**
- Modify: `src/db/schema.ts`
- Test: `src/db/schema.test.ts`

**Step 1: Write the failing test**

Add to `src/db/schema.test.ts`:

```typescript
import { users, accounts, verificationTokens, userApiKeys } from './schema'

describe('auth tables', () => {
  it('users table has expected columns', () => {
    const cols = Object.keys(users)
    expect(cols).toContain('id')
    expect(cols).toContain('email')
    expect(cols).toContain('stripeCustomerId')
    expect(cols).toContain('subscriptionStatus')
  })

  it('accounts table has expected columns', () => {
    const cols = Object.keys(accounts)
    expect(cols).toContain('userId')
    expect(cols).toContain('provider')
    expect(cols).toContain('providerAccountId')
  })

  it('verificationTokens table has expected columns', () => {
    const cols = Object.keys(verificationTokens)
    expect(cols).toContain('identifier')
    expect(cols).toContain('token')
    expect(cols).toContain('expires')
  })

  it('userApiKeys table has expected columns', () => {
    const cols = Object.keys(userApiKeys)
    expect(cols).toContain('userId')
    expect(cols).toContain('provider')
    expect(cols).toContain('encryptedKey')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/schema.test.ts`
Expected: FAIL — `users`, `accounts`, etc. not exported

**Step 3: Add tables to schema**

In `src/db/schema.ts`, add after existing tables:

```typescript
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: text('email_verified'),
  image: text('image'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: text('subscription_status').notNull().default('none'),
  subscriptionCurrentPeriodEnd: text('subscription_current_period_end'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
})

export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: text('expires').notNull(),
})

export const userApiKeys = sqliteTable('user_api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // anthropic | openai | google | xai
  encryptedKey: text('encrypted_key').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/db/schema.ts src/db/schema.test.ts
git commit -m "feat(db): add users, accounts, verification_tokens, user_api_keys tables"
```

---

## Task 3: Add DB Migration for New Tables

**Files:**
- Modify: `src/db/index.ts`

**Step 1: Add CREATE TABLE statements**

In `src/db/index.ts`, add the following SQL inside `initDb()` after the existing `sqlite.exec(...)` block (the one that creates `conversations` and `responses`):

```typescript
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT NOT NULL UNIQUE,
      email_verified TEXT,
      image TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'none',
      subscription_current_period_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT
    );
    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, provider)
    );
  `)
```

Also add a migration for `user_id` on existing `conversations` table:

```typescript
  // Migration: add user_id column to conversations if missing
  const hasUserId = sqlite.prepare(
    `SELECT COUNT(*) as cnt FROM pragma_table_info('conversations') WHERE name = 'user_id'`
  ).get() as { cnt: number }
  if (hasUserId.cnt === 0) {
    sqlite.exec(`ALTER TABLE conversations ADD COLUMN user_id TEXT REFERENCES users(id)`)
  }
```

**Step 2: Verify the app starts**

Run: `npm run dev` — check that the server starts without errors. Kill it.

**Step 3: Commit**

```bash
git add src/db/index.ts
git commit -m "feat(db): add migration for auth and BYOK tables"
```

---

## Task 4: Encryption Utilities for BYOK Keys

**Files:**
- Create: `src/lib/encryption.ts`
- Create: `src/lib/__tests__/encryption.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/encryption.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Set env before import
vi.stubEnv('CWAI_ENCRYPTION_KEY', 'a'.repeat(64)) // 32 bytes hex

const { encrypt, decrypt } = await import('../encryption')

describe('encryption', () => {
  it('encrypts and decrypts a string', () => {
    const plaintext = 'sk-test-api-key-12345'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toContain(':') // iv:authTag:ciphertext format
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'sk-test-api-key-12345'
    const a = encrypt(plaintext)
    const b = encrypt(plaintext)
    expect(a).not.toBe(b)
  })

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('test')
    const parts = encrypted.split(':')
    parts[2] = 'ff' + parts[2].slice(2) // tamper with ciphertext
    expect(() => decrypt(parts.join(':'))).toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/encryption.test.ts`
Expected: FAIL — module not found

**Step 3: Implement encryption**

Create `src/lib/encryption.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getKey(): Buffer {
  const hex = process.env.CWAI_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('CWAI_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(encryptedStr: string): string {
  const key = getKey()
  const [ivHex, authTagHex, ciphertextHex] = encryptedStr.split(':')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()])
  return decrypted.toString('utf8')
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/encryption.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/encryption.ts src/lib/__tests__/encryption.test.ts
git commit -m "feat: add AES-256-GCM encryption for BYOK keys"
```

---

## Task 5: NextAuth Configuration

**Files:**
- Create: `src/lib/auth-config.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Step 1: Create the NextAuth config**

Create `src/lib/auth-config.ts`:

```typescript
import NextAuth from 'next-auth'
import Resend from 'next-auth/providers/resend'
import { db } from '@/db'
import { users, accounts, verificationTokens } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Resend({
      apiKey: process.env.CWAI_RESEND_API_KEY,
      from: process.env.CWAI_RESEND_FROM_EMAIL || 'noreply@example.com',
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 10 * 365 * 24 * 60 * 60, // ~10 years
  },
  secret: process.env.CWAI_NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
    verifyRequest: '/login/verify',
  },
  adapter: {
    createUser: async (data) => {
      const id = randomUUID()
      await db.insert(users).values({
        id,
        email: data.email,
        name: data.name ?? null,
        emailVerified: data.emailVerified?.toISOString() ?? null,
        image: data.image ?? null,
      })
      const [user] = await db.select().from(users).where(eq(users.id, id))
      return { ...user, emailVerified: user.emailVerified ? new Date(user.emailVerified) : null }
    },
    getUser: async (id) => {
      const [user] = await db.select().from(users).where(eq(users.id, id))
      if (!user) return null
      return { ...user, emailVerified: user.emailVerified ? new Date(user.emailVerified) : null }
    },
    getUserByEmail: async (email) => {
      const [user] = await db.select().from(users).where(eq(users.email, email))
      if (!user) return null
      return { ...user, emailVerified: user.emailVerified ? new Date(user.emailVerified) : null }
    },
    getUserByAccount: async ({ provider, providerAccountId }) => {
      const [account] = await db.select().from(accounts).where(
        and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId))
      )
      if (!account) return null
      const [user] = await db.select().from(users).where(eq(users.id, account.userId))
      if (!user) return null
      return { ...user, emailVerified: user.emailVerified ? new Date(user.emailVerified) : null }
    },
    updateUser: async (data) => {
      if (!data.id) throw new Error('User id required')
      const updates: Record<string, unknown> = {}
      if (data.name !== undefined) updates.name = data.name
      if (data.email !== undefined) updates.email = data.email
      if (data.emailVerified !== undefined) updates.emailVerified = data.emailVerified?.toISOString() ?? null
      if (data.image !== undefined) updates.image = data.image
      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, data.id))
      }
      const [user] = await db.select().from(users).where(eq(users.id, data.id))
      return { ...user, emailVerified: user.emailVerified ? new Date(user.emailVerified) : null }
    },
    linkAccount: async (data) => {
      await db.insert(accounts).values({
        id: randomUUID(),
        userId: data.userId,
        type: data.type,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        refreshToken: data.refresh_token ?? null,
        accessToken: data.access_token ?? null,
        expiresAt: data.expires_at ?? null,
        tokenType: data.token_type ?? null,
        scope: data.scope ?? null,
        idToken: data.id_token ?? null,
        sessionState: data.session_state as string ?? null,
      })
    },
    createVerificationToken: async (data) => {
      await db.insert(verificationTokens).values({
        identifier: data.identifier,
        token: data.token,
        expires: data.expires.toISOString(),
      })
      return data
    },
    useVerificationToken: async ({ identifier, token }) => {
      const [row] = await db.select().from(verificationTokens).where(
        and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token))
      )
      if (!row) return null
      await db.delete(verificationTokens).where(eq(verificationTokens.token, token))
      return { ...row, expires: new Date(row.expires) }
    },
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id
      }
      return token
    },
    session: async ({ session, token }) => {
      if (token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
```

**Step 2: Create the route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/lib/auth-config'

export const { GET, POST } = handlers
```

**Step 3: Verify the app compiles**

Run: `npx next build` (or `npm run dev` and hit `/api/auth/signin`)
Expected: No compile errors. The auth routes should be reachable.

**Step 4: Commit**

```bash
git add src/lib/auth-config.ts src/app/api/auth/\[...nextauth\]/route.ts
git commit -m "feat(auth): add NextAuth config with Resend magic link provider"
```

---

## Task 6: Update Middleware for NextAuth + Access Control

**Files:**
- Modify: `src/middleware.ts`
- Create: `src/lib/access.ts`
- Create: `src/lib/__tests__/access.test.ts`

**Step 1: Write the access check test**

Create `src/lib/__tests__/access.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { hasAccess } from '../access'

describe('hasAccess', () => {
  it('returns true if user has active subscription', () => {
    expect(hasAccess({ subscriptionStatus: 'active', hasKeys: false })).toBe(true)
  })

  it('returns true if user has BYOK keys', () => {
    expect(hasAccess({ subscriptionStatus: 'none', hasKeys: true })).toBe(true)
  })

  it('returns false if user has neither', () => {
    expect(hasAccess({ subscriptionStatus: 'none', hasKeys: false })).toBe(false)
  })

  it('returns true if subscription is active even without keys', () => {
    expect(hasAccess({ subscriptionStatus: 'active', hasKeys: false })).toBe(true)
  })

  it('returns false for canceled subscription without keys', () => {
    expect(hasAccess({ subscriptionStatus: 'canceled', hasKeys: false })).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/access.test.ts`
Expected: FAIL

**Step 3: Implement access check**

Create `src/lib/access.ts`:

```typescript
export function hasAccess({ subscriptionStatus, hasKeys }: {
  subscriptionStatus: string
  hasKeys: boolean
}): boolean {
  return subscriptionStatus === 'active' || hasKeys
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/access.test.ts`
Expected: PASS

**Step 5: Update middleware**

Replace `src/middleware.ts` entirely:

```typescript
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/stripe/webhook']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Check NextAuth session via the session token cookie
  // NextAuth v5 uses __Secure-authjs.session-token in prod, authjs.session-token in dev
  const sessionToken = request.cookies.get('authjs.session-token')?.value
    || request.cookies.get('__Secure-authjs.session-token')?.value

  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Access check (subscription or BYOK keys) is done at the page/API level
  // because middleware can't do DB queries with better-sqlite3 (edge runtime limitation).
  // Pages that need access check will call a server function.
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

> **Note:** The middleware only checks for session presence. The access gate (subscription or BYOK keys) is enforced at the page level via a server component or API check, because better-sqlite3 doesn't run in edge runtime. We'll add this in the setup page and API routes.

**Step 6: Commit**

```bash
git add src/middleware.ts src/lib/access.ts src/lib/__tests__/access.test.ts
git commit -m "feat(auth): update middleware for NextAuth, add access check utility"
```

---

## Task 7: Login Page (Magic Link)

**Files:**
- Rewrite: `src/app/login/page.tsx`
- Create: `src/app/login/verify/page.tsx`

**Step 1: Rewrite the login page**

Replace `src/app/login/page.tsx` entirely:

```tsx
'use client'

import { useState, FormEvent } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { signIn } = await import('next-auth/react')
      const result = await signIn('resend', {
        email,
        redirect: false,
        callbackUrl: '/',
      })

      if (result?.error) {
        setError('Failed to send login link. Please try again.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-ink mb-2">
          Check your email
        </h1>
        <p className="text-ink-muted mb-2">
          We sent a login link to <strong>{email}</strong>
        </p>
        <p className="text-ink-faint text-sm">
          Click the link in the email to sign in. You can close this tab.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-ink mb-2">
        Conversation With AI
      </h1>
      <p className="text-ink-muted mb-8">Enter your email to sign in</p>
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoFocus
          required
          className="w-full px-4 py-3 rounded-lg border border-border bg-card text-ink placeholder:text-ink-faint focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-colors"
        />
        {error && (
          <p className="mt-2 text-sm text-danger">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading || !email}
          className="w-full mt-4 px-4 py-3 rounded-lg bg-amber text-white font-medium hover:bg-amber/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {loading ? 'Sending...' : 'Send login link'}
        </button>
      </form>
    </div>
  )
}
```

**Step 2: Create verify page**

Create `src/app/login/verify/page.tsx`:

```tsx
export default function VerifyPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-ink mb-2">
        Check your email
      </h1>
      <p className="text-ink-muted">
        A sign-in link has been sent to your email address.
      </p>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/login/page.tsx src/app/login/verify/page.tsx
git commit -m "feat(auth): rewrite login page for magic link flow"
```

---

## Task 8: Remove Old Auth System

**Files:**
- Delete: `src/lib/auth.ts`
- Delete: `src/lib/__tests__/auth.test.ts`
- Delete: `src/app/api/auth/route.ts` (replaced by `[...nextauth]`)
- Delete: `src/app/api/auth/__tests__/route.test.ts`

**Step 1: Delete old auth files**

Run:
```bash
rm src/lib/auth.ts src/lib/__tests__/auth.test.ts src/app/api/auth/route.ts
rm -rf src/app/api/auth/__tests__
```

**Step 2: Verify no remaining imports of old auth**

Run: `grep -r "from.*@/lib/auth" src/ --include="*.ts" --include="*.tsx"` — should return nothing (middleware was already updated in Task 6).

If any remaining imports found, update them.

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (auth tests removed, no broken imports)

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(auth): remove old password-based auth system"
```

---

## Task 9: User Access Check Helper (Server-Side)

**Files:**
- Create: `src/lib/user-access.ts`
- Create: `src/lib/__tests__/user-access.test.ts`

This helper fetches user data from DB and determines access + available models.

**Step 1: Write the failing test**

Create `src/lib/__tests__/user-access.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAvailableModelKeys } from '../user-access'

describe('getAvailableModelKeys', () => {
  it('returns all models for subscribed user', () => {
    const result = getAvailableModelKeys('active', [])
    expect(result).toEqual(['claude', 'gpt', 'gemini', 'grok'])
  })

  it('returns only keyed models for BYOK user', () => {
    const result = getAvailableModelKeys('none', ['anthropic', 'openai'])
    expect(result).toEqual(['claude', 'gpt'])
  })

  it('returns empty for user with no access', () => {
    const result = getAvailableModelKeys('none', [])
    expect(result).toEqual([])
  })

  it('returns all models for subscriber even with some keys', () => {
    const result = getAvailableModelKeys('active', ['anthropic'])
    expect(result).toEqual(['claude', 'gpt', 'gemini', 'grok'])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/user-access.test.ts`
Expected: FAIL

**Step 3: Implement**

Create `src/lib/user-access.ts`:

```typescript
import { MODEL_CONFIGS } from './models'

const PROVIDER_TO_MODELS: Record<string, string[]> = {}

// Build reverse map: provider → model keys
for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
  if (!PROVIDER_TO_MODELS[config.provider]) {
    PROVIDER_TO_MODELS[config.provider] = []
  }
  PROVIDER_TO_MODELS[config.provider].push(key)
}

export function getAvailableModelKeys(
  subscriptionStatus: string,
  userProviders: string[], // providers for which user has BYOK keys
): string[] {
  if (subscriptionStatus === 'active') {
    return Object.keys(MODEL_CONFIGS)
  }

  // BYOK: only models whose provider has a key
  const available: string[] = []
  for (const provider of userProviders) {
    const models = PROVIDER_TO_MODELS[provider]
    if (models) available.push(...models)
  }
  return available
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/user-access.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/user-access.ts src/lib/__tests__/user-access.test.ts
git commit -m "feat: add user access check and available model resolution"
```

---

## Task 10: API Key Resolution for Model Providers

**Files:**
- Modify: `src/lib/models.ts`
- Modify: `src/lib/models.test.ts`

Currently `models.ts` creates providers at module load using env vars. We need to make `getModelProvider` accept an optional API key override (for BYOK).

**Step 1: Write the failing test**

Add to `src/lib/models.test.ts`:

```typescript
describe('getModelProvider with BYOK key', () => {
  it('accepts an optional apiKey override', () => {
    // Should not throw when called with a key
    const provider = getModelProvider('claude', 'sk-test-key')
    expect(provider).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/models.test.ts`
Expected: FAIL — `getModelProvider` doesn't accept a second argument (or ignores it)

**Step 3: Refactor getModelProvider**

In `src/lib/models.ts`, replace the top-level provider instantiation and `getModelProvider`:

Remove lines 6-9 (the top-level `const anthropic = ...` etc.) and modify `PROVIDERS` and `getModelProvider`:

```typescript
// Remove these lines:
// const anthropic = createAnthropic({ apiKey: process.env.CWAI_ANTHROPIC_API_KEY })
// const openai = createOpenAI({ apiKey: process.env.CWAI_OPENAI_API_KEY })
// const google = createGoogleGenerativeAI({ apiKey: process.env.CWAI_GOOGLE_API_KEY })
// const xai = createXai({ apiKey: process.env.CWAI_XAI_API_KEY })

// Replace PROVIDERS and getModelProvider with:
const PLATFORM_KEYS: Record<string, string | undefined> = {
  anthropic: process.env.CWAI_ANTHROPIC_API_KEY,
  openai: process.env.CWAI_OPENAI_API_KEY,
  google: process.env.CWAI_GOOGLE_API_KEY,
  xai: process.env.CWAI_XAI_API_KEY,
}

function createProvider(providerName: string, apiKey: string): (modelId: string) => LanguageModel {
  switch (providerName) {
    case 'anthropic': return (modelId) => createAnthropic({ apiKey })(modelId)
    case 'openai': return (modelId) => createOpenAI({ apiKey })(modelId)
    case 'google': return (modelId) => createGoogleGenerativeAI({ apiKey })(modelId)
    case 'xai': return (modelId) => createXai({ apiKey }).responses(modelId)
    default: throw new Error(`Unknown provider: ${providerName}`)
  }
}

export function getModelProvider(modelKey: string, apiKey?: string): LanguageModel {
  const config = MODEL_CONFIGS[modelKey]
  if (!config) throw new Error(`Unknown model: ${modelKey}`)
  const key = apiKey || PLATFORM_KEYS[config.provider]
  if (!key) throw new Error(`No API key for provider: ${config.provider}`)
  return createProvider(config.provider, key)(config.modelId)
}
```

Also update `getSearchConfig` to accept an optional `apiKey` parameter:

```typescript
export function getSearchConfig(modelKey: string, apiKey?: string): SearchConfig {
  const config = MODEL_CONFIGS[modelKey]
  if (!config) return {}
  const key = apiKey || PLATFORM_KEYS[config.provider]
  if (!key) return {}

  switch (modelKey) {
    case 'claude':
      return {
        tools: {
          web_search: tool<{ query: string }, BraveSearchResult[]>({
            description: 'Search the web for current information on a topic',
            inputSchema: z.object({
              query: z.string().describe('The search query'),
            }),
            execute: async ({ query }) => {
              return await braveSearch(query)
            },
          }),
        },
        maxSteps: 2,
      }
    case 'gpt': {
      const oa = createOpenAI({ apiKey: key })
      return {
        tools: { web_search: oa.tools.webSearch({ searchContextSize: 'medium' }) },
      }
    }
    case 'gemini': {
      const g = createGoogleGenerativeAI({ apiKey: key })
      return {
        tools: { google_search: g.tools.googleSearch({}) },
      }
    }
    case 'grok': {
      const x = createXai({ apiKey: key })
      return {
        tools: { web_search: x.tools.webSearch() },
      }
    }
    default:
      return {}
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/models.test.ts`
Expected: PASS

**Step 5: Update callers**

In `src/app/api/conversation/respond/route.ts`, the signature change is backward-compatible (apiKey is optional), so existing callers continue to work. We'll wire up BYOK key resolution in a later task.

**Step 6: Commit**

```bash
git add src/lib/models.ts src/lib/models.test.ts
git commit -m "refactor(models): accept optional BYOK API key in getModelProvider"
```

---

## Task 11: BYOK Key Management API Routes

**Files:**
- Create: `src/app/api/keys/route.ts`

**Step 1: Create the API route**

Create `src/app/api/keys/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-config'
import { db } from '@/db'
import { userApiKeys } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt, decrypt } from '@/lib/encryption'
import { randomUUID } from 'crypto'

// GET: list user's configured providers (no key values returned)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const keys = await db.select({
    id: userApiKeys.id,
    provider: userApiKeys.provider,
    createdAt: userApiKeys.createdAt,
  }).from(userApiKeys).where(eq(userApiKeys.userId, session.user.id))

  return NextResponse.json(keys)
}

// POST: add or update a key for a provider
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { provider, apiKey } = await request.json()

  if (!provider || !apiKey || typeof apiKey !== 'string') {
    return NextResponse.json({ error: 'provider and apiKey are required' }, { status: 400 })
  }

  const validProviders = ['anthropic', 'openai', 'google', 'xai']
  if (!validProviders.includes(provider)) {
    return NextResponse.json({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` }, { status: 400 })
  }

  const encrypted = encrypt(apiKey)

  // Upsert: delete existing then insert
  await db.delete(userApiKeys).where(
    and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, provider))
  )
  await db.insert(userApiKeys).values({
    id: randomUUID(),
    userId: session.user.id,
    provider,
    encryptedKey: encrypted,
  })

  return NextResponse.json({ ok: true })
}

// DELETE: remove a key by provider
export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { provider } = await request.json()
  if (!provider) {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 })
  }

  await db.delete(userApiKeys).where(
    and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, provider))
  )

  return NextResponse.json({ ok: true })
}
```

**Step 2: Commit**

```bash
git add src/app/api/keys/route.ts
git commit -m "feat(api): add BYOK key management endpoints (CRUD)"
```

---

## Task 12: Stripe Checkout & Webhook Routes

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`
- Create: `src/app/api/stripe/webhook/route.ts`
- Create: `src/app/api/stripe/portal/route.ts`

**Step 1: Create checkout route**

Create `src/app/api/stripe/checkout/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/lib/auth-config'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

const stripe = new Stripe(process.env.CWAI_STRIPE_SECRET_KEY!)

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id))
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Create or reuse Stripe customer
  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    })
    customerId = customer.id
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id))
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: process.env.CWAI_STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.CWAI_NEXTAUTH_URL}/?checkout=success`,
    cancel_url: `${process.env.CWAI_NEXTAUTH_URL}/setup?checkout=canceled`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
```

**Step 2: Create webhook route**

Create `src/app/api/stripe/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

const stripe = new Stripe(process.env.CWAI_STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.CWAI_STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.customer && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        await db.update(users).set({
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: 'active',
          subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        }).where(eq(users.stripeCustomerId, session.customer as string))
      }
      break
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.customer && invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
        await db.update(users).set({
          subscriptionStatus: 'active',
          subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        }).where(eq(users.stripeCustomerId, invoice.customer as string))
      }
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      await db.update(users).set({
        subscriptionStatus: subscription.status === 'active' ? 'active' : subscription.status,
        subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      }).where(eq(users.stripeSubscriptionId, subscription.id))
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await db.update(users).set({
        subscriptionStatus: 'none',
        stripeSubscriptionId: null,
        subscriptionCurrentPeriodEnd: null,
      }).where(eq(users.stripeSubscriptionId, subscription.id))
      break
    }
  }

  return NextResponse.json({ received: true })
}
```

**Step 3: Create portal route**

Create `src/app/api/stripe/portal/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/lib/auth-config'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

const stripe = new Stripe(process.env.CWAI_STRIPE_SECRET_KEY!)

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id))
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 400 })
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.CWAI_NEXTAUTH_URL}/settings`,
  })

  return NextResponse.json({ url: portalSession.url })
}
```

**Step 4: Commit**

```bash
git add src/app/api/stripe/
git commit -m "feat(stripe): add checkout, webhook, and portal API routes"
```

---

## Task 13: Setup Page (Access Gate)

**Files:**
- Create: `src/app/setup/page.tsx`

**Step 1: Create the setup page**

Create `src/app/setup/page.tsx`:

```tsx
'use client'

import { useState } from 'react'

export default function SetupPage() {
  const [loading, setLoading] = useState(false)

  async function handleSubscribe() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-ink mb-2">
        Get Started
      </h1>
      <p className="text-ink-muted mb-10 text-center max-w-md">
        To use Conversation With AI, subscribe for full access or bring your own API keys.
      </p>

      <div className="w-full max-w-sm space-y-4">
        {/* Subscribe CTA */}
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full py-4 bg-amber text-white rounded-xl font-semibold text-base hover:bg-amber-light transition-all shadow-[0_2px_10px_rgba(194,116,47,0.25)] hover:shadow-[0_4px_16px_rgba(194,116,47,0.3)] disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Redirecting...' : 'Subscribe for $20/month'}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-ink-faint uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* BYOK CTA */}
        <a
          href="/settings"
          className="block w-full py-4 text-center bg-card border border-border rounded-xl font-semibold text-base text-ink hover:border-amber/30 transition-all"
        >
          Use your own API keys
        </a>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/setup/page.tsx
git commit -m "feat: add setup page with subscribe and BYOK CTAs"
```

---

## Task 14: Settings Page

**Files:**
- Create: `src/app/settings/page.tsx`

**Step 1: Create the settings page**

Create `src/app/settings/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'

interface UserKey {
  id: string
  provider: string
  createdAt: string
}

interface UserInfo {
  email: string
  subscriptionStatus: string
  subscriptionCurrentPeriodEnd: string | null
}

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'google', name: 'Google', placeholder: 'AIza...' },
  { id: 'xai', name: 'xAI', placeholder: 'xai-...' },
]

export default function SettingsPage() {
  const [keys, setKeys] = useState<UserKey[]>([])
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [newKeyProvider, setNewKeyProvider] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    fetch('/api/keys').then(r => r.json()).then(setKeys).catch(() => {})
    fetch('/api/user').then(r => r.json()).then(setUserInfo).catch(() => {})
  }, [])

  async function handleSaveKey() {
    if (!newKeyProvider || !newKeyValue) return
    setSaving(true)
    try {
      await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newKeyProvider, apiKey: newKeyValue }),
      })
      setNewKeyProvider('')
      setNewKeyValue('')
      const updated = await fetch('/api/keys').then(r => r.json())
      setKeys(updated)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteKey(provider: string) {
    if (!confirm(`Remove ${provider} API key?`)) return
    await fetch('/api/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    setKeys(keys.filter(k => k.provider !== provider))
  }

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleSubscribe() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setPortalLoading(false)
    }
  }

  const configuredProviders = new Set(keys.map(k => k.provider))
  const availableProviders = PROVIDERS.filter(p => !configuredProviders.has(p.id))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-ink">Settings</h1>
        <a href="/" className="text-sm text-ink-muted hover:text-ink transition-colors">Back to home</a>
      </div>

      {/* Account */}
      <section className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-4">Account</h2>
        {userInfo && (
          <p className="text-ink">{userInfo.email}</p>
        )}
      </section>

      {/* Subscription */}
      <section className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-4">Subscription</h2>
        {userInfo?.subscriptionStatus === 'active' ? (
          <div>
            <p className="text-ink mb-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2" />
              Active — $20/month
            </p>
            {userInfo.subscriptionCurrentPeriodEnd && (
              <p className="text-sm text-ink-muted mb-4">
                Renews {new Date(userInfo.subscriptionCurrentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="px-4 py-2 text-sm bg-cream border border-border rounded-lg hover:border-amber/30 transition-all cursor-pointer"
            >
              {portalLoading ? 'Opening...' : 'Manage subscription'}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-ink-muted mb-4">No active subscription</p>
            <button
              onClick={handleSubscribe}
              disabled={portalLoading}
              className="px-4 py-2 text-sm bg-amber text-white rounded-lg hover:bg-amber-light transition-all cursor-pointer"
            >
              {portalLoading ? 'Redirecting...' : 'Subscribe for $20/month'}
            </button>
          </div>
        )}
      </section>

      {/* API Keys */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-4">API Keys</h2>
        <p className="text-sm text-ink-muted mb-4">
          Add your own API keys to use models without a subscription. Keys are encrypted at rest.
        </p>

        {/* Existing keys */}
        {keys.length > 0 && (
          <div className="space-y-2 mb-6">
            {keys.map(key => {
              const providerInfo = PROVIDERS.find(p => p.id === key.provider)
              return (
                <div key={key.id} className="flex items-center justify-between py-3 px-4 bg-cream rounded-lg">
                  <div>
                    <span className="font-medium text-ink">{providerInfo?.name || key.provider}</span>
                    <span className="text-sm text-ink-faint ml-2">configured</span>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(key.provider)}
                    className="text-sm text-red-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Add new key */}
        {availableProviders.length > 0 && (
          <div className="flex gap-2 items-end">
            <div className="flex-shrink-0">
              <select
                value={newKeyProvider}
                onChange={e => setNewKeyProvider(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-border bg-cream text-ink text-sm focus:outline-none focus:border-amber"
              >
                <option value="">Provider...</option>
                {availableProviders.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <input
                type="password"
                value={newKeyValue}
                onChange={e => setNewKeyValue(e.target.value)}
                placeholder={PROVIDERS.find(p => p.id === newKeyProvider)?.placeholder || 'API key'}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-cream text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:border-amber"
              />
            </div>
            <button
              onClick={handleSaveKey}
              disabled={saving || !newKeyProvider || !newKeyValue}
              className="px-4 py-2.5 text-sm bg-amber text-white rounded-lg hover:bg-amber-light disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add settings page with subscription management and BYOK key config"
```

---

## Task 15: User Info API Route

**Files:**
- Create: `src/app/api/user/route.ts`

**Step 1: Create the route**

Create `src/app/api/user/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-config'
import { db } from '@/db'
import { users, userApiKeys } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id))
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const keys = await db.select({ provider: userApiKeys.provider })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, session.user.id))

  return NextResponse.json({
    email: user.email,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
    providers: keys.map(k => k.provider),
  })
}
```

**Step 2: Commit**

```bash
git add src/app/api/user/route.ts
git commit -m "feat(api): add user info endpoint"
```

---

## Task 16: Wire BYOK Keys Into Conversation Respond Route

**Files:**
- Modify: `src/app/api/conversation/respond/route.ts`

**Step 1: Update the respond route to resolve BYOK keys**

In `src/app/api/conversation/respond/route.ts`, add key resolution at the top of the POST handler:

```typescript
import { auth } from '@/lib/auth-config'
import { users, userApiKeys } from '@/db/schema'
import { decrypt } from '@/lib/encryption'
```

Then after the existing validation code (after the `if (!conv)` check), add:

```typescript
  // Resolve API key: BYOK first, then platform key for subscribers
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let apiKey: string | undefined
  const [userKey] = await db.select().from(userApiKeys).where(
    and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, config.provider))
  )
  if (userKey) {
    apiKey = decrypt(userKey.encryptedKey)
  } else {
    // Check if user has active subscription (use platform key)
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id))
    if (user?.subscriptionStatus !== 'active') {
      return NextResponse.json({ error: `No API key for ${config.provider}. Subscribe or add your own key.` }, { status: 403 })
    }
    // apiKey remains undefined → getModelProvider will use platform key
  }
```

Then update the `getModelProvider` and `getSearchConfig` calls to pass `apiKey`:

```typescript
  const result = await generateText({
    model: getModelProvider(modelKey, apiKey),
    // ... rest unchanged
    ...(searchConfig.tools && { tools: searchConfig.tools, maxSteps: 2 }),
  })
```

And:
```typescript
  const searchConfig = round === 1 ? getSearchConfig(modelKey, apiKey) : {}
```

**Step 2: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/app/api/conversation/respond/route.ts
git commit -m "feat: wire BYOK key resolution into conversation respond route"
```

---

## Task 17: Update Home Page Model Selector for User Access

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update home page to fetch available models**

The home page currently imports `MODEL_CONFIGS` directly and shows all models. Update it to fetch the user's available models from the `/api/user` endpoint and only show those.

At the top of the `Home` component, add state and effect:

```tsx
const [availableModels, setAvailableModels] = useState<string[]>([])

useEffect(() => {
  fetch('/api/user')
    .then(r => r.json())
    .then(data => {
      if (data.subscriptionStatus === 'active') {
        setAvailableModels(Object.keys(MODEL_CONFIGS))
        setSelectedModels(Object.keys(MODEL_CONFIGS))
      } else if (data.providers?.length > 0) {
        // Map providers to model keys
        const providerToModels: Record<string, string[]> = {}
        for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
          if (!providerToModels[config.provider]) providerToModels[config.provider] = []
          providerToModels[config.provider].push(key)
        }
        const available = data.providers.flatMap((p: string) => providerToModels[p] || [])
        setAvailableModels(available)
        setSelectedModels(available)
      } else {
        // No access — redirect to setup
        window.location.href = '/setup'
      }
    })
    .catch(() => {})
}, [])
```

Then in the model selector JSX, filter to only show available models:

```tsx
{Object.entries(MODEL_CONFIGS)
  .filter(([key]) => availableModels.includes(key))
  .map(([key, config]) => {
    // ... existing button JSX
  })}
```

**Step 2: Add settings link to header**

In the masthead section, add a settings link:

```tsx
<header className="mb-10 animate-fade-up">
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      <div className="w-10 h-[3px] bg-amber rounded-full" />
      <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-amber">Roundtable</span>
    </div>
    <a href="/settings" className="text-sm text-ink-muted hover:text-ink transition-colors">Settings</a>
  </div>
  {/* ... rest of header */}
</header>
```

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: filter model selector by user access, add settings link"
```

---

## Task 18: Add user_id to Conversation Save

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/app/api/conversation/route.ts`

**Step 1: Add userId to conversations schema**

In `src/db/schema.ts`, add to the `conversations` table:

```typescript
userId: text('user_id').references(() => users.id),
```

**Step 2: Update conversation save route**

In `src/app/api/conversation/route.ts`, add session check and save `userId`:

```typescript
import { auth } from '@/lib/auth-config'
```

Then in the POST handler, get the session and include `userId` in the insert:

```typescript
const session = await auth()
// ... existing code
await db.insert(conversations).values({
  // ... existing fields
  userId: session?.user?.id ?? null,
})
```

**Step 3: Update conversations list to filter by user**

In `src/app/api/conversations/route.ts`, filter by user:

```typescript
import { auth } from '@/lib/auth-config'

// In GET handler:
const session = await auth()
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const results = await db.select().from(conversations)
  .where(eq(conversations.userId, session.user.id))
  .orderBy(desc(conversations.createdAt))
  .limit(20)
```

**Step 4: Commit**

```bash
git add src/db/schema.ts src/app/api/conversation/route.ts src/app/api/conversations/route.ts
git commit -m "feat: associate conversations with users"
```

---

## Task 19: Update TTS Route for BYOK Keys

**Files:**
- Modify: `src/app/api/tts/route.ts`

The TTS route uses OpenAI directly. Update it to use the user's BYOK key if available.

**Step 1: Update TTS route**

Add at the top:
```typescript
import { auth } from '@/lib/auth-config'
import { db } from '@/db'
import { users, userApiKeys } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '@/lib/encryption'
```

Before creating the OpenAI client, resolve the key:

```typescript
const session = await auth()
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

let openaiKey = process.env.CWAI_OPENAI_API_KEY
const [userKey] = await db.select().from(userApiKeys).where(
  and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, 'openai'))
)
if (userKey) {
  openaiKey = decrypt(userKey.encryptedKey)
} else {
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id))
  if (user?.subscriptionStatus !== 'active') {
    return NextResponse.json({ error: 'No OpenAI key available for TTS' }, { status: 403 })
  }
}

// Use openaiKey when creating the OpenAI client
```

**Step 2: Commit**

```bash
git add src/app/api/tts/route.ts
git commit -m "feat(tts): resolve BYOK OpenAI key for TTS"
```

---

## Task 20: Run Full Test Suite & Final Verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Verify app starts**

Run: `npm run dev`
Check: App starts, `/login` shows magic link form, unauthenticated requests redirect to `/login`.

**Step 3: Verify build**

Run: `npm run build`
Expected: No build errors

**Step 4: Commit any fixes**

If any tests or build errors needed fixing, commit them.

---

## Task 21: Update Documentation

**Files:**
- Modify: `docs/architecture.md`
- Modify: `README.md`

**Step 1: Update architecture.md**

Add to component table:
- `src/lib/auth-config.ts` — NextAuth v5 config with Resend magic link, custom Drizzle adapter
- `src/lib/encryption.ts` — AES-256-GCM encrypt/decrypt for BYOK keys
- `src/lib/access.ts` — Access check utility (subscription or BYOK)
- `src/lib/user-access.ts` — Available model resolution per user
- `src/app/api/stripe/*` — Stripe checkout, webhook, portal routes
- `src/app/api/keys/route.ts` — BYOK key CRUD
- `src/app/api/user/route.ts` — User info endpoint
- `src/app/setup/page.tsx` — Access gate (subscribe or BYOK)
- `src/app/settings/page.tsx` — Account, subscription, key management

Add ADR-004: Monetization architecture (magic link auth, Stripe subscription, BYOK keys)

Add changelog entry.

**Step 2: Update README.md**

Add to features:
- Magic link authentication (passwordless)
- $20/mo subscription via Stripe
- Bring Your Own Keys (BYOK) — use your own API keys for free
- Encrypted API key storage (AES-256-GCM)
- Settings page with subscription and key management

Update env vars table with new variables.

**Step 3: Commit**

```bash
git add docs/architecture.md README.md
git commit -m "docs: update architecture and README for monetization features"
```

---

## Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | Install dependencies | trivial |
| 2 | Auth DB schema | small |
| 3 | DB migration | small |
| 4 | Encryption utilities | small |
| 5 | NextAuth config | medium |
| 6 | Middleware + access check | small |
| 7 | Login page (magic link) | small |
| 8 | Remove old auth | small |
| 9 | User access helper | small |
| 10 | Model provider BYOK support | medium |
| 11 | BYOK key management API | small |
| 12 | Stripe routes (checkout, webhook, portal) | medium |
| 13 | Setup page | small |
| 14 | Settings page | medium |
| 15 | User info API | trivial |
| 16 | Wire BYOK into respond route | small |
| 17 | Home page model filtering | small |
| 18 | Associate conversations with users | small |
| 19 | TTS BYOK key resolution | small |
| 20 | Full test suite + verification | small |
| 21 | Update documentation | small |
