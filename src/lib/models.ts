import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createXai } from '@ai-sdk/xai'

import { tool, type LanguageModel, type ToolSet } from 'ai'
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import { z } from 'zod'
import { braveSearch, type BraveSearchResult } from './brave-search'

const PLATFORM_KEYS: Record<string, string | undefined> = {
  anthropic: process.env.CWAI_ANTHROPIC_API_KEY,
  openai: process.env.CWAI_OPENAI_API_KEY,
  google: process.env.CWAI_GOOGLE_API_KEY,
  xai: process.env.CWAI_XAI_API_KEY,
}

function createProvider(providerName: string, apiKey: string): (modelId: string) => LanguageModel {
  switch (providerName) {
    case 'anthropic': return (modelId) => createAnthropic({ apiKey })(modelId)
    case 'openai': return (modelId) => createOpenAI({ apiKey }).responses(modelId)
    case 'google': return (modelId) => createGoogleGenerativeAI({ apiKey })(modelId)
    case 'xai': return (modelId) => createXai({ apiKey }).responses(modelId)
    default: throw new Error(`Unknown provider: ${providerName}`)
  }
}

export interface ModelConfig {
  id: string
  name: string
  provider: string
  modelId: string
  pricing: { inputPerMTok: number; outputPerMTok: number }
  providerOptions?: ProviderOptions
  systemPrompt?: string
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    pricing: { inputPerMTok: 5, outputPerMTok: 25 },
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 5000 },
      },
    },
  },
  gpt: {
    id: 'gpt',
    name: 'GPT',
    provider: 'openai',
    modelId: 'gpt-5.4',
    pricing: { inputPerMTok: 2.50, outputPerMTok: 15 },
    providerOptions: {
      openai: {
        reasoningEffort: 'medium',
      },
    },
    systemPrompt: `Provide a rigorous, well-reasoned analysis of the user’s question.
	•	Interpret the question in its strongest reasonable form (steelman it where appropriate).
	•	Identify underlying assumptions on all sides.
	•	Present the strongest arguments for each relevant position before critiquing them.
	•	Distinguish clearly between established facts, logical inferences, projections, and speculation.
	•	Highlight trade-offs, tensions, and second-order implications.
	•	Note where uncertainty or missing data materially affects conclusions.
	•	Avoid rhetorical framing; prioritize analytical clarity and intellectual fairness.

Conclude with a balanced synthesis that clarifies what is most defensible given current knowledge.`
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
    pricing: { inputPerMTok: 1.25, outputPerMTok: 10 },
    providerOptions: {
      google: {
        thinkingConfig: { thinkingBudget: 5000 },
      },
    },
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    provider: 'xai',
    modelId: 'grok-4-1-fast-reasoning',
    pricing: { inputPerMTok: 0.20, outputPerMTok: 0.50 },
    systemPrompt: `
Respond to the user's query with the highest quality, accurate, and thoughtful answer possible. 

1. **Analyze deeply**: Break down the question step-by-step, considering nuances, assumptions, and implications. Use chain-of-thought reasoning before finalizing your response.

2. **Draw on current knowledge**: Leverage the most up-to-date information available, verifying facts where possible. Cite reliable sources inline (e.g., [Source: URL or reference]) and note any uncertainties.

3. **Structure for clarity**: Use headings, bullet points, numbered lists, or tables as needed. Start with a concise summary, end with actionable takeaways or next steps. Aim for 600-800 words unless specified otherwise—comprehensive yet concise.

4. **Prioritize impact**: Treat this as high-stakes advice; be objective, unbiased, and evidence-based. The user may act on your response, so minimize risks and maximize value.

If tools or external checks are available, use them proactively.
    `
  },
}

/** Extract the base model key from an instance key, e.g. 'gpt:1' → 'gpt' */
export function baseModel(instanceKey: string): string {
  const idx = instanceKey.indexOf(':')
  return idx === -1 ? instanceKey : instanceKey.slice(0, idx)
}

export function getModelProvider(modelKey: string, apiKey?: string): LanguageModel {
  const config = MODEL_CONFIGS[modelKey]
  if (!config) throw new Error(`Unknown model: ${modelKey}`)
  const key = apiKey || PLATFORM_KEYS[config.provider]
  if (!key) throw new Error(`No API key for provider: ${config.provider}`)
  return createProvider(config.provider, key)(config.modelId)
}

export function getDefaultModels(): string[] {
  return Object.keys(MODEL_CONFIGS)
}

export interface SearchConfig {
  tools?: ToolSet
  providerOptions?: ProviderOptions
}

export function getSearchConfig(modelKey: string, apiKey?: string): SearchConfig {
  const config = MODEL_CONFIGS[modelKey]
  if (!config) return {}
  const key = apiKey || PLATFORM_KEYS[config.provider]
  if (!key) return {}

  switch (modelKey) {
    case 'claude':
      return {
        tools: {
          web_search: tool<{ query: string }, BraveSearchResult[]>({
            description: 'Search the web for current information on a topic',
            inputSchema: z.object({
              query: z.string().describe('The search query'),
            }),
            execute: async ({ query }) => {
              return await braveSearch(query)
            },
          }),
        },
      }
    case 'gpt': {
      const oa = createOpenAI({ apiKey: key })
      return {
        tools: { web_search: oa.tools.webSearch({ searchContextSize: 'medium' }) },
      }
    }
    case 'gemini': {
      const g = createGoogleGenerativeAI({ apiKey: key })
      return {
        tools: { google_search: g.tools.googleSearch({}) },
      }
    }
    case 'grok': {
      const x = createXai({ apiKey: key })
      return {
        tools: { web_search: x.tools.webSearch() },
      }
    }
    default:
      return {}
  }
}

export function calculateCost(
  modelKey: string,
  inputTokens: number,
  outputTokens: number
): number {
  const config = MODEL_CONFIGS[modelKey]
  if (!config) return 0
  const { inputPerMTok, outputPerMTok } = config.pricing
  return (inputTokens * inputPerMTok + outputTokens * outputPerMTok) / 1_000_000
}
