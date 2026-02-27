export const TOPIC_TYPES = [
  'prediction',
  'opinion',
  'comparison',
  'trend_analysis',
  'open_question',
] as const

export type TopicType = (typeof TOPIC_TYPES)[number]

export interface AugmenterResult {
  topicType: TopicType
  framework: string
  augmentedPrompt: string
}

export function buildAugmenterPrompt(rawInput: string): string {
  return `You are a prompt augmenter. Given a user's raw topic or question, you must:

1. Classify it into one topic_type: prediction, opinion, comparison, trend_analysis, open_question
2. Select the appropriate analytical framework:
   - prediction → scenario analysis, 1st/2nd order effects
   - opinion → steel man vs straw man
   - comparison → strongest case for each side
   - trend_analysis → timeline framing, recent context
   - open_question → multiple angles, trade-offs
3. Rewrite the prompt to be clear and structured, adding at most 1-2 sentences of analytical framing

Principles:
- Add structure and depth, not fluff
- Keep it concise
- Preserve the user's nuance and framing
- Don't over-constrain with too many sub-questions

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "topic_type": "one of: prediction, opinion, comparison, trend_analysis, open_question",
  "framework": "brief name of the framework applied",
  "augmented_prompt": "the rewritten prompt"
}

User's raw input: "${rawInput}"`
}

export function parseAugmenterResponse(text: string): AugmenterResult {
  // Strip markdown code blocks if present
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const parsed = JSON.parse(cleaned)

  return {
    topicType: parsed.topic_type,
    framework: parsed.framework,
    augmentedPrompt: parsed.augmented_prompt,
  }
}
