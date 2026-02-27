import { describe, it, expect } from 'vitest'
import { MODEL_CONFIGS, getModelProvider, getDefaultModels, getSearchConfig } from './models'

describe('Model Configuration', () => {
  it('should have 4 model configs', () => {
    expect(Object.keys(MODEL_CONFIGS)).toHaveLength(4)
  })

  it('should have required fields for each model', () => {
    for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
      expect(config.id).toBe(key)
      expect(config.name).toBeTruthy()
      expect(config.provider).toBeTruthy()
      expect(config.modelId).toBeTruthy()
    }
  })

  it('should return a provider instance for each model', () => {
    for (const key of Object.keys(MODEL_CONFIGS)) {
      const provider = getModelProvider(key)
      expect(provider).toBeDefined()
    }
  })

  it('should return all 4 default models', () => {
    const defaults = getDefaultModels()
    expect(defaults).toHaveLength(4)
  })
})

describe('getSearchConfig', () => {
  it('should return search tools for claude', () => {
    const config = getSearchConfig('claude')
    expect(config.tools).toBeDefined()
    expect(config.tools!.web_search).toBeDefined()
  })

  it('should return search tools for gpt', () => {
    const config = getSearchConfig('gpt')
    expect(config.tools).toBeDefined()
    expect(config.tools!.web_search).toBeDefined()
  })

  it('should return search tools for gemini', () => {
    const config = getSearchConfig('gemini')
    expect(config.tools).toBeDefined()
    expect(config.tools!.google_search).toBeDefined()
  })

  it('should return providerOptions for grok', () => {
    const config = getSearchConfig('grok')
    expect(config.providerOptions?.xai).toEqual({
      searchParameters: { mode: 'auto', returnCitations: true },
    })
  })

  it('should return empty config for unknown model', () => {
    const config = getSearchConfig('unknown')
    expect(config).toEqual({})
  })
})
