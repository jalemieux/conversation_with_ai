'use client'

import { useState } from 'react'

const TOPIC_TYPES = [
  {
    label: 'prediction',
    description: 'Scenario analysis with 1st/2nd order effects — Explores possible futures through scenario analysis and cascading effects',
    prompt: 'Will the US dollar lose its reserve currency status within 20 years? Map out 2\u20133 plausible scenarios (e.g., rapid de-dollarization, gradual erosion, status quo) and trace their first-order effects (trade settlement shifts, capital flows) and second-order consequences (geopolitical realignment, monetary policy constraints).',
  },
  {
    label: 'opinion',
    description: 'Steel man vs straw man — Stress-tests a position by building the strongest case for and against it',
    prompt: 'Should we expect the US dollar to lose reserve currency status in 20 years? Present the strongest case for de-dollarization (structural decline, rival currencies, institutional fragmentation) and the strongest case against (network effects, safe-haven demand, lack of viable alternatives), then identify which carries more weight.',
  },
  {
    label: 'trend_analysis',
    description: 'Timeline framing with recent context — Places the topic on a timeline with recent context and trajectory',
    prompt: 'How is the US dollar\u2019s reserve status evolving? Map the recent trajectory (BRICS currency initiatives, Fed policy shifts, trade de-dollarization efforts over the past 5\u201310 years) and project forward to identify inflection points or acceleration factors that might compress the 20-year horizon.',
  },
  {
    label: 'open_question',
    description: 'Multiple angles and trade-offs — Examines the question from multiple angles and surfaces trade-offs',
    prompt: 'What would it take for the US dollar to lose reserve status, and what are the trade-offs? Explore geopolitical, monetary, and structural angles: What alternatives exist? Who benefits/loses? How would transition mechanics work? What factors could accelerate or delay this shift?',
  },
]

export function SharpenPromptDemo() {
  const [activeIndex, setActiveIndex] = useState(1) // default to opinion
  const active = TOPIC_TYPES[activeIndex]

  return (
    <div className="bg-card border border-border rounded-xl px-6 py-5">
      <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-3">
        Topic type
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {TOPIC_TYPES.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActiveIndex(i)}
            className={`px-3 py-1.5 rounded-lg text-[13px] border transition-all duration-200 cursor-pointer ${
              i === activeIndex
                ? 'border-amber text-amber font-semibold'
                : 'border-border text-ink-muted hover:border-border-strong'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-ink-muted text-[13px] mb-5 transition-opacity duration-200">
        {active.description}
      </p>

      <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted mb-3">
        Augmented prompt
      </div>
      <div className="border border-amber/30 rounded-lg px-4 py-3 relative overflow-hidden">
        <p
          key={activeIndex}
          className="text-ink text-[14px] leading-relaxed animate-fade-in"
        >
          {active.prompt}
        </p>
      </div>
    </div>
  )
}
