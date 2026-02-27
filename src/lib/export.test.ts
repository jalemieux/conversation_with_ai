import { describe, it, expect } from 'vitest'
import { exportMarkdown, exportText, exportXThread } from './export'
import type { Conversation } from './types'

const mockConversation: Conversation = {
  id: '123',
  createdAt: '2026-02-26T12:00:00Z',
  rawInput: 'Future of software',
  augmentedPrompt: 'Analyze the future of software engineering...',
  topicType: 'prediction',
  framework: 'scenario_analysis',
  models: ['claude', 'gpt4'],
  responses: [
    { id: '1', round: 1, model: 'claude', content: 'Claude Round 1 response' },
    { id: '2', round: 1, model: 'gpt4', content: 'GPT-4 Round 1 response' },
    { id: '3', round: 2, model: 'claude', content: 'Claude Round 2 response' },
    { id: '4', round: 2, model: 'gpt4', content: 'GPT-4 Round 2 response' },
  ],
}

describe('Export Utilities', () => {
  describe('exportMarkdown', () => {
    it('should produce valid markdown with headers', () => {
      const md = exportMarkdown(mockConversation)
      expect(md).toContain('# Future of software')
      expect(md).toContain('## Round 1')
      expect(md).toContain('### Claude')
      expect(md).toContain('## Round 2')
      expect(md).toContain('Claude Round 1 response')
    })
  })

  describe('exportText', () => {
    it('should produce plain text', () => {
      const text = exportText(mockConversation)
      expect(text).toContain('Future of software')
      expect(text).toContain('Round 1')
      expect(text).toContain('Claude Round 1 response')
      expect(text).not.toContain('#')
    })
  })

  describe('exportXThread', () => {
    it('should produce an array of tweets under 280 chars', () => {
      const tweets = exportXThread(mockConversation)
      expect(tweets.length).toBeGreaterThan(0)
      for (const tweet of tweets) {
        expect(tweet.length).toBeLessThanOrEqual(280)
      }
    })

    it('should start with the topic', () => {
      const tweets = exportXThread(mockConversation)
      expect(tweets[0]).toContain('Future of software')
    })
  })
})
