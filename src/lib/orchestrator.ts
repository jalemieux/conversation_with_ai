export interface Round1Response {
  model: string
  content: string
}

export function buildRound1Prompt(augmentedPrompt: string, modelName: string): string {
  return `${augmentedPrompt}`
}

export function buildRound2Prompt(
  augmentedPrompt: string,
  modelName: string,
  round1Responses: Round1Response[]
): string {
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

Now react to what the others said. You may agree, disagree, build on ideas, or offer new perspectives. Be direct and substantive — avoid generic praise. Aim for roughly 300-500 words. This is Round 2 of a published conversation.`
}
