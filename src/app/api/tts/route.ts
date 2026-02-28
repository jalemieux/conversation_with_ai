import OpenAI from 'openai'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { MODEL_VOICES, stripMarkdown } from '@/lib/tts'

const openai = new OpenAI({ apiKey: process.env.CWAI_OPENAI_API_KEY })

function getCachePath(conversationId: string, round: number, model: string): string {
  const safeId = conversationId.replace(/[^a-zA-Z0-9_-]/g, '')
  const safeModel = model.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(process.cwd(), 'data', 'audio', safeId, `${round}-${safeModel}.mp3`)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { text, model, conversationId, round } = body

  if (!text || !model) {
    return new Response(JSON.stringify({ error: 'text and model are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const cachingEnabled = conversationId && round !== undefined && round !== null

  // Check cache on hit
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
      // Cache miss — fall through to generate
    }
  }

  const voice = MODEL_VOICES[model] ?? 'alloy'
  const cleanText = stripMarkdown(text)

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
