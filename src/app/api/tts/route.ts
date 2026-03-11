import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { MODEL_VOICES, stripMarkdown, rewriteForAudio } from '@/lib/tts'
import { auth } from '@/lib/auth-config'
import { db } from '@/db'
import { users, userApiKeys } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '@/lib/encryption'

function getCachePath(conversationId: string, round: number, model: string): string {
  const safeId = conversationId.replace(/[^a-zA-Z0-9_-]/g, '')
  const safeModel = model.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(process.cwd(), 'data', 'audio', safeId, `${round}-${safeModel}.mp3`)
}

function getScriptCachePath(conversationId: string, round: number, model: string): string {
  const safeId = conversationId.replace(/[^a-zA-Z0-9_-]/g, '')
  const safeModel = model.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(process.cwd(), 'data', 'audio', safeId, `${round}-${safeModel}.script.txt`)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let openaiKey = process.env.CWAI_OPENAI_API_KEY
  const [userKey] = await db.select().from(userApiKeys).where(
    and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, 'openai'))
  )
  if (userKey) {
    openaiKey = decrypt(userKey.encryptedKey)
  } else {
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id))
    if (user?.subscriptionStatus !== 'active') {
      return NextResponse.json({ error: 'No OpenAI key available for TTS' }, { status: 403 })
    }
  }

  const openai = new OpenAI({ apiKey: openaiKey })

  const body = await request.json()
  const { text, model, conversationId, round } = body

  if (!text || !model) {
    return new Response(JSON.stringify({ error: 'text and model are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const cachingEnabled = conversationId && round !== undefined && round !== null

  // 1. Check audio cache
  if (cachingEnabled) {
    const cachePath = getCachePath(conversationId, round, model)
    try {
      const cached = await readFile(cachePath)
      return new Response(cached, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': cached.byteLength.toString(),
        },
      })
    } catch {
      // Cache miss — fall through
    }
  }

  // 2. Get text for TTS: rewrite if caching enabled, otherwise use original
  let ttsText: string
  if (cachingEnabled) {
    const scriptPath = getScriptCachePath(conversationId, round, model)
    try {
      const cachedScript = await readFile(scriptPath, 'utf-8')
      ttsText = cachedScript
    } catch {
      // Script cache miss — rewrite with fallback to original text
      let rewritten: string
      try {
        rewritten = await rewriteForAudio(text, model)
      } catch {
        console.warn('rewriteForAudio failed, falling back to original text')
        rewritten = text
      }
      ttsText = rewritten
      // Fire-and-forget: save script
      const dir = path.dirname(scriptPath)
      mkdir(dir, { recursive: true })
        .then(() => writeFile(scriptPath, rewritten, 'utf-8'))
        .catch(() => {})
    }
  } else {
    ttsText = text
  }

  const voice = MODEL_VOICES[model] ?? 'alloy'
  const cleanText = stripMarkdown(ttsText)

  try {
    const response = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: cleanText,
      instructions: 'Read naturally in a conversational tone.',
      response_format: 'mp3',
    })

    const buffer = await response.arrayBuffer()

    // Fire-and-forget: save to cache
    if (cachingEnabled) {
      const cachePath = getCachePath(conversationId, round, model)
      const dir = path.dirname(cachePath)
      mkdir(dir, { recursive: true })
        .then(() => writeFile(cachePath, Buffer.from(buffer)))
        .catch(() => {})
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.byteLength.toString(),
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'TTS generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
