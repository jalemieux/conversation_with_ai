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
        sessionState: (data.session_state as string) ?? null,
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
