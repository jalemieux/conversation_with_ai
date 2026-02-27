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
