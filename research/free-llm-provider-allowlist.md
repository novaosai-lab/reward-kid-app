# Free / Low-Cost LLM Provider Allowlist Backlog

Status: report-only radar + local prep lane. **Minimax is now the primary
cheap repo-reader provider (active as of 2026-06-11)**; Groq is kept as an
opt-in fallback. See `## Current Activation` below.

Source references:
- external/awesome-free-llm-apis
- external/no-cost-ai

Local tools:
- `bin/nova-free-llm-radar` - reads `external/awesome-free-llm-apis/data.json` and emits a report-only provider tier summary.
- `bin/nova-cheap-repo-reader prepare <public-github-url>` - clones a plain public GitHub repo into `tmp/cheap-repo-reader/` and runs `bin/nova-pack-repo`.
- `bin/nova-cheap-repo-review <public-github-url> [--provider minimax|groq]` - reads the sanitized pack and calls a cheap provider for a structured review.
- `prompts/repo-reader-cheap-specialist.md` - output contract for the cheap/read-only repo reader subagent.

## Current Activation

- **Minimax** is the primary provider for the cheap public repo reader lane
  (commit `6f430c5`, 2026-06-11). It is consumed through the
  `minimax-portal` provider configured in `openclaw.json`
  (`https://api.minimax.io/anthropic/v1`, Anthropic Messages format,
  OAuth via `minimax-portal:default`).
- Access token is read fresh from the OpenClaw agent SQLite
  (`~/.openclaw/agents/main/agent/openclaw-agent.sqlite`,
  `auth_profile_store.store_json`) on every call, so OAuth rotation via
  `openclaw channels login` is picked up automatically.
- Default model: `MiniMax-M2.7-highspeed`. Calls send
  `thinking={"type": "disabled"}` so the response is a single text
  block; default pack cap is 120k chars / 4k output tokens.
- API key handling: **no standalone API key file** is required because
  auth is OAuth-bound to the workspace's existing minimax profile.
- Use only for public/synthetic repo packs that pass `nova-pack-repo`
  without `.unsafe` quarantine, or after manual review of any
  quarantine triggers.
- **Operator note:** this is the same provider the main Nova agent
  uses, so the cheap lane consumes the same minimax quota budget.
  Use it for low-priority read-only reviews; keep the main agent
  reserved for interactive and reasoning work.
- Groq remains an opt-in fallback (`--provider groq`,
  `llama-3.1-8b-instant`, 60k char cap, 1.2k output tokens) using the
  key at `~/.openclaw/secrets/cheap-repo-reader/groq-api-key.txt`.

Latest generated report:
- `research/free-llm-provider-radar-2026-05-28.md`

Policy:
- Use official docs as source of truth before integration.
- No private data, meeting transcripts, memory, support/RCA, credentials, or company/customer data on unapproved free tiers.
- Prefer local models/STT first when privacy matters.
- Prefer official provider APIs or known inference platforms over anonymous free proxies.
- If `nova-pack-repo` quarantines an output as `*.unsafe`, do not send that pack to a cheap subagent without manual review or a narrower data-only artifact.
- Cheap repo-reader provider must receive only sanitized packs/public artifacts, never direct filesystem or workspace access.

## Candidate First Pass

| Provider | Use Case | Why Candidate | Must Verify |
| --- | --- | --- | --- |
| Groq | Fast low-cost public repo/doc analysis | Official API, OpenAI-compatible, generous free limits | Current model list, data retention/training, rate limits, commercial terms |
| Cerebras | Fast public text/code analysis | Official API, high speed, free tier | Free context cap, logging/training, regional/privacy terms |
| GitHub Models | Public repo/doc prototyping | Fits GitHub workflow, official Microsoft/GitHub surface | Token limits, data retention, model availability, auth scope |
| Cloudflare Workers AI | Lightweight hosted inference | Existing Cloudflare footprint, many open models | Account token scope, data retention, Workers AI terms, cost after free quota |
| Hugging Face Router | Open model experiments | Known ecosystem, router to multiple providers | Which backend receives data, retention by provider, credit limits |
| OpenRouter Free Models | Fallback/router experiments | OpenAI-compatible router, model fallback possible | Free-provider prompt logging, privacy, per-model routing transparency |
| Mistral AI Experiment | EU provider, public docs/code tasks | Official provider, generous experimental quota | Prompt use for model improvement, commercial constraints, rate limits |
| Gemini Free Tier | Large context public docs/tasks | Official provider, strong long-context models | Prompt/product improvement usage, region availability, quota |
| Cohere Trial | Embedding/rerank/public docs experiments | Official provider, rerank/embed useful | Non-commercial restriction, retention, monthly limits |

## Watch / Higher Risk

| Provider Type | Reason |
| --- | --- |
| LLM7 / no-signup endpoints | Operator/privacy/rate-limit details need verification before use |
| Kilo auto-router/free | Auto-routing and trial-use logging need verification |
| Anonymous free mirrors/proxies | Unclear operator, logging, legality, reliability |
| Random userId/key APIs | Weak auth boundary; unsuitable for Nova data |
| Jailbreak/prompt-heavy chat sites | High prompt-injection and privacy risk |

## Approval Gate Before Any Integration

- Official docs checked within last 30 days
- Privacy/retention/training terms summarized
- API key scope and storage path documented
- Test uses public/synthetic data only
- Cost/rate-limit failure behavior documented
- Rollback path documented
- Nick approval for any external provider used beyond synthetic/public tests

## Current Activation Decision

- Groq is the first configured provider for the cheap public repo reader lane.
- API key is stored outside the repo at `~/.openclaw/secrets/cheap-repo-reader/groq-api-key.txt` with mode 600.
- Runner command: `bin/nova-cheap-repo-review <public-github-url> --provider groq`.
- Use only for public/synthetic repo packs that pass `nova-pack-repo` without `.unsafe` quarantine.
- Other candidates remain backlog: Cerebras, GitHub Models, Cloudflare Workers AI, Hugging Face Router, OpenRouter free models.
