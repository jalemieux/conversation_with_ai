import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { buildAugmenterPrompt, parseMultiAugmenterResponse } from '@/lib/augmenter'
import { AugmentRequestSchema } from '@/lib/validation'
import { db } from '@/db'
import { conversations } from '@/db/schema'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth-config'

const anthropic = createAnthropic({
  apiKey: process.env.CWAI_ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = AugmentRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { rawInput } = parsed.data
  const prompt = buildAugmenterPrompt(rawInput)

  let text: string
  try {
    const result = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt,
      maxOutputTokens: 2000,
    })
    text = result.text
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[augment] LLM call failed:', msg)
    return NextResponse.json({ error: 'Failed to augment prompt' }, { status: 502 })
  }

  let result
  try {
    result = parseMultiAugmenterResponse(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[augment] Parse failed:', msg, 'Raw:', text.slice(0, 500))
    return NextResponse.json({ error: 'Failed to parse augmented prompt' }, { status: 502 })
  }

  // Create draft conversation in DB
  const conversationId = randomUUID()

  await db.insert(conversations).values({
    id: conversationId,
    rawInput,
    augmentedPrompt: result.augmentations[result.recommended].augmentedPrompt,
    topicType: result.recommended,
    framework: result.augmentations[result.recommended].framework,
    models: '[]',
    status: 'draft',
    augmentations: JSON.stringify(result.augmentations),
    userId: session.user.id,
  })

  return NextResponse.json({
    conversationId,
    rawInput,
    recommended: result.recommended,
    augmentations: result.augmentations,
  })
}
