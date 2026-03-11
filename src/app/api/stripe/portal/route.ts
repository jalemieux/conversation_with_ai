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
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 400 })
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.CWAI_NEXTAUTH_URL}/settings`,
  })

  return NextResponse.json({ url: portalSession.url })
}
