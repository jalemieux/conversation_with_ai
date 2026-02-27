import OpenAI from 'openai'
import { MODEL_VOICES, stripMarkdown } from '@/lib/tts'

const openai = new OpenAI({ apiKey: process.env.CWAI_OPENAI_API_KEY })

export async function POST(request: Request) {
  const body = await request.json()
  const { text, model } = body

  if (!text || !model) {
    return new Response(JSON.stringify({ error: 'text and model are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
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
