# Cheap Repo Review

- URL: https://github.com/mvanhorn/last30days-skill
- Provider: minimax
- Model: MiniMax-M2.7-highspeed
- Pack: /Users/nova/.openclaw/workspace/research/repo-packs/cheap-mvanhorn-last30days-skill-20260611-002044.md
- Pack truncated: True
- Max pack chars: 120000
- Max output tokens: 4000

- Include: README.md,skills/last30days/SKILL.md
- Extra ignore: 

---

## Verdict

**adapt** — mature, well-documented MIT-licensed skill with proven operational patterns and explicit regression history. No supply chain concerns; optional API keys are opt-in.

## What It Is

- Multi-source social research engine for AI agents — aggregates Reddit, X, YouTube, TikTok, Instagram, Hacker News, Polymarket, GitHub, Bluesky, and web into a unified 30-day snapshot
- Python CLI (`scripts/last30days.py`) with agent-facing JSON query plan contract and per-platform targeting flags (`--x-handle`, `--subreddits`, `--github-user`, etc.)
- Voice contract with 8 formatting LAWs governing output shape (no `##` headers, no em-dashes, no trailing Sources block, inline markdown citations)
- Extensive regression documentation (v3.0.6 through v3.3.2) with named failure modes, root causes, and fixes

## Useful Patterns For Nova

1. **Stale-clone self-check** — explicit check against `~/.claude/plugins/marketplaces/` before using cached SKILL.md; resolves a known auto-restore bug
2. **Output formatting LAWs as contract** — self-documenting enforcement rules prevent model drift into blog-post structure (em-dashes, section headers, invented titles)
3. **Query plan JSON schema** — structured subquery array with `search_query` / `ranking_query` / `sources` / `weight` fields passed via `--plan` flag to decouple planning from execution
4. **Category-peer expansion table** — known subreddits keyed by product category (`ai_image_generation`, `ai_coding_agent`, etc.) to avoid brand-only targeting
5. **Signal-weighted recommendations** — ranking by evidence type (practitioner testimony 5x, expert defection 4x, measurable claim 4x) rather than mention count

## Risks

- **Auth/telemetry**: Optional X/Twitter tokens (`AUTH_TOKEN`, `CT0`), Bluesky app passwords, TruthSocial tokens — all opt-in; skill works without them
- **API dependencies**: SCRAPECREATORS_API_KEY (TikTok/Instagram/Threads), OPENAI_API_KEY (optional internal planner), OPENROUTER_API_KEY — all optional
- **Data writes**: Saves raw research to `LAST30DAYS_MEMORY_DIR` (defaults `~/Documents/Last30Days`) — not a secret but local storage
- **Maintenance**: Active development (v3.3.2); regression history suggests frequent model-behavior-driven updates

## Integration Recommendation

This skill is a strong **adapt** candidate. The MIT license, explicit regression history, and structured contract make it suitable for Nova onboarding.

**Guardrails for Nova:**
- Treat as a research-only tool (no code generation, no deploys)
- Do not run `scripts/last30days.py` without the full `--plan` + targeting flags on named-entity topics
- Respect the 8 LAWs in output synthesis — they prevent model drift into generic blog format
- API keys remain operator-provided; skill should not request them

**Next step:** Extract the query plan JSON schema and category-peer expansion table into Nova memory for reuse in multi-source research patterns.

## Evidence

- `skills/last30days/SKILL.md` — full skill contract (1400+ lines), MIT license header, version `3.3.2`
- `## OUTPUT CONTRACT (BADGE + LAWS)` section — 8 formatting laws with named failure modes
- `## Step 0.75: Generate Query Plan` — JSON schema for structured subqueries
- `## Section 2a: Category-peer expansion` — canonical peer subreddits by product category
- `## VOICE CONTRACT LAW` block — enforcement anchors (badge, no `##`, no em-dashes, inline links)
- `metadata.openclaw.primaryEnv: SCRAPECREATORS_API_KEY` — primary optional dependency
- `metadata.openclaw.requires.bins: [node, python3]` — runtime requirements
