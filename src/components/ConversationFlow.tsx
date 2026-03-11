import { MODEL_DOTS, MODEL_ACCENTS } from '@/lib/model-colors'
import { ScrollFadeIn } from '@/components/ScrollFadeIn'
import { SharpenPromptDemo } from '@/components/SharpenPromptDemo'

const MODELS = [
  { key: 'claude', name: 'Claude', meta: 'anthropic / claude-opus-4-6' },
  { key: 'gpt', name: 'GPT', meta: 'openai / gpt-5.4' },
  { key: 'gemini', name: 'Gemini', meta: 'google / gemini-3.1-pro-preview' },
  { key: 'grok', name: 'Grok', meta: 'xai / grok-4-1-fast-reasoning' },
]

const ROUND_ONE_SNIPPETS: Record<string, string> = {
  claude:
    'The dollar\'s reserve status rests on deep structural advantages — network effects in trade invoicing, the depth of US Treasury markets, and the absence of a credible alternative. Gradual erosion is plausible, but full displacement within 20 years requires a coordination event that no rival currency can yet trigger.',
  gpt:
    'History offers a template: sterling\'s decline took roughly 30 years after Bretton Woods shifted the center of gravity. The dollar\'s share of reserves has already dropped from 71% to 58% — the trend is real, the pace is slow.',
  gemini:
    'Central bank diversification is measurable but gradual. No alternative currency currently offers the liquidity depth or institutional trust required for reserve status. The euro comes closest but carries its own structural risks.',
  grok:
    'The consensus timeline is the consensus because it\'s comfortable, not because it\'s right. Digital yuan settlement, commodity repricing in non-dollar pairs, and US fiscal trajectory are accelerating trends.',
}

const ROUND_TWO_REACTIONS: {
  model: string
  heading: string
  subheading: string
  body: string
}[] = [
  {
    model: 'claude',
    heading: 'Reaction to the Other Models',
    subheading: 'Where GPT Was Strongest',
    body: 'GPT\'s response was the most methodologically rigorous of the group, and it introduced one argument I underweighted significantly: the stablecoin point. If cross-border payments migrate onto new digital rails but remain dollar-denominated, technology could reinforce rather than erode dollar dominance.',
  },
  {
    model: 'gpt',
    heading: 'Cross-Model Assessment',
    subheading: 'Where Grok Pushes Too Far',
    body: 'Grok\'s framing is provocative but conflates speed of change with direction of change. Digital yuan settlement volumes are growing, yes — but from a trivial base. Claude\'s structural argument about network effects deserves more weight than Grok gives it.',
  },
  {
    model: 'gemini',
    heading: 'Points of Agreement and Divergence',
    subheading: 'Claude\'s Structural Argument Holds',
    body: 'I agree with Claude that network effects in trade invoicing are the most durable advantage. But I think all three of us underweighted the political dimension — Grok is right that fiscal trajectory matters, even if the timeline is wrong.',
  },
  {
    model: 'grok',
    heading: 'Where the Others Get Comfortable',
    subheading: 'The Consensus Is the Problem',
    body: 'Claude, GPT, and Gemini all converged on "gradual erosion, not displacement." When three independent models reach the same conclusion, that\'s either overdetermined by evidence — or overdetermined by training data. I\'d bet on the latter.',
  },
]

function Connector() {
  return (
    <div className="flex justify-center py-3">
      <div className="w-px h-8 bg-border" />
    </div>
  )
}

function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-muted whitespace-nowrap">
        {children}
      </span>
      <div className="h-px bg-border flex-1" />
    </div>
  )
}

export function ConversationFlow() {
  return (
    <div>
      {/* Step 1: You ask */}
      <ScrollFadeIn>
        <SectionRule>You ask</SectionRule>
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <p className="text-ink text-[15px] leading-relaxed">
            Will the US dollar lose its reserve currency status within 20 years?
          </p>
          <span className="text-ink-muted text-[12px] block mt-2">Press enter to submit</span>
        </div>
      </ScrollFadeIn>

      <Connector />

      {/* Step 2: AI sharpens the prompt (interactive) */}
      <ScrollFadeIn>
        <SectionRule>AI sharpens the prompt</SectionRule>
        <SharpenPromptDemo />
      </ScrollFadeIn>

      <Connector />

      {/* Step 3: Round 1 — Model responses (Claude expanded, others collapsed) */}
      <ScrollFadeIn>
        <SectionRule>Round 1 — Initial responses</SectionRule>
        <div className="space-y-3">
          {/* Claude — expanded */}
          <div className="bg-card border border-border rounded-xl px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2.5 h-2.5 rounded-full ${MODEL_DOTS.claude}`} />
              <span className={`text-sm font-semibold ${MODEL_ACCENTS.claude}`}>Claude</span>
              <span className="text-ink-muted text-[12px]">anthropic / claude-opus-4-6</span>
              <span className="text-ink-muted text-[12px] ml-auto">~1,200 words</span>
            </div>
            <div className="font-semibold text-ink text-[15px] mb-2">The Case Against Displacement</div>
            <p className="text-ink-light text-[13px] leading-relaxed mb-3">
              The dollar's reserve status rests on deep structural advantages — network effects in trade invoicing, the depth of US Treasury markets, and the absence of a credible alternative. Gradual erosion is plausible, but full displacement within 20 years requires a coordination event that no rival currency can yet trigger.
            </p>
            <div className="font-semibold text-ink text-[14px] mb-2">Why Network Effects Are Durable</div>
            <p className="text-ink-light text-[13px] leading-relaxed mb-3">
              Roughly 88% of foreign exchange transactions involve the dollar on one side. This isn't inertia — it's a coordination equilibrium. Switching costs are enormous: every bank, every settlement system, every trade contract would need to shift simultaneously...
            </p>
            <div className="border-t border-border pt-3 mt-1">
              <p className="text-ink-muted text-[12px] italic">
                continues with sections on Treasury market depth, BRICS limitations, and scenario analysis...
              </p>
            </div>
          </div>

          {/* Other models — collapsed */}
          {MODELS.filter((m) => m.key !== 'claude').map((m) => {
            const dot = MODEL_DOTS[m.key] ?? 'bg-amber'
            const accent = MODEL_ACCENTS[m.key] ?? 'text-amber'
            return (
              <div key={m.key} className="bg-card border border-border rounded-xl px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  <span className={`text-sm font-semibold ${accent}`}>{m.name}</span>
                  <span className="text-ink-muted text-[12px]">{m.meta}</span>
                  <span className="text-ink-muted text-[12px] ml-auto">~1,200 words</span>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollFadeIn>

      <Connector />

      {/* Step 4: Round 2 — Reactions (Grok expanded, others collapsed) */}
      <ScrollFadeIn>
        <SectionRule>Round 2 — Reactions</SectionRule>
        <div className="space-y-3">
          {/* Other models — collapsed (before Grok) */}
          {MODELS.filter((m) => m.key !== 'grok').map((m) => {
            const dot = MODEL_DOTS[m.key] ?? 'bg-amber'
            const accent = MODEL_ACCENTS[m.key] ?? 'text-amber'
            return (
              <div key={m.key} className="bg-card border border-border rounded-xl px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                  <span className={`text-sm font-semibold ${accent}`}>{m.name}</span>
                  <span className="text-ink-muted text-[12px]">{m.meta}</span>
                  <span className="text-ink-muted text-[12px] ml-auto">~800 words</span>
                </div>
              </div>
            )
          })}

          {/* Grok — expanded */}
          <div className="bg-card border border-border rounded-xl px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2.5 h-2.5 rounded-full ${MODEL_DOTS.grok}`} />
              <span className={`text-sm font-semibold ${MODEL_ACCENTS.grok}`}>Grok</span>
              <span className="text-ink-muted text-[12px]">xai / grok-4-1-fast-reasoning</span>
              <span className="text-ink-muted text-[12px] ml-auto">~800 words</span>
            </div>
            <div className="font-semibold text-ink text-[15px] mb-1">Where the Others Get Comfortable</div>
            <div className="font-semibold text-ink text-[14px] mb-2">The Consensus Is the Problem</div>
            <p className="text-ink-light text-[13px] leading-relaxed mb-3">
              Claude, GPT, and Gemini all converged on <span className="font-semibold text-ink">"gradual erosion, not displacement."</span> When three independent models reach the same conclusion, that's either overdetermined by evidence — or overdetermined by training data. I'd bet on the latter.
            </p>
            <div className="font-semibold text-ink text-[14px] mb-2">What Claude Misses About Network Effects</div>
            <p className="text-ink-light text-[13px] leading-relaxed mb-3">
              Claude treats network effects as static — 88% of FX transactions involve the dollar <em>today</em>. But network effects cut both ways. The same coordination dynamics that entrench the dollar can accelerate its exit once a tipping point hits. Sterling didn't decline linearly...
            </p>
            <div className="border-t border-border pt-3 mt-1">
              <p className="text-ink-muted text-[12px] italic">
                continues with critiques of GPT's historical framing and Gemini's liquidity argument...
              </p>
            </div>
          </div>
        </div>
      </ScrollFadeIn>
    </div>
  )
}
