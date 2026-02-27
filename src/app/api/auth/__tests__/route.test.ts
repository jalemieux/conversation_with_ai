import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')

// Import after stubbing env
const { POST } = await import('../route')

describe('POST /api/auth', () => {
  it('returns 200 and sets cookie for correct password', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-password' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain('cwai-auth=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Path=/')
  })

  it('returns 401 for wrong password', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toBeNull()
  })

  it('returns 400 for missing password', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
