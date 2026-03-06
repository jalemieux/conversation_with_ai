import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

const stripe = new Stripe(process.env.CWAI_STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.CWAI_STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.customer && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        await db.update(users).set({
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: 'active',
          subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        }).where(eq(users.stripeCustomerId, session.customer as string))
      }
      break
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.customer && invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
        await db.update(users).set({
          subscriptionStatus: 'active',
          subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        }).where(eq(users.stripeCustomerId, invoice.customer as string))
      }
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      await db.update(users).set({
        subscriptionStatus: subscription.status === 'active' ? 'active' : subscription.status,
        subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      }).where(eq(users.stripeSubscriptionId, subscription.id))
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await db.update(users).set({
        subscriptionStatus: 'none',
        stripeSubscriptionId: null,
        subscriptionCurrentPeriodEnd: null,
      }).where(eq(users.stripeSubscriptionId, subscription.id))
      break
    }
  }

  return NextResponse.json({ received: true })
}
