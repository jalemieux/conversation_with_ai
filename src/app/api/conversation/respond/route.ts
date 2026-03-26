import { generateText, stepCountIs } from 'ai'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { conversations, responses, userApiKeys, users } from '@/db/schema'
import { getModelProvider, getSearchConfig, MODEL_CONFIGS, calculateCost } from '@/lib/models'
import { extractSources } from '@/lib/sources'
import { buildUserPrompt, buildSystemPrompt } from '@/lib/orchestrator'
import type { ResponseLength, Round1Response } from '@/lib/orchestrator'
import { RespondRequestSchema } from '@/lib/validation'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth-config'
import { decrypt } from '@/lib/encryption'

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = RespondRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { conversationId, model: modelKey, round } = parsed.data

  console.log(`[respond] START model=${modelKey} round=${round} conversationId=${conversationId}`)

  const config = MODEL_CONFIGS[modelKey]
  if (!config) {
    return NextResponse.json({ error: `Unknown model: ${modelKey}` }, { status: 400 })
  }

  // Fetch conversation
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId))
  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Resolve config: prefer request params, fall back to stored conversation config
  const essayMode = parsed.data.essayMode ?? conv.essayMode ?? false
  const responseLength: ResponseLength | undefined = parsed.data.responseLength ?? (conv.responseLength as ResponseLength) ?? undefined

  // Resolve API key: BYOK first, then platform key for subscribers
  const session = await auth()
  if (!session?.user?.id) {
    console.log(`[respond] AUTH FAILED model=${modelKey}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let apiKey: string | undefined
  let keySource: string = 'none'
  const [userKey] = await db.select().from(userApiKeys).where(
    and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, config.provider))
  )
  if (userKey) {
    apiKey = decrypt(userKey.encryptedKey)
    keySource = 'byok'
  } else {
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id))
    console.log(`[respond] No BYOK for ${config.provider}, subscriptionStatus=${user?.subscriptionStatus}`)
    if (user?.subscriptionStatus !== 'active') {
      return NextResponse.json({ error: `No API key for ${config.provider}. Subscribe or add your own key.` }, { status: 403 })
    }
    keySource = 'platform'
  }

  console.log(`[respond] Key resolved: model=${modelKey} provider=${config.provider} source=${keySource}`)

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
  const searchConfig = round === 1 ? getSearchConfig(modelKey, apiKey) : {}
  const MAX_RETRIES = 2
  const callModel = async () => {
    return generateText({
      model: getModelProvider(modelKey, apiKey),
      system: buildSystemPrompt(round as 1 | 2, essayMode === true, config.systemPrompt, responseLength),
      prompt,
      ...(config.providerOptions && { providerOptions: config.providerOptions }),
      ...(searchConfig.providerOptions && {
        providerOptions: { ...config.providerOptions, ...searchConfig.providerOptions },
      }),
      ...(searchConfig.tools && { tools: searchConfig.tools, stopWhen: stepCountIs(5) }),
    })
  }

  try {
    let result
    let lastError: unknown
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        result = await callModel()
        break
      } catch (err) {
        lastError = err
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[respond] ATTEMPT ${attempt + 1}/${MAX_RETRIES + 1} FAILED model=${modelKey}: ${msg}`)
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        }
      }
    }
    if (!result) throw lastError

    // Log step details for debugging
    const steps = result.steps ?? []
    console.log(`[respond] model=${modelKey} steps=${steps.length} textLength=${result.text.length}`)
    for (const [i, step] of steps.entries()) {
      const toolCalls = step.toolCalls?.map((tc: { toolName: string }) => tc.toolName) ?? []
      console.log(`[respond]   step ${i + 1}: text=${step.text?.length ?? 0} toolCalls=[${toolCalls.join(',')}]`)
    }

    // Extract sources (from search tools)
    const sources = await extractSources(result)

    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    const cost = calculateCost(modelKey, inputTokens, outputTokens)

    const content = result.text
    if (!content) {
      console.warn(`[respond] EMPTY TEXT model=${modelKey} round=${round} outputTokens=${outputTokens}`)
    }

    // Save response to DB
    const respId = randomUUID()
    await db.insert(responses).values({
      id: respId,
      conversationId,
      round,
      model: modelKey,
      content,
      sources: sources.length > 0 ? JSON.stringify(sources) : null,
      inputTokens,
      outputTokens,
      cost: cost.toFixed(6),
    })

    console.log(`[respond] SUCCESS model=${modelKey} round=${round} tokens=${inputTokens}/${outputTokens} cost=$${cost.toFixed(4)}`)

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[respond] ERROR model=${modelKey} provider=${config.provider} round=${round} keySource=${keySource}:`, message)
    if (error instanceof Error && error.stack) {
      console.error(`[respond] STACK:`, error.stack)
    }
    return NextResponse.json({ error: `Model ${config.name} failed: ${message}` }, { status: 502 })
  }
}
