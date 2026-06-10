# Cheap Repo Review

- URL: https://github.com/mvanhorn/last30days-skill
- Provider: minimax
- Model: MiniMax-M2.7-highspeed
- Pack: /Users/nova/.openclaw/workspace/research/repo-packs/cheap-mvanhorn-last30days-skill-20260611-003805.md
- Pack truncated: False
- Max pack chars: 100000
- Max output tokens: 3500

- Include: skills/last30days/scripts/lib/planner.py,skills/last30days/scripts/lib/query.py,skills/last30days/scripts/lib/signals.py,skills/last30days/scripts/lib/relevance.py,skills/last30days/scripts/lib/rerank.py
- Extra ignore: 

---

## Verdict: **adapt**

## What It Is

- A **multi-source search pipeline library** for query planning, relevance scoring, and LLM-based reranking
- Provides deterministic fallback logic when LLM planning is unavailable, with configurable intent classifiers (breaking_news, concept, how_to, comparison, prediction, etc.)
- Implements token-overlap relevance scoring with synonym expansion, phrase bonuses, and stopword filtering
- Includes engagement signal normalization (Reddit, YouTube, TikTok, Instagram) and source-quality weighting
- Targets social/news aggregation use cases across Reddit, X, TikTok, YouTube, Instagram, Bluesky, and reference sources

## Useful Patterns For Nova

1. **Intent-modifier stripping** — Strips query suffixes like "use cases", "workflows", "examples" before search to broaden retrieval instead of near-literal matching. (`planner.py:_INTENT_MODIFIER_PATTERNS`)

2. **Entity-grounding demotion** — Penalizes candidates that don't mention the primary topic entity in any text surface (title, snippet, transcript, comments). Prevents off-topic viral content from ranking high. (`rerank.py:ENTITY_MISS_PENALTY`, `_candidate_haystack`)

3. **Prepared query caching** — `PreparedQuery` class precomputes token sets and normalized phrases once, reused across N scoring operations. (`relevance.py:PreparedQuery`)

4. **Engagement floor with sole-source bypass** — TikTok/Instagram items below 1000 views are pruned unless they're the only source represented, preventing empty results for niche queries. (`signals.py:_passes_engagement_floor`)

5. **Recency-mode routing** — Intent-based freshness defaults (evergreen_ok for concept, strict_recent for breaking_news, etc.) applied before search rather than post-hoc. (`planner.py:_default_freshness`)

## Risks

| Category | Detail |
|----------|--------|
| **Supply-chain** | No external dependencies visible in this slice; uses only `re`, `re.compile()`, `frozenset`, `dict` — standard library only |
| **Auth** | None — read-only scoring pipeline, no credentials referenced |
| **Telemetry** | No external calls except `provider.generate_json()` for LLM reranking; no analytics or event emission |
| **ToS** | LLM reranking (`provider.generate_json`) could hit any configured endpoint — verify the provider's terms before production use |
| **Runtime** | Deterministic fallback is intentionally weaker; repeated fallback-only paths may produce poor results on complex topics |
| **Maintenance** | Intent-classifier heuristics (`_infer_intent`, `_should_force_deterministic_plan`) are brittle to phrasing changes; documented failures from 2026-04-19 suggest active churn |

## Integration Recommendation

**Candidate for adaptation** — This is a well-structured, production-tested search pipeline component with clean separation of concerns (planning → retrieval → scoring → reranking).

**Guardrails for Nova integration:**
- Verify the LLM reranking provider has acceptable ToS before enabling `--rerank` path in production
- The deterministic fallback path (no `--plan` provided) is explicitly documented as weaker — Nova should prefer passing structured plans
- Source priority tables (`SOURCE_PRIORITY`, `QUICK_SOURCE_PRIORITY`) are hardcoded; verify they match current platform health for any production deployment

## Evidence

| File | Key Evidence |
|------|--------------|
| `planner.py` | `_infer_intent`, `_should_force_deterministic_plan`, `_INTENT_MODIFIER_PATTERNS`, `SOURCE_PRIORITY`, `INTENT_SOURCE_EXCLUSIONS` |
| `query.py` | `extract_core_subject`, `extract_compound_terms`, `NOISE_WORDS` (frozenset with ~100+ stopwords) |
| `relevance.py` | `PreparedQuery` class with `__slots__`, `token_overlap_relevance`, `SYNONYMS` dict, `LOW_SIGNAL_QUERY_TOKENS` |
| `rerank.py** | `ENTITY_MISS_PENALTY = 25.0`, `_candidate_haystack` (expanded 2026-04-19 to include transcripts/comments), `UNTRUSTED_CONTENT_NOTICE` |
| `signals.py` | `ENGAGEMENT_WEIGHTS` per-source, `normalize` (min-max), `_VIDEO_ENGAGEMENT_FLOOR_VIEWS = 1000`, `SOURCE_QUALITY` dict |
