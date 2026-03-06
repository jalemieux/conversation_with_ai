import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth-config'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await db
    .select({
      id: conversations.id,
      createdAt: conversations.createdAt,
      rawInput: conversations.rawInput,
      topicType: conversations.topicType,
    })
    .from(conversations)
    .where(eq(conversations.userId, session.user.id))
    .orderBy(desc(conversations.createdAt))
    .limit(20)

  return NextResponse.json(result)
}
