import { createHmac, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'cwai-auth'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

function getPassword(): string {
  return process.env.CWAI_ACCESS_PASSWORD || ''
}

export function generateToken(): string {
  const password = getPassword()
  return createHmac('sha256', 'cwai-auth-key').update(password).digest('hex')
}

export function verifyPassword(input: string): boolean {
  const password = getPassword()
  if (!password) return false
  const a = Buffer.from(input)
  const b = Buffer.from(password)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function verifyToken(token: string): boolean {
  if (!token || !getPassword()) return false
  const expected = generateToken()
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export { COOKIE_NAME, COOKIE_MAX_AGE }
