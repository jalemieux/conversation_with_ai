import { NextResponse } from 'next/server'
import { verifyPassword, generateToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { password } = body

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  }

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = generateToken()
  const isProduction = process.env.NODE_ENV === 'production'

  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })

  return response
}
