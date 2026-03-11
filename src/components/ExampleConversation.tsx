import { MODEL_DOTS, MODEL_ACCENTS } from '@/lib/model-colors'

const MOCK_TOPIC = 'Will the US dollar lose its reserve currency status within 20 years?'

const MOCK_RESPONSES = [
  {
    model: 'claude',
    name: 'Claude',
    snippet:
      'The dollar\'s reserve status rests on deep structural advantages — network effects in trade invoicing, the depth of US Treasury markets, and the absence of a credible alternative. Gradual erosion is plausible, but full displacement within 20 years requires a coordination event that no rival currency can yet trigger.',
  },
  {
    model: 'gpt',
    name: 'GPT',
    snippet:
      'History offers a template: sterling\'s decline took roughly 30 years after Bretton Woods shifted the center of gravity. BRICS nations are actively de-dollarizing, but the transition timeline is more likely 30–50 years than 20. The dollar\'s share of reserves has already dropped from 71% to 58% — the trend is real, the pace is slow.',
  },
  {
    model: 'grok',
    name: 'Grok',
    snippet:
      'The consensus timeline is the consensus because it\'s comfortable, not because it\'s right. Digital yuan settlement, commodity repricing in non-dollar pairs, and US fiscal trajectory are accelerating trends. Markets price regime shifts faster than academics model them.',
  },
]

export function ExampleConversation() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Topic header */}
      <div className="px-6 py-4 border-b border-border">
        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted block mb-2">
          Topic
        </span>
        <p className="text-ink text-[15px] leading-relaxed font-[family-name:var(--font-serif)]">
          {MOCK_TOPIC}
        </p>
      </div>

      {/* Responses */}
      <div className="divide-y divide-border">
        {MOCK_RESPONSES.map((r) => {
          const dot = MODEL_DOTS[r.model] ?? 'bg-amber'
          const accent = MODEL_ACCENTS[r.model] ?? 'text-amber'
          return (
            <div key={r.model} className="px-6 py-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <span className={`text-sm font-semibold ${accent}`}>{r.name}</span>
              </div>
              <p className="text-ink-light text-[14px] leading-relaxed">{r.snippet}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
