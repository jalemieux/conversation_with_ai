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
    providers: [...new Set(keys.map(k => k.provider))],
  })
}
