import { streamText } from 'ai'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations, responses } from '@/db/schema'
import { getModelProvider, MODEL_CONFIGS } from '@/lib/models'
import { buildRound1Prompt, buildRound2Prompt } from '@/lib/orchestrator'
import type { Round1Response } from '@/lib/orchestrator'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  const { rawInput, augmentedPrompt, topicType, framework, models } = await request.json()

  if (!augmentedPrompt || !models || !Array.isArray(models) || models.length === 0) {
    return NextResponse.json({ error: 'augmentedPrompt and models are required' }, { status: 400 })
  }

  const conversationId = randomUUID()

  // Save conversation
  await db.insert(conversations).values({
    id: conversationId,
    rawInput: rawInput ?? '',
    augmentedPrompt,
    topicType: topicType ?? 'open_question',
    framework: framework ?? 'multiple_angles',
    models: JSON.stringify(models),
  })

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Round 1: All models in parallel
        send('round_start', { round: 1 })

        const round1Results: Round1Response[] = await Promise.all(
          models.map(async (modelKey: string) => {
            const config = MODEL_CONFIGS[modelKey]
            const prompt = buildRound1Prompt(augmentedPrompt, config.name)

            const result = streamText({
              model: getModelProvider(modelKey),
              prompt,
            })

            let fullText = ''
            for await (const chunk of result.textStream) {
              fullText += chunk
              send('token', { round: 1, model: modelKey, modelName: config.name, chunk })
            }

            const respId = randomUUID()
            await db.insert(responses).values({
              id: respId,
              conversationId,
              round: 1,
              model: modelKey,
              content: fullText,
            })

            send('response', { round: 1, model: modelKey, modelName: config.name, content: fullText })
            return { model: config.name, content: fullText }
          })
        )

        send('round_complete', { round: 1 })

        // Round 2: All models react in parallel
        send('round_start', { round: 2 })

        await Promise.all(
          models.map(async (modelKey: string) => {
            const config = MODEL_CONFIGS[modelKey]
            const prompt = buildRound2Prompt(augmentedPrompt, config.name, round1Results)

            const result = streamText({
              model: getModelProvider(modelKey),
              prompt,
            })

            let fullText = ''
            for await (const chunk of result.textStream) {
              fullText += chunk
              send('token', { round: 2, model: modelKey, modelName: config.name, chunk })
            }

            const respId = randomUUID()
            await db.insert(responses).values({
              id: respId,
              conversationId,
              round: 2,
              model: modelKey,
              content: fullText,
            })

            send('response', { round: 2, model: modelKey, modelName: config.name, content: fullText })
          })
        )

        send('round_complete', { round: 2 })
        send('done', { conversationId })
      } catch (error) {
        send('error', { message: error instanceof Error ? error.message : 'Unknown error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
