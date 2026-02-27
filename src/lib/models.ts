import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createXai } from '@ai-sdk/xai'

const anthropic = createAnthropic({ apiKey: process.env.CWAI_ANTHROPIC_API_KEY })
const openai = createOpenAI({ apiKey: process.env.CWAI_OPENAI_API_KEY })
const google = createGoogleGenerativeAI({ apiKey: process.env.CWAI_GOOGLE_API_KEY })
const xai = createXai({ apiKey: process.env.CWAI_XAI_API_KEY })
import type { LanguageModel } from 'ai'
import type { ProviderOptions } from '@ai-sdk/provider-utils'

export interface ModelConfig {
  id: string
  name: string
  provider: string
  modelId: string
  providerOptions?: ProviderOptions
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
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
    modelId: 'gpt-5.2-pro',
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
  },
}

const PROVIDERS: Record<string, (modelId: string) => LanguageModel> = {
  anthropic: (modelId) => anthropic(modelId),
  openai: (modelId) => openai(modelId),
  google: (modelId) => google(modelId),
  xai: (modelId) => xai(modelId),
}

export function getModelProvider(modelKey: string): LanguageModel {
  const config = MODEL_CONFIGS[modelKey]
  if (!config) throw new Error(`Unknown model: ${modelKey}`)
  return PROVIDERS[config.provider](config.modelId)
}

export function getDefaultModels(): string[] {
  return Object.keys(MODEL_CONFIGS)
}
