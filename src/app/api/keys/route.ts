import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth-config'
import { db } from '@/db'
import { userApiKeys } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { encrypt } from '@/lib/encryption'
import { randomUUID } from 'crypto'

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
