import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations } from '@/db/schema'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  const { rawInput, augmentedPrompt, topicType, framework, models } = await request.json()

  if (!augmentedPrompt || !models || !Array.isArray(models) || models.length === 0) {
    return NextResponse.json({ error: 'augmentedPrompt and models are required' }, { status: 400 })
  }

  const conversationId = randomUUID()

  await db.insert(conversations).values({
    id: conversationId,
    rawInput: rawInput ?? '',
    augmentedPrompt,
    topicType: topicType ?? 'open_question',
    framework: framework ?? 'multiple_angles',
    models: JSON.stringify(models),
  })

  return NextResponse.json({ conversationId })
}
