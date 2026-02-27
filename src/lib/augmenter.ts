export const TOPIC_TYPES = [
  'prediction',
  'opinion',
  'comparison',
  'trend_analysis',
  'open_question',
] as const

export type TopicType = (typeof TOPIC_TYPES)[number]

export interface AugmentationEntry {
  framework: string
  augmentedPrompt: string
}

export type AugmentationsMap = Record<TopicType, AugmentationEntry>

export interface MultiAugmenterResult {
  recommended: TopicType
  augmentations: AugmentationsMap
}

export interface AugmenterResult {
  topicType: TopicType
  framework: string
  augmentedPrompt: string
}

export function buildAugmenterPrompt(rawInput: string): string {
  return `You are a prompt augmenter. Given a user's raw topic or question, you must generate an augmented prompt for EACH of the 5 topic types below, using the appropriate analytical framework for each.

Topic types and their frameworks:
- prediction → scenario analysis, 1st/2nd order effects
- opinion → steel man vs straw man
- comparison → strongest case for each side
- trend_analysis → timeline framing, recent context
- open_question → multiple angles, trade-offs

For each type, rewrite the user's input to fit that analytical framing. Add at most 1-2 sentences of analytical framing per type.

Principles:
- Add structure and depth, not fluff
- Keep each augmented prompt concise
- Preserve the user's nuance and framing
- Don't over-constrain with too many sub-questions
- Some framings may fit the input better than others — do your best for each

Also pick which topic_type best fits the input as "recommended".

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "recommended": "one of: prediction, opinion, comparison, trend_analysis, open_question",
  "augmentations": {
    "prediction": { "framework": "brief framework name", "augmented_prompt": "rewritten prompt" },
    "opinion": { "framework": "brief framework name", "augmented_prompt": "rewritten prompt" },
    "comparison": { "framework": "brief framework name", "augmented_prompt": "rewritten prompt" },
    "trend_analysis": { "framework": "brief framework name", "augmented_prompt": "rewritten prompt" },
    "open_question": { "framework": "brief framework name", "augmented_prompt": "rewritten prompt" }
  }
}

User's raw input: "${rawInput}"`
}

export function parseMultiAugmenterResponse(text: string): MultiAugmenterResult {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const parsed = JSON.parse(cleaned)

  const augmentations: AugmentationsMap = {} as AugmentationsMap
  for (const type of TOPIC_TYPES) {
    const entry = parsed.augmentations[type]
    augmentations[type] = {
      framework: entry.framework,
      augmentedPrompt: entry.augmented_prompt,
    }
  }

  return {
    recommended: parsed.recommended as TopicType,
    augmentations,
  }
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
