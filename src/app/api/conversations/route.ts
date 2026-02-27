import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations } from '@/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  const result = await db
    .select({
      id: conversations.id,
      createdAt: conversations.createdAt,
      rawInput: conversations.rawInput,
      topicType: conversations.topicType,
    })
    .from(conversations)
    .orderBy(desc(conversations.createdAt))
    .limit(20)

  return NextResponse.json(result)
}
