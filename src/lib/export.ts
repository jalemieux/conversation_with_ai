import type { Conversation } from './types'
import { MODEL_CONFIGS } from './models'

function getModelName(modelKey: string): string {
  return MODEL_CONFIGS[modelKey]?.name ?? modelKey
}

export function exportMarkdown(conversation: Conversation): string {
  const lines: string[] = []

  lines.push(`# ${conversation.rawInput}`)
  lines.push('')
  lines.push(`> ${conversation.augmentedPrompt}`)
  lines.push('')

  for (const round of [1, 2]) {
    lines.push(`## Round ${round}`)
    lines.push('')

    const roundResponses = conversation.responses.filter((r) => r.round === round)
    for (const resp of roundResponses) {
      lines.push(`### ${getModelName(resp.model)}`)
      lines.push('')
      lines.push(resp.content)
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function exportText(conversation: Conversation): string {
  const lines: string[] = []

  lines.push(conversation.rawInput)
  lines.push('')
  lines.push(conversation.augmentedPrompt)
  lines.push('')

  for (const round of [1, 2]) {
    lines.push(`--- Round ${round} ---`)
    lines.push('')

    const roundResponses = conversation.responses.filter((r) => r.round === round)
    for (const resp of roundResponses) {
      lines.push(`[${getModelName(resp.model)}]`)
      lines.push(resp.content)
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function exportXThread(conversation: Conversation): string[] {
  const tweets: string[] = []
  const MAX_LEN = 280

  tweets.push(`${conversation.rawInput} — AI Roundtable Discussion (thread)`.slice(0, MAX_LEN))

  const round1 = conversation.responses.filter((r) => r.round === 1)
  for (const resp of round1) {
    const name = getModelName(resp.model)
    const prefix = `${name}:\n`
    const maxContent = MAX_LEN - prefix.length
    const chunks = chunkText(resp.content, maxContent)
    for (const chunk of chunks) {
      tweets.push(`${prefix}${chunk}`.slice(0, MAX_LEN))
    }
  }

  tweets.push('Round 2 — Reactions:'.slice(0, MAX_LEN))

  const round2 = conversation.responses.filter((r) => r.round === 2)
  for (const resp of round2) {
    const name = getModelName(resp.model)
    const prefix = `${name} reacts:\n`
    const maxContent = MAX_LEN - prefix.length
    const chunks = chunkText(resp.content, maxContent)
    for (const chunk of chunks) {
      tweets.push(`${prefix}${chunk}`.slice(0, MAX_LEN))
    }
  }

  return tweets
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }
    let splitAt = remaining.lastIndexOf(' ', maxLen)
    if (splitAt === -1) splitAt = maxLen
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }
  return chunks
}
