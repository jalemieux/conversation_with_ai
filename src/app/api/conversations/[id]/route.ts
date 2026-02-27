import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations, responses } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const conv = await db.select().from(conversations).where(eq(conversations.id, id))
  if (conv.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const resps = await db.select().from(responses).where(eq(responses.conversationId, id))

  return NextResponse.json({
    ...conv[0],
    models: JSON.parse(conv[0].models),
    responses: resps,
  })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const conv = await db.select().from(conversations).where(eq(conversations.id, id))
  if (conv.length === 0) {
    return new Response(null, { status: 404 })
  }

  await db.delete(responses).where(eq(responses.conversationId, id))
  await db.delete(conversations).where(eq(conversations.id, id))

  return new Response(null, { status: 204 })
}
