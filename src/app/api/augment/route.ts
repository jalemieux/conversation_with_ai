import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { buildAugmenterPrompt, parseAugmenterResponse } from '@/lib/augmenter'

export async function POST(request: Request) {
  const { rawInput } = await request.json()

  if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
    return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })
  }

  const prompt = buildAugmenterPrompt(rawInput.trim())

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    prompt,
    maxOutputTokens: 500,
  })

  const result = parseAugmenterResponse(text)

  return NextResponse.json({
    rawInput: rawInput.trim(),
    topicType: result.topicType,
    framework: result.framework,
    augmentedPrompt: result.augmentedPrompt,
  })
}
