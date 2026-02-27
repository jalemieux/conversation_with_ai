import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import { xai } from '@ai-sdk/xai'
import type { LanguageModel } from 'ai'

export interface ModelConfig {
  id: string
  name: string
  provider: string
  modelId: string
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6',
  },
  gpt4: {
    id: 'gpt4',
    name: 'GPT-4',
    provider: 'openai',
    modelId: 'gpt-4o',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    provider: 'google',
    modelId: 'gemini-2.5-pro-preview-06-05',
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    provider: 'xai',
    modelId: 'grok-3',
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
