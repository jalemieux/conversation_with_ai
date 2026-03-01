import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createXai } from '@ai-sdk/xai'

const anthropic = createAnthropic({ apiKey: process.env.CWAI_ANTHROPIC_API_KEY })
const openai = createOpenAI({ apiKey: process.env.CWAI_OPENAI_API_KEY })
const google = createGoogleGenerativeAI({ apiKey: process.env.CWAI_GOOGLE_API_KEY })
const xai = createXai({ apiKey: process.env.CWAI_XAI_API_KEY })
import { tool, type LanguageModel, type ToolSet } from 'ai'
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import { z } from 'zod'
import { braveSearch, type BraveSearchResult } from './brave-search'

export interface ModelConfig {
  id: string
  name: string
  provider: string
  modelId: string
  pricing: { inputPerMTok: number; outputPerMTok: number }
  providerOptions?: ProviderOptions
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
    modelId: 'gpt-5.1',
    pricing: { inputPerMTok: 1.25, outputPerMTok: 10 },
    providerOptions: {
      openai: {
        reasoningEffort: 'medium',
      },
    },
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    provider: 'google',
    modelId: 'gemini-3.1-pro-preview',
    pricing: { inputPerMTok: 2, outputPerMTok: 12 },
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
  },
}

const PROVIDERS: Record<string, (modelId: string) => LanguageModel> = {
  anthropic: (modelId) => anthropic(modelId),
  openai: (modelId) => openai(modelId),
  google: (modelId) => google(modelId),
  xai: (modelId) => xai.responses(modelId),
}

export function getModelProvider(modelKey: string): LanguageModel {
  const config = MODEL_CONFIGS[modelKey]
  if (!config) throw new Error(`Unknown model: ${modelKey}`)
  return PROVIDERS[config.provider](config.modelId)
}

export function getDefaultModels(): string[] {
  return Object.keys(MODEL_CONFIGS)
}

export interface SearchConfig {
  tools?: ToolSet
  maxSteps?: number
  providerOptions?: ProviderOptions
}

export function getSearchConfig(modelKey: string): SearchConfig {
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
        maxSteps: 2,
      }
    case 'gpt':
      return {
        tools: {
          web_search: openai.tools.webSearch({ searchContextSize: 'medium' }),
        },
      }
    case 'gemini':
      return {
        tools: {
          google_search: google.tools.googleSearch({}),
        },
      }
    case 'grok':
      return {
        tools: {
          web_search: xai.tools.webSearch(),
        },
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
