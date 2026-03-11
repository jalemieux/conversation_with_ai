import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations, responses } from '@/db/schema'
import { getModelProvider, getSearchConfig, MODEL_CONFIGS, calculateCost } from '@/lib/models'
import { extractSources } from '@/lib/sources'
import { buildUserPrompt, buildSystemPrompt } from '@/lib/orchestrator'
import type { Round1Response } from '@/lib/orchestrator'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  const { conversationId, model: modelKey, round, essayMode } = await request.json()

  if (!conversationId || !modelKey || !round) {
    return NextResponse.json({ error: 'conversationId, model, and round are required' }, { status: 400 })
  }

  const config = MODEL_CONFIGS[modelKey]
  if (!config) {
    return NextResponse.json({ error: `Unknown model: ${modelKey}` }, { status: 400 })
  }

  // Fetch conversation
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId))
  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Validate round
  if (round !== 1 && round !== 2) {
    return NextResponse.json({ error: 'round must be 1 or 2' }, { status: 400 })
  }

  // Fetch R1 responses if round 2
  let round1Responses: Round1Response[] | undefined
  if (round === 2) {
    const round1Rows = await db.select().from(responses).where(
      and(eq(responses.conversationId, conversationId), eq(responses.round, 1))
    )
    round1Responses = round1Rows.map((r) => ({
      model: MODEL_CONFIGS[r.model]?.name ?? r.model,
      content: r.content,
    }))
  }

  const prompt = buildUserPrompt(conv.augmentedPrompt, config.name, round1Responses)

  // Build model options — search only in Round 1
  const searchConfig = round === 1 ? getSearchConfig(modelKey) : {}

  const result = await generateText({
    model: getModelProvider(modelKey),
    system: buildSystemPrompt(round as 1 | 2, essayMode !== false, config.systemPrompt),
    prompt,
    ...(config.providerOptions && { providerOptions: config.providerOptions }),
    ...(searchConfig.providerOptions && {
      providerOptions: { ...config.providerOptions, ...searchConfig.providerOptions },
    }),
    ...(searchConfig.tools && { tools: searchConfig.tools, maxSteps: 2 }),
  })

  // Extract sources (from search tools)
  const sources = await extractSources(result)

  const inputTokens = result.usage?.inputTokens ?? 0
  const outputTokens = result.usage?.outputTokens ?? 0
  const cost = calculateCost(modelKey, inputTokens, outputTokens)

  // Save response to DB
  const respId = randomUUID()
  await db.insert(responses).values({
    id: respId,
    conversationId,
    round,
    model: modelKey,
    content: result.text,
    sources: sources.length > 0 ? JSON.stringify(sources) : null,
    inputTokens,
    outputTokens,
    cost: cost.toFixed(6),
  })

  return NextResponse.json({
    content: result.text,
    model: modelKey,
    modelName: config.name,
    provider: config.provider,
    modelId: config.modelId,
    round,
    sources,
    usage: { inputTokens, outputTokens, cost },
  })
}
