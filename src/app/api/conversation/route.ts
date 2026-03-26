import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations } from '@/db/schema'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth-config'
import { UpdateConversationSchema } from '@/lib/validation'
import { eq, and } from 'drizzle-orm'

// Legacy POST — creates a conversation directly (kept for backwards compat)
export async function POST(request: Request) {
  const { rawInput, augmentedPrompt, topicType, framework, models } = await request.json()

  if (!augmentedPrompt || !models || !Array.isArray(models) || models.length === 0) {
    return NextResponse.json({ error: 'augmentedPrompt and models are required' }, { status: 400 })
  }

  const session = await auth()
  const conversationId = randomUUID()

  await db.insert(conversations).values({
    id: conversationId,
    rawInput: rawInput ?? '',
    augmentedPrompt,
    topicType: topicType ?? 'open_question',
    framework: framework ?? 'multiple_angles',
    models: JSON.stringify(models),
    status: 'running',
    userId: session?.user?.id ?? null,
  })

  return NextResponse.json({ conversationId })
}

// PATCH — update a draft conversation with final config and mark as running
export async function PATCH(request: Request) {
  const body = await request.json()
  const { conversationId, ...rest } = body

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
  }

  const parsed = UpdateConversationSchema.safeParse(rest)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [conv] = await db.select().from(conversations).where(
    and(eq(conversations.id, conversationId), eq(conversations.userId, session.user.id))
  )
  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }
  if (conv.status !== 'draft') {
    return NextResponse.json({ error: 'Conversation is not in draft state' }, { status: 409 })
  }

  const { selectedType, augmentedPrompt, models, essayMode, responseLength } = parsed.data

  // Read framework from stored augmentations
  let framework = ''
  try {
    const augs = JSON.parse(conv.augmentations ?? '{}')
    framework = augs[selectedType]?.framework ?? ''
  } catch { /* use empty */ }

  // Deduplicate base model keys for backend storage
  const baseModels = [...new Set(models.map((m: string) => {
    const idx = m.indexOf(':')
    return idx === -1 ? m : m.slice(0, idx)
  }))]

  await db.update(conversations)
    .set({
      topicType: selectedType,
      augmentedPrompt,
      framework,
      models: JSON.stringify(baseModels),
      essayMode,
      responseLength,
      status: 'running',
    })
    .where(eq(conversations.id, conversationId))

  return NextResponse.json({ ok: true })
}
