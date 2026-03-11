import { MODEL_CONFIGS } from './models'

const PROVIDER_TO_MODELS: Record<string, string[]> = {}

for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
  if (!PROVIDER_TO_MODELS[config.provider]) {
    PROVIDER_TO_MODELS[config.provider] = []
  }
  PROVIDER_TO_MODELS[config.provider].push(key)
}

export function getAvailableModelKeys(
  subscriptionStatus: string,
  userProviders: string[],
): string[] {
  if (subscriptionStatus === 'active') {
    return Object.keys(MODEL_CONFIGS)
  }

  const available: string[] = []
  for (const provider of userProviders) {
    const models = PROVIDER_TO_MODELS[provider]
    if (models) available.push(...models)
  }
  return available
}
