const GA_MEASUREMENT_ID = 'G-4WBHPXNRST'

interface ServerEvent {
  name: string
  params?: Record<string, string | number | boolean>
}

export async function sendServerEvent(
  clientId: string,
  userId: string | undefined,
  events: ServerEvent[]
): Promise<void> {
  const apiSecret = process.env.CWAI_GA4_MEASUREMENT_PROTOCOL_SECRET
  if (!apiSecret) return

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${apiSecret}`

  const body: Record<string, unknown> = {
    client_id: clientId,
    events: events.map((e) => ({
      name: e.name,
      params: e.params ?? {},
    })),
  }
  if (userId) {
    body.user_id = userId
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // Silently fail — analytics should never break the app
  }
}
