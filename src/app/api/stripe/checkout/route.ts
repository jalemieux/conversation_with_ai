import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/lib/auth-config'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

const stripe = new Stripe(process.env.CWAI_STRIPE_SECRET_KEY!)

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id))
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    })
    customerId = customer.id
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id))
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: process.env.CWAI_STRIPE_PRICE_ID!, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${process.env.CWAI_NEXTAUTH_URL}/?checkout=success`,
    cancel_url: `${process.env.CWAI_NEXTAUTH_URL}/setup?checkout=canceled`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
