// @vitest-environment node
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

// Mock fs/promises
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  }
})

import { POST } from './route'
import { readFile, writeFile, mkdir } from 'fs/promises'

// Access the mocks
const { __mockCreate: mockCreate } = await import('openai') as any
const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)
const mockMkdir = vi.mocked(mkdir)

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

  it('should return cached audio when file exists on disk', async () => {
    const cachedAudio = Buffer.from('cached-audio-data')
    mockReadFile.mockResolvedValue(cachedAudio)

    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello',
        model: 'claude',
        conversationId: 'conv-123',
        round: 1,
      }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining('conv-123/1-claude.mp3')
    )
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('should save audio to disk on cache miss', async () => {
    const enoent = new Error('ENOENT') as NodeJS.ErrnoException
    enoent.code = 'ENOENT'
    mockReadFile.mockRejectedValue(enoent)
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)

    const mockArrayBuffer = new ArrayBuffer(8)
    mockCreate.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    })

    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello',
        model: 'claude',
        conversationId: 'conv-456',
        round: 2,
      }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalled()
    // Give fire-and-forget a tick to complete
    await new Promise((r) => setTimeout(r, 0))
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining('conv-456'),
      { recursive: true }
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('conv-456/2-claude.mp3'),
      expect.any(Buffer)
    )
  })

  it('should skip caching when conversationId is not provided', async () => {
    const mockArrayBuffer = new ArrayBuffer(8)
    mockCreate.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    })

    const req = new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', model: 'claude' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockReadFile).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalled()
  })
})
