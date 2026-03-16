import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollFadeIn } from '@/components/ScrollFadeIn'
import { ConversationFlow } from '@/components/ConversationFlow'
import { LandingTracker, LandingCTA } from '@/components/LandingTracker'
import { MODEL_DOTS, MODEL_ACCENTS } from '@/lib/model-colors'

export const metadata: Metadata = {
  title: 'Conversation With AI — Frontier models, one conversation',
  description:
    'Ask a question, hear from every frontier model, and let them challenge each other. Read or listen. Bring your own keys or subscribe.',
  openGraph: {
    title: 'Conversation With AI',
    description:
      'Frontier models in one structured conversation. Sharpen your question, compare every answer, read or listen.',
    type: 'website',
  },
}

const MODELS = [
  { key: 'claude', name: 'Claude', modelId: 'claude-opus-4-6', provider: 'Anthropic', capability: 'Extended thinking', note: 'Careful, nuanced reasoning with deep structural analysis' },
  { key: 'gpt', name: 'GPT', modelId: 'gpt-5.4', provider: 'OpenAI', capability: 'Reasoning (medium)', note: 'Methodologically rigorous with broad synthesis' },
  { key: 'gemini', name: 'Gemini', modelId: 'gemini-2.5-pro', provider: 'Google', capability: 'Thinking mode', note: 'Analytical and grounded with search integration' },
  { key: 'grok', name: 'Grok', modelId: 'grok-4-1-fast-reasoning', provider: 'xAI', capability: 'Fast reasoning', note: 'Direct, contrarian, leverages real-time data' },
]

export default function LandingC() {
  return (
    <>
      <LandingTracker variant="c" />
      {/* ── Hero ── */}
      <section className="pt-16 pb-20 text-center">
        <ScrollFadeIn>
          <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl font-semibold tracking-tight leading-tight text-ink mb-6">
            Conversation With AI
          </h1>
          <p className="text-ink-light text-[18px] leading-relaxed max-w-lg mx-auto mb-4">
            Explore complex questions from different angles. AI helps you frame the right question, then every frontier model responds and they critique each other's answers.
          </p>
          <p className="text-ink-muted text-[16px] leading-relaxed max-w-md mx-auto mb-8">
            Read or listen. Bring your own API keys for free, or pay a flat fee and skip the setup.
          </p>
          <LandingCTA
            variant="c"
            href="/login"
            className="inline-block px-8 py-3.5 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
          >
            Sign up
          </LandingCTA>
          <p className="mt-3 text-ink-muted text-sm">
            Already have an account?{' '}
            <Link href="/login" className="underline hover:text-ink transition-colors">
              Sign in
            </Link>
          </p>
        </ScrollFadeIn>
      </section>

      {/* ── The Models ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-6 text-center">
            The models
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODELS.map((m) => {
              const dot = MODEL_DOTS[m.key] ?? 'bg-amber'
              const accent = MODEL_ACCENTS[m.key] ?? 'text-amber'
              return (
                <div key={m.key} className="bg-card border border-border rounded-xl px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                    <span className={`text-sm font-semibold ${accent}`}>{m.name}</span>
                  </div>
                  <div className="text-ink-muted text-[12px] font-mono mb-2">
                    {m.provider} / {m.modelId}
                  </div>
                  <div className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber/10 text-amber mb-2">
                    {m.capability}
                  </div>
                  <p className="text-ink-muted text-[13px] leading-relaxed">
                    {m.note}
                  </p>
                </div>
              )
            })}
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── Conversation Flow ── */}
      <section className="pb-20">
        <ConversationFlow />
      </section>

      {/* ── Pricing ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-8 text-center">
            Pricing
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Subscription card */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-1">
                $20 / month
              </div>
              <p className="text-ink-muted text-[14px] leading-relaxed mb-5">
                One flat fee. Reasonable access to every frontier model. No API keys, no configuration — just sign in and go.
              </p>
              <LandingCTA
                variant="c"
                href="/login"
                className="block w-full py-3 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide text-center transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
              >
                Sign up
              </LandingCTA>
            </div>

            {/* BYOK card */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-1">
                Bring your own keys
              </div>
              <p className="text-ink-muted text-[14px] leading-relaxed mb-5">
                Free access. Plug in your own API keys and pay providers directly. Same features, no subscription.
              </p>
              <LandingCTA
                variant="c"
                href="/login"
                className="block w-full py-3 bg-card border border-border text-ink rounded-lg font-semibold text-sm tracking-wide text-center transition-all duration-200 hover:border-border-strong"
              >
                Sign up
              </LandingCTA>
            </div>
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── Footer CTA ── */}
      <section className="pb-16">
        <ScrollFadeIn>
          <p className="font-[family-name:var(--font-serif)] text-xl text-ink mb-6">
            One question. Every frontier model. No switching tabs.
          </p>
          <LandingCTA
            variant="c"
            href="/login"
            className="inline-block px-8 py-3.5 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
          >
            Sign up
          </LandingCTA>
        </ScrollFadeIn>
      </section>

      {/* ── Copyright ── */}
      <footer className="pb-8 text-center text-ink-muted text-sm">
        © {new Date().getFullYear()}{' '}
        <a href="https://smartlayer.ventures" className="underline hover:text-ink transition-colors">
          SmartLayer Ventures
        </a>
      </footer>
    </>
  )
}
