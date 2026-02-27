import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the openai module
vi.mock('openai', () => {
  const mockCreate = vi.fn()
  return {
    default: class {
      audio = { speech: { create: mockCreate } }
    },
    __mockCreate: mockCreate,
  }
})

import { POST } from './route'

// Access the mock
const { __mockCreate: mockCreate } = await import('openai') as any

describe('POST /api/tts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CWAI_OPENAI_API_KEY = 'test-key'
  })

  it('should return 400 if text is missing', async () => {
    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('should return 400 if model is missing', async () => {
    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello world' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('should call OpenAI TTS with correct parameters', async () => {
    const mockArrayBuffer = new ArrayBuffer(8)
    const mockResponse = {
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    }
    mockCreate.mockResolvedValue(mockResponse)

    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '**Hello** world', model: 'claude' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'gpt-4o-mini-tts',
      voice: 'coral',
      input: 'Hello world',
      instructions: 'Read naturally in a conversational tone.',
      response_format: 'mp3',
    })
  })

  it('should default to alloy voice for unknown model', async () => {
    const mockResponse = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }
    mockCreate.mockResolvedValue(mockResponse)

    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', model: 'unknown' }),
    })
    await POST(req)

    expect(mockCreate.mock.calls[0][0].voice).toBe('alloy')
  })

  it('should return 500 on OpenAI error', async () => {
    mockCreate.mockRejectedValue(new Error('API error'))

    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', model: 'claude' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
