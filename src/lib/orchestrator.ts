const BASE_SYSTEM = `Answer the user's question as best you can. Think deeply and carefully — the questions asked can be complex and nuanced. Draw on the most up-to-date knowledge available to you. The user expects a serious answer and might make decisions with real consequences based on what you say.`

const ESSAY_STYLE = `Write in flowing, essay-style prose — the kind you'd find in The Economist or The Atlantic. Develop your argument through connected paragraphs, not bullet points or numbered lists. You may occasionally use a brief structured element (a short comparison, a key enumeration) when it genuinely serves clarity, but the default mode is always discursive prose.`

//const ROUND_1_ADDITIONS = `Aim for roughly 600–800 words.`
const ROUND_2_ADDITIONS = `Be direct and substantive — avoid generic praise. Aim for roughly 300–500 words.`

export function buildSystemPrompt(round: 1 | 2, essayMode: boolean, modelSystemPrompt?: string): string {
  const parts = [modelSystemPrompt ?? BASE_SYSTEM]
  if (essayMode) parts.push(ESSAY_STYLE)
  //parts.push(round === 1 ? ROUND_1_ADDITIONS : ROUND_2_ADDITIONS)
  return parts.join('\n\n')
}

export interface Round1Response {
  model: string
  content: string
}

export function buildUserPrompt(
  augmentedPrompt: string,
  modelName: string,
  round1Responses?: Round1Response[]
): string {
  if (!round1Responses) return augmentedPrompt

  const otherResponses = round1Responses
    .filter((r) => r.model !== modelName)
    .map((r) => `### ${r.model}\n${r.content}`)
    .join('\n\n')

  const ownResponse = round1Responses.find((r) => r.model === modelName)

  return `The original topic was:

${augmentedPrompt}

Your initial response was:
${ownResponse?.content ?? '(no initial response)'}

Here are the other models' initial responses:

${otherResponses}

Now react to what the others said. You may agree, disagree, build on ideas, or offer new perspectives.`
}
