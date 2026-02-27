# Conversation With AI

Moderate a roundtable discussion between frontier AI models. Type a topic, get it augmented with an analytical framework, then watch 4 AI models discuss it in two rounds.

## Features

- Automatic prompt augmentation with topic classification
- 4 frontier models: Claude, GPT-4, Gemini, Grok
- Two-round discussion (initial responses + reactions)
- Real-time SSE streaming
- Export to Markdown, plain text, or X thread format
- SQLite persistence for conversation history

## Setup

1. Clone and install:
   ```bash
   npm install
   ```

2. Create `.env.local` with your API keys:
   ```
   ANTHROPIC_API_KEY=...
   OPENAI_API_KEY=...
   GOOGLE_GENERATIVE_AI_API_KEY=...
   XAI_API_KEY=...
   ```

3. Run:
   ```bash
   npm run dev
   ```

4. Visit http://localhost:3000

## Tech Stack

Next.js 15, TypeScript, Tailwind CSS, Drizzle ORM, SQLite, Vercel AI SDK

## Tests

```bash
npm test        # watch mode
npm run test:run # single run
```

5 test suites, 17 tests covering schema, models, augmenter, orchestrator, and exports.
