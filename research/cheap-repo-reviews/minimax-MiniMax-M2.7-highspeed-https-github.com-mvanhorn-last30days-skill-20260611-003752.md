# Cheap Repo Review

- URL: https://github.com/mvanhorn/last30days-skill
- Provider: minimax
- Model: MiniMax-M2.7-highspeed
- Pack: /Users/nova/.openclaw/workspace/research/repo-packs/cheap-mvanhorn-last30days-skill-20260611-003720.md
- Pack truncated: False
- Max pack chars: 100000
- Max output tokens: 3500

- Include: skills/last30days/scripts/lib/pipeline.py,skills/last30days/scripts/lib/fanout.py,skills/last30days/scripts/lib/fusion.py,skills/last30days/scripts/lib/schema.py,skills/last30days/scripts/lib/providers.py
- Extra ignore: 

---

## Verdict: **adapt**

## What It Is

- **Topic intelligence pipeline** (v3.0.0) that aggregates multi-source content into ranked "last 30 days" reports
- **Multi-provider architecture**: Gemini, OpenAI, xAI, OpenRouter with configurable routing (`providers.py`)
- **Fusion & ranking engine**: Weighted RRF (`fusion.py`) + LLM reranking + per-author diversity caps + source-reservation buckets
- **Fan-out competitor mode**: Parallel `ThreadPoolExecutor` runs for main + peer entities (`fanout.py`)
- **Schema layer**: Structured data model (`schema.py`) for candidates, clusters, reports, retrieval bundles

## Useful Patterns For Nova

- **RRF fusion with source weights**: `weight * (RRF_K + rank)^-1` scoring with per-subquery weights and source weighting multipliers (`fusion.py:weighted_rrf`)
- **Per-author diversity cap**: `_MAX_ITEMS_PER_AUTHOR = 3` prevents single-source domination; iterates in relevance order
- **Source reservation bucket**: `_DIVERSITY_RELEVANCE_THRESHOLD = 0.25` reserves slots for qualifying sources before truncation
- **Parallel fan-out with graceful degradation**: ThreadPoolExecutor with `MAX_PARALLEL_SUBRUNS = 6`; main+≥1 competitor surviving is sufficient
- **Rate-limit propagation**: Thread-safe `rate_limited_sources` set shared across futures to skip redundant fetches
- **Plan-source annotation**: "fallback-plan" vs "deterministic" vs "llm" tags allow renderers to emit DEGRADED RUN banners

## Risks

| Category | Detail |
|----------|--------|
| **Supply chain** | Depends on external LLM providers (Gemini, OpenAI, xAI) — provider availability and pricing are not guaranteed |
| **Privacy** | Queries sent to third-party APIs (Google, OpenAI, xAI, OpenRouter) — user topics are externalized |
| **Telemetry** | No explicit logging controls visible; stderr trace emitted always-on for planner |
| **Runtime** | GitHub token resolution via CLI subprocess (`github.resolve_token`) with 5s timeout; rate limiting may cause partial failures |
| **Maintenance** | Source aliases (`SEARCH_ALIAS`) and provider URLs are hardcoded — future API changes require code updates |
| **Auth** | Multiple API keys needed (`GOOGLE_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `SCRAPECREATORS_API_KEY`) |

## Integration Recommendation

**Lane**: This is internal workspace tooling (Nova/OpenClaw skill), not a standalone product.

**If extracting for reuse**:
1. ✅ Adopt the RRF fusion and per-author cap patterns for multi-source ranking
2. ✅ Use the provider abstraction to swap LLM backends
3. ✅ Reference `schema.py` for structured report/candidate data models
4. ⚠️ Verify privacy terms for each provider before processing sensitive topics
5. ⚠️ Implement explicit topic-scrubbing if running on user-provided queries

**Guardrails applied**: No secrets in pack; API keys externalized via `config.get()`; no install scripts present.

## Evidence

- `schema.py`: `Report`, `Candidate`, `Cluster`, `RetrievalBundle` dataclasses define pipeline contracts
- `fusion.py:RRF_K = 60`, `_DIVERSITY_RELEVANCE_THRESHOLD = 0.25`, `_MAX_ITEMS_PER_AUTHOR = 3`
- `pipeline.py:MAX_PARALLEL_SUBRUNS` (implied by `workers = min(...)` in `fanout.py`)
- `providers.py`: `GEMINI_URL`, `OPENAI_RESPONSES_URL`, `CODEX_RESPONSES_URL`, `XAI_RESPONSES_URL`, `OPENROUTER_URL`
