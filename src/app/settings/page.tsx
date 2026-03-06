'use client'

import { useState, useEffect } from 'react'

interface UserKey {
  id: string
  provider: string
  createdAt: string
}

interface UserInfo {
  email: string
  subscriptionStatus: string
  subscriptionCurrentPeriodEnd: string | null
}

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'google', name: 'Google', placeholder: 'AIza...' },
  { id: 'xai', name: 'xAI', placeholder: 'xai-...' },
]

export default function SettingsPage() {
  const [keys, setKeys] = useState<UserKey[]>([])
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [newKeyProvider, setNewKeyProvider] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    fetch('/api/keys').then(r => r.json()).then(setKeys).catch(() => {})
    fetch('/api/user').then(r => r.json()).then(setUserInfo).catch(() => {})
  }, [])

  async function handleSaveKey() {
    if (!newKeyProvider || !newKeyValue) return
    setSaving(true)
    try {
      await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newKeyProvider, apiKey: newKeyValue }),
      })
      setNewKeyProvider('')
      setNewKeyValue('')
      const updated = await fetch('/api/keys').then(r => r.json())
      setKeys(updated)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteKey(provider: string) {
    if (!confirm(`Remove ${provider} API key?`)) return
    await fetch('/api/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    setKeys(keys.filter(k => k.provider !== provider))
  }

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleSubscribe() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setPortalLoading(false)
    }
  }

  const configuredProviders = new Set(keys.map(k => k.provider))
  const availableProviders = PROVIDERS.filter(p => !configuredProviders.has(p.id))

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-ink">Settings</h1>
        <a href="/" className="text-sm text-ink-muted hover:text-ink transition-colors">Back to home</a>
      </div>

      <section className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-4">Account</h2>
        {userInfo && <p className="text-ink">{userInfo.email}</p>}
      </section>

      <section className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-4">Subscription</h2>
        {userInfo?.subscriptionStatus === 'active' ? (
          <div>
            <p className="text-ink mb-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2" />
              Active &mdash; $20/month
            </p>
            {userInfo.subscriptionCurrentPeriodEnd && (
              <p className="text-sm text-ink-muted mb-4">
                Renews {new Date(userInfo.subscriptionCurrentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="px-4 py-2 text-sm bg-cream border border-border rounded-lg hover:border-amber/30 transition-all cursor-pointer"
            >
              {portalLoading ? 'Opening...' : 'Manage subscription'}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-ink-muted mb-4">No active subscription</p>
            <button
              onClick={handleSubscribe}
              disabled={portalLoading}
              className="px-4 py-2 text-sm bg-amber text-white rounded-lg hover:bg-amber-light transition-all cursor-pointer"
            >
              {portalLoading ? 'Redirecting...' : 'Subscribe for $20/month'}
            </button>
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-4">API Keys</h2>
        <p className="text-sm text-ink-muted mb-4">
          Add your own API keys to use models without a subscription. Keys are encrypted at rest.
        </p>

        {keys.length > 0 && (
          <div className="space-y-2 mb-6">
            {keys.map(key => {
              const providerInfo = PROVIDERS.find(p => p.id === key.provider)
              return (
                <div key={key.id} className="flex items-center justify-between py-3 px-4 bg-cream rounded-lg">
                  <div>
                    <span className="font-medium text-ink">{providerInfo?.name || key.provider}</span>
                    <span className="text-sm text-ink-faint ml-2">configured</span>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(key.provider)}
                    className="text-sm text-red-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {availableProviders.length > 0 && (
          <div className="flex gap-2 items-end">
            <div className="flex-shrink-0">
              <select
                value={newKeyProvider}
                onChange={e => setNewKeyProvider(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-border bg-cream text-ink text-sm focus:outline-none focus:border-amber"
              >
                <option value="">Provider...</option>
                {availableProviders.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <input
                type="password"
                value={newKeyValue}
                onChange={e => setNewKeyValue(e.target.value)}
                placeholder={PROVIDERS.find(p => p.id === newKeyProvider)?.placeholder || 'API key'}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-cream text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:border-amber"
              />
            </div>
            <button
              onClick={handleSaveKey}
              disabled={saving || !newKeyProvider || !newKeyValue}
              className="px-4 py-2.5 text-sm bg-amber text-white rounded-lg hover:bg-amber-light disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
