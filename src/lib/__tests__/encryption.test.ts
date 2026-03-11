import { describe, it, expect, vi } from 'vitest'

// Set env before import
vi.stubEnv('CWAI_ENCRYPTION_KEY', 'a'.repeat(64))

const { encrypt, decrypt } = await import('../encryption')

describe('encryption', () => {
  it('encrypts and decrypts a string', () => {
    const plaintext = 'sk-test-api-key-12345'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toContain(':')
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'sk-test-api-key-12345'
    const a = encrypt(plaintext)
    const b = encrypt(plaintext)
    expect(a).not.toBe(b)
  })

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('test')
    const parts = encrypted.split(':')
    parts[2] = 'ff' + parts[2].slice(2)
    expect(() => decrypt(parts.join(':'))).toThrow()
  })
})
