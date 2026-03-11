import Link from 'next/link'

export function LandingPricing() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Subscription card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-1">
          $20 / month
        </div>
        <p className="text-ink-muted text-[14px] leading-relaxed mb-5">
          All four models. Unlimited conversations. No API keys needed.
        </p>
        <Link
          href="/login"
          className="block w-full py-3 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide text-center transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
        >
          Sign in
        </Link>
      </div>

      {/* BYOK card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-1">
          Bring your own keys
        </div>
        <p className="text-ink-muted text-[14px] leading-relaxed mb-5">
          Free. Use your own API keys. Same features.
        </p>
        <Link
          href="/login"
          className="block w-full py-3 bg-card border border-border text-ink rounded-lg font-semibold text-sm tracking-wide text-center transition-all duration-200 hover:border-border-strong"
        >
          Sign in
        </Link>
      </div>
    </div>
  )
}
