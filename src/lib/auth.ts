const COOKIE_NAME = 'cwai-auth'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

function getPassword(): string {
  return process.env.CWAI_ACCESS_PASSWORD || ''
}

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export async function generateToken(): Promise<string> {
  return hmacSha256('cwai-auth-key', getPassword())
}

export function verifyPassword(input: string): boolean {
  const password = getPassword()
  if (!password) return false
  return constantTimeEqual(input, password)
}

export async function verifyToken(token: string): Promise<boolean> {
  if (!token || !getPassword()) return false
  const expected = await generateToken()
  return constantTimeEqual(token, expected)
}

export { COOKIE_NAME, COOKIE_MAX_AGE }
