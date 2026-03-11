import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollFadeIn } from '@/components/ScrollFadeIn'
import { ExampleConversation } from '@/components/ExampleConversation'
import { LandingPricing } from '@/components/LandingPricing'
import { MODEL_DOTS, MODEL_ACCENTS } from '@/lib/model-colors'

export const metadata: Metadata = {
  title: 'Conversation With AI — Structured analysis from frontier models',
  description:
    'Frame your question, compare answers from Claude, GPT, Gemini, and Grok, and surface what one model misses.',
  openGraph: {
    title: 'Conversation With AI',
    description:
      'Structured analysis from the frontier models. Frame the question, compare the answers, surface what one model misses.',
    type: 'website',
  },
}

const MODELS = [
  { key: 'claude', name: 'Claude' },
  { key: 'gpt', name: 'GPT' },
  { key: 'gemini', name: 'Gemini' },
  { key: 'grok', name: 'Grok' },
]

const STEPS = [
  { number: '1', label: 'Ask', description: 'Pose a question on any topic.' },
  { number: '2', label: 'Frame', description: 'AI refines your prompt for depth and precision.' },
  { number: '3', label: 'Compare', description: 'Multiple models respond. Then they respond to each other.' },
]

const FEATURES = [
  { label: 'Prompt framing', description: 'AI analyzes your input and suggests the sharpest angle.' },
  { label: 'Multi-round debate', description: 'Models read each other\u2019s responses and push back.' },
  { label: 'Text-to-speech', description: 'Listen to any response. Each model has a distinct voice.' },
  { label: 'Export', description: 'Download the full discussion as Markdown, text, or X thread.' },
  { label: 'Bring your own keys', description: 'Use your API keys instead of subscribing.' },
  { label: 'History', description: 'Every conversation saved and searchable.' },
]

export default function LandingA() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="pt-16 pb-20 text-center">
        <ScrollFadeIn>
          <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl font-semibold tracking-tight leading-tight text-ink mb-5">
            Conversation With AI
          </h1>
          <p className="text-ink-muted text-[16px] leading-relaxed max-w-lg mx-auto mb-8">
            Structured analysis from the frontier models. Frame the question, compare the answers, surface what one model misses.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3.5 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
          >
            Sign in
          </Link>
        </ScrollFadeIn>
      </section>

      {/* ── How It Works ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-8 text-center">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <div key={step.number} className="text-center">
                <div className="text-amber font-[family-name:var(--font-serif)] text-3xl font-semibold mb-2">
                  {step.number}.
                </div>
                <div className="font-semibold text-ink text-[15px] mb-1">{step.label}</div>
                <p className="text-ink-muted text-[14px] leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── Models ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-6 text-center">
            The panel
          </h2>
          <div className="flex justify-center gap-6 flex-wrap mb-4">
            {MODELS.map((m) => {
              const dot = MODEL_DOTS[m.key] ?? 'bg-amber'
              const accent = MODEL_ACCENTS[m.key] ?? 'text-amber'
              return (
                <div key={m.key} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  <span className={`text-sm font-semibold ${accent}`}>{m.name}</span>
                </div>
              )
            })}
          </div>
          <p className="text-ink-muted text-[14px] text-center">
            Four reasoning styles. Each sees what the others don't.
          </p>
        </ScrollFadeIn>
      </section>

      {/* ── Example ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <ExampleConversation />
        </ScrollFadeIn>
      </section>

      {/* ── Features ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-8 text-center">
            Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-card border border-border rounded-xl p-5">
                <div className="font-semibold text-ink text-[15px] mb-1">{f.label}</div>
                <p className="text-ink-muted text-[14px] leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </ScrollFadeIn>
      </section>

      {/* ── Pricing ── */}
      <section className="pb-20">
        <ScrollFadeIn>
          <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-8 text-center">
            Pricing
          </h2>
          <LandingPricing />
        </ScrollFadeIn>
      </section>

      {/* ── Footer CTA ── */}
      <section className="pb-16 text-center">
        <ScrollFadeIn>
          <p className="font-[family-name:var(--font-serif)] text-xl text-ink mb-6">
            One question. Four perspectives.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3.5 bg-amber text-white rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 hover:bg-amber-light shadow-[0_2px_10px_rgba(122,154,130,0.25)] hover:shadow-[0_4px_16px_rgba(122,154,130,0.3)]"
          >
            Sign in
          </Link>
        </ScrollFadeIn>
      </section>
    </>
  )
}
