import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('auth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  describe('generateToken', () => {
    it('returns a hex string', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { generateToken } = await import('@/lib/auth')
      const token = await generateToken()
      expect(token).toMatch(/^[a-f0-9]{64}$/)
    })

    it('produces the same token for the same password', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { generateToken } = await import('@/lib/auth')
      expect(await generateToken()).toBe(await generateToken())
    })

    it('produces different tokens for different passwords', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'password-a')
      const authA = await import('@/lib/auth')
      const tokenA = await authA.generateToken()

      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'password-b')
      vi.resetModules()
      const authB = await import('@/lib/auth')
      const tokenB = await authB.generateToken()

      expect(tokenA).not.toBe(tokenB)
    })
  })

  describe('verifyPassword', () => {
    it('returns true for correct password', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { verifyPassword } = await import('@/lib/auth')
      expect(verifyPassword('test-password')).toBe(true)
    })

    it('returns false for wrong password', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { verifyPassword } = await import('@/lib/auth')
      expect(verifyPassword('wrong')).toBe(false)
    })

    it('returns false when no password is configured', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', '')
      const { verifyPassword } = await import('@/lib/auth')
      expect(verifyPassword('anything')).toBe(false)
    })
  })

  describe('verifyToken', () => {
    it('returns true for a valid token', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { generateToken, verifyToken } = await import('@/lib/auth')
      const token = await generateToken()
      expect(await verifyToken(token)).toBe(true)
    })

    it('returns false for an invalid token', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { verifyToken } = await import('@/lib/auth')
      expect(await verifyToken('bad-token')).toBe(false)
    })

    it('returns false for empty token', async () => {
      vi.stubEnv('CWAI_ACCESS_PASSWORD', 'test-password')
      const { verifyToken } = await import('@/lib/auth')
      expect(await verifyToken('')).toBe(false)
    })
  })
})
