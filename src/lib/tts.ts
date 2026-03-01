import { generateText } from 'ai'
import { getModelProvider } from '@/lib/models'

export const REWRITE_SYSTEM_PROMPT = `You are rewriting a written response so it sounds natural when read aloud by a text-to-speech system.

Rules:
- Preserve ALL substance, nuance, arguments, and tone from the original. Do not summarize or cut content.
- Maintain approximately the same length as the original.
- Remove structural artifacts: convert bullet points, numbered lists, and headers into flowing prose with natural spoken transitions.
- Replace visual references ("as shown above", "the following list", "see below") with spoken equivalents ("as I mentioned", "here are a few points", "let me walk through this").
- Spell out abbreviations on first use (e.g., "API" becomes "A.P.I." or "application programming interface" depending on context).
- Convert parenthetical asides into natural spoken digressions ("by the way", "it's worth noting").
- Keep the original author's personality and voice intact — if the original is witty, stay witty; if serious, stay serious.
- Output pure plain text. No markdown, no bullet points, no numbered lists, no headers, no formatting of any kind.
- Do not add any preamble like "Here is the rewritten version". Just output the rewritten text directly.`

export async function rewriteForAudio(text: string, modelKey: string): Promise<string> {
  const model = getModelProvider(modelKey)
  const { text: rewritten } = await generateText({
    model,
    system: REWRITE_SYSTEM_PROMPT,
    prompt: text,
  })
  return rewritten
}

export const MODEL_VOICES: Record<string, string> = {
  claude: 'coral',
  gpt: 'nova',
  gemini: 'sage',
  grok: 'ash',
}

export function stripMarkdown(text: string): string {
  return text
    // Remove code block fences (``` with optional language)
    .replace(/```[\w]*\n?/g, '')
    // Remove horizontal rules
    .replace(/^[-*]{3,}$/gm, '')
    // Remove image syntax ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove link syntax [text](url) → text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove heading markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic (order matters: ** before *)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove blockquote markers
    .replace(/^>\s+/gm, '')
    // Remove unordered list markers
    .replace(/^[-*]\s+/gm, '')
    // Remove ordered list markers
    .replace(/^\d+\.\s+/gm, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function chunkText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  // Split into sentences (keep delimiter attached)
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text]

  let current = ''
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLength && current.length > 0) {
      chunks.push(current.trimEnd())
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current.length > 0) {
    chunks.push(current.trimEnd())
  }

  return chunks
}
