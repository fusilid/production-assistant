# Production Issue Resolution Assistant

AI-assisted decision support for manufacturing shift managers overseeing multiple production lines. See [CLAUDE.md](CLAUDE.md) for the full architecture spec, data model, and extension guide.

## Running locally

```bash
# 1. Install dependencies
npm install

# 2. Set your Anthropic API key
cp .env.example .env.local
# Edit .env.local — set ANTHROPIC_API_KEY=sk-ant-...

# 3. Start the dev server
npm run dev
# Open http://localhost:3000

# 4. Run safety classifier unit tests
npm test

# 5. Run the eval script (requires API key; writes snapshots to eval-snapshots/)
npm run eval
```

The app runs all LLM calls server-side — no API key is sent to the browser. Default model: `claude-sonnet-4-5`.
