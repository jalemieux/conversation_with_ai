export function hasAccess({ subscriptionStatus, hasKeys }: {
  subscriptionStatus: string
  hasKeys: boolean
}): boolean {
  return subscriptionStatus === 'active' || hasKeys
}
