import type { Metadata } from 'next'
import { ScrollFadeIn } from '@/components/ScrollFadeIn'
import { ExampleConversation } from '@/components/ExampleConversation'
import { LandingPricing } from '@/components/LandingPricing'
import { LandingTracker, LandingCTA } from '@/components/LandingTracker'
import { MODEL_DOTS, MODEL_ACCENTS } from '@/lib/model-colors'

export const metadata: Metadata = {
  title: 'Conversation With AI — Every model has blind spots',
  description:
    'A structured roundtable between frontier AI models. Surface disagreements, not consensus.',
  openGraph: {
    title: 'Conversation With AI',
    description:
      'Every model has blind spots. This tool lets you hear from all of them, in a structured format designed to surface the differences.',
    type: 'website',
  },
}

const MODELS = [
  { key: 'claude', name: 'Claude', style: 'Careful, nuanced' },
  { key: 'gpt', name: 'GPT', style: 'Broad, synthetic' },
  { key: 'gemini', name: 'Gemini', style: 'Analytical, grounded' },
  { key: 'grok', name: 'Grok', style: 'Direct, contrarian' },
]

const FEATURES = [
  { label: 'Prompt framing', description: 'AI analyzes your input and suggests the sharpest angle.' },
  { label: 'Multi-round debate', description: 'Models read each other\u2019s responses and push back.' },
  { label: 'Text-to-speech', description: 'Listen to any response. Each model has a distinct voice.' },
  { label: 'Export', description: 'Download the full discussion as Markdown, text, or X thread.' },
  { label: 'Bring your own keys', description: 'Use your API keys instead of subscribing.' },
  { label: 'History', description: 'Every conversation saved and searchable.' },
]

export default function LandingB() {
  return (
    <>
      <LandingTracker variant="b" />
      {/* ── Hero (The Problem) ── */}
      <section className="pt-16 pb-20">
        <ScrollFadeIn>
          <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl font-semibold tracking-tight leading-tight text-ink mb-6">
            Conversation With AI
          </h1>
          <div className="max-w-xl">
            <p className="text-ink-light text-[16px] leading-relaxed mb-6">
              Every model has blind spots. Ask Claude a policy question and it hedges. Ask GPT and it synthesizes toward consensus. Ask Grok and it provokes. None of them is wrong — but none of them is complete.
            </p>
            <p className="text-ink-light text-[16px] leading-relaxed mb-8">
              This tool lets you hear from all of them, in a structured format designed to surface the differences.
            </p>
          </div>
          <LandingCTA
            variant="b"
            href="/login"
            className="inline-block px-8 py-3.5 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
          >
            Sign in
          </LandingCTA>
        </ScrollFadeIn>
      </section>

      {/* ── The Mechanism ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-4">
            How it works
          </h2>
          <div className="max-w-xl">
            <p className="text-ink-light text-[15px] leading-relaxed">
              You start with a question. Before it reaches any model, AI analyzes your input and suggests framings — prediction, comparison, trend analysis — that draw out more substantive responses. Then multiple models answer in parallel. In a second round, each model reads the others and responds: agreements, objections, refinements. The result is a structured discussion, not a monologue.
            </p>
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── The Models ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-6">
            The models
          </h2>
          <div className="space-y-3 max-w-xl">
            {MODELS.map((m) => {
              const dot = MODEL_DOTS[m.key] ?? 'bg-amber'
              const accent = MODEL_ACCENTS[m.key] ?? 'text-amber'
              return (
                <div key={m.key} className="flex items-baseline gap-3">
                  <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0 translate-y-[-1px]`} />
                  <span className={`font-semibold text-[15px] ${accent}`}>{m.name}</span>
                  <span className="text-ink-muted text-[14px]">— {m.style}</span>
                </div>
              )
            })}
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── The Evidence (Example) ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-2">
            A real roundtable
          </h2>
          <p className="text-ink-muted text-[14px] mb-6">
            Here's what a structured discussion looks like.
          </p>
          <ExampleConversation />
        </ScrollFadeIn>
      </section>

      {/* ── What You Get (Features) ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-6">
            What you get
          </h2>
          <div className="space-y-4 max-w-xl">
            {FEATURES.map((f) => (
              <div key={f.label}>
                <span className="font-semibold text-ink text-[15px]">{f.label}.</span>{' '}
                <span className="text-ink-muted text-[14px]">{f.description}</span>
              </div>
            ))}
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── Pricing ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-ink mb-6">
            Pricing
          </h2>
          <LandingPricing />
        </ScrollFadeIn>
      </section>

      {/* ── Footer CTA ── */}
      <section className="pb-16">
        <ScrollFadeIn>
          <p className="font-[family-name:var(--font-serif)] text-xl text-ink mb-6">
            The best answer is rarely the first one you hear.
          </p>
          <LandingCTA
            variant="b"
            href="/login"
            className="inline-block px-8 py-3.5 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
          >
            Sign in
          </LandingCTA>
        </ScrollFadeIn>
      </section>
    </>
  )
}
