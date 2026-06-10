# last30days-skill Deep Dive — 2026-06-11

Nick requested another read of `mvanhorn/last30days-skill` before bed. Nova ran
4 minimax-driven passes (provider: `MiniMax-M2.7-highspeed`, 120k char pack
cap). All packs sanitised; no `.unsafe` triggers were real secrets. Individual
review files:

| Pass | Focus | File |
|------|-------|------|
| 1 | Design intent + SKILL contract | `research/cheap-repo-reviews/minimax-MiniMax-M2.7-highspeed-https-github.com-mvanhorn-last30days-skill-20260611-003707.md` |
| 2 | Architecture (pipeline/fanout/fusion/schema/providers) | `…-20260611-003752.md` |
| 3 | Decision logic (planner/query/signals/relevance/rerank) | `…-20260611-003828.md` |
| 4 | Main CLI + store + briefing + watchlist | `…-20260611-003922.md` |

## TL;DR

**Verdict: adapt — selective pattern harvesting, do not import whole skill.**

The skill is mature (v3.3.2, 1709-line SKILL.md, ~60 lib modules, MIT
license, 8 LAWs output contract). Its real value is the *patterns*, not
the engine itself. Below is a curated list of what Nova should borrow,
what to skip, and the risks if anyone copies this without reading.

---

## 1. What it is (one paragraph)

An Agent Skills package (`SKILL.md` prose + Python engine in
`scripts/last30days.py`) for "research what people are saying about X in
the last 30 days" across Reddit, X, YouTube, TikTok, HackerNews, Polymarket,
Bluesky, TruthSocial, GitHub, and the web. The slash command
`/last30days <topic>` (or direct CLI as fallback) returns a cluster-first
report with signal-weighted rankings, not source-by-source dumps. v3.3.2
ships a deterministic fallback path for when LLM planning is unavailable.

## 2. Architecture overview

```
SKILL.md  ←  the model reads this; it tells the model which flags to pass
  ↓
last30days.py  ←  main entry, 1036 lines
  ↓
planner.py     ←  intent inference (breaking_news / concept / how_to / …),
                  optional LLM JSON plan, deterministic fallback
  ↓
fanout.py      ←  ThreadPoolExecutor, MAX_PARALLEL_SUBRUNS, graceful degrade
  ↓
providers.py   ←  Gemini, OpenAI, xAI, OpenRouter, Codex endpoints
  ↓
[per-platform modules: reddit, bird_x, youtube_yt, tiktok, hackernews,
  polymarket, github, bluesky, truthsocial, perplexity, …]
  ↓
fusion.py      ←  weighted RRF, per-author diversity cap, source reservation
  ↓
relevance.py   ←  token overlap + synonym expansion
  ↓
rerank.py      ←  LLM reranking, entity-grounding demotion
  ↓
signals.py     ←  engagement normalisation, source quality weighting
  ↓
schema.py      ←  Report / Candidate / Cluster / RetrievalBundle dataclasses
  ↓
store.py       ←  SQLite WAL + FTS5, URL dedup, run-to-run delta
  ↓
briefing.py    ←  daily/weekly digests, staleness > 36h
  ↓
watchlist.py   ←  cron + webhooks
```

Three design choices stand out:

- **Engine vs Skill separation**: SKILL.md is the agent-facing surface
  (what the model passes, what the model must pass through). Engine
  enforces the LAWs. Slash-command UX is primary; direct CLI is fallback.
- **Plan-source annotation**: queries are tagged `deterministic` /
  `llm` / `fallback-plan` so renderers can emit `DEGRADED RUN` banners.
- **Multi-harness portability**: the package conforms to the Agent Skills
  open format, installs across Claude Code / Codex / Cursor / Copilot /
  Gemini CLI / OpenClaw via `npx skills add`.

## 3. Patterns worth adapting for Nova

### Output contract (high value)
- **8 LAWs output format** in SKILL.md: mandatory first-line badge, no
  `##` headers, no em-dash, no `Sources:` block at end, inline links,
  bold-lead-in paragraph, pass-through footer. Worth lifting as a
  *template* for Nova's research-style outputs.
- **Pass-through footer** means the engine produces text the model is
  contractually required to render unchanged. Strong pattern for keeping
  fact-bearing prose intact.

### Pipeline patterns (medium value, requires review)
- **Weighted RRF fusion** (`fusion.py:weighted_rrf`): `weight * (RRF_K + rank)^-1`
  with `RRF_K=60` and per-subquery weights. RRF is well known; the
  *weighted* variant with source-quality multipliers is the interesting
  part.
- **Per-author diversity cap** (`_MAX_ITEMS_PER_AUTHOR = 3`): prevents
  one creator/poster from dominating the report. Iterates in relevance
  order. Easy to add to any ranked list.
- **Source reservation bucket** (`_DIVERSITY_RELEVANCE_THRESHOLD = 0.25`):
  reserves slots for qualifying sources before truncation, so the report
  doesn't collapse to a single platform.
- **Parallel fanout with graceful degradation** (`fanout.py`): main run
  + ≥1 competitor surviving is enough; rate-limit propagation via a
  shared `rate_limited_sources` set skips redundant fetches.
- **Subprocess isolation** (`watchlist.py:cmd_run_one` + `last30days.py:_child_pids`):
  each cron child gets isolated PID, SIGTERM cleanup on parent exit.

### Decision logic (medium-high value)
- **Intent-modifier stripping** (`planner.py:_INTENT_MODIFIER_PATTERNS`):
  strips suffixes like "use cases", "workflows", "examples" before
  search, so retrieval broadens instead of near-literal matching.
- **Entity-grounding demotion** (`rerank.py:ENTITY_MISS_PENALTY = 25.0`):
  candidates that don't mention the primary topic entity in title,
  snippet, transcript, or comments get a 25-point penalty. Prevents
  off-topic viral content from ranking high.
- **Prepared query caching** (`relevance.py:PreparedQuery` with `__slots__`):
  precomputes token sets and normalised phrases once, reused across
  N scoring operations. Good memory shape.
- **Engagement floor with sole-source bypass** (`signals.py:_VIDEO_ENGAGEMENT_FLOOR_VIEWS = 1000`):
  TikTok/Instagram items below 1000 views are pruned unless they're the
  only source. Prevents empty results on niche queries.
- **Recency-mode routing** (`planner.py:_default_freshness`):
  `evergreen_ok` for concept, `strict_recent` for breaking_news, etc.
  Applied before search, not post-hoc.

### Storage patterns (medium value)
- **SQLite WAL + FTS5** (`store.py`): `~/.local/share/last30days/research.db`,
  `findings_fts` with `tokenize="porter unicode61"`, BM25-ranked.
  **Pattern is reusable** for any Nova "long-term memory of fetched
  content" use case (already partly replicated in nova-ops-dashboard
  Support Digest cache).
- **URL dedup with engagement bump** (`store_findings`): re-sighting a
  URL updates `engagement_score`; enables trend detection without
  duplicating rows.
- **Run-to-run delta** (`compute_topic_delta`): classifies URLs as
  new / continued / dropped across consecutive runs. Useful for
  "what's new since last research" briefings.

### CLI / operational (low-medium value)
- **Stale-clone self-check** (SKILL.md Step 0): detect Claude Code
  marketplace cache staleness before reading SKILL.md. Worth borrowing
  for any skill with marketplace install.
- **Cost tracking** (`store.py:get_daily_cost`): per-day token cost
  aggregation; optional but easy to add to Nova's existing
  `/api/codex-quota` / `/api/gemma-quota` surface.
- **Competitor plan schema** (`last30days.py:parse_competitors_plan`):
  inline JSON or file path; validates known fields, warns on unknown.
  Good pattern for "structured input from the model" UX.

## 4. Patterns to NOT adapt

- **Multi-platform scraping (YouTube via yt-dlp, Reddit, TikTok,
  Instagram)**: Platform ToS risk. Even for personal use, cookie-import
  auth (`run_full_device_auth`) escalates the risk. Don't copy this
  for any Nova work involving company systems or shared accounts.
- **Browser-cookie import** for any platform: violates the principle
  of least privilege and the "don't exfiltrate private data" SOUL rule.
  Skip entirely.
- **Brittle intent-classifier heuristics** (`_infer_intent`,
  `_should_force_deterministic_plan`): documented failures from
  2026-04-19 suggest active churn. If we adopt intent routing, prefer
  LLM-based classification (Nova already has M2.7-highspeed for this)
  over regex.
- **Hardcoded provider URLs** in `providers.py` (GEMINI_URL, OPENAI_RESPONSES_URL,
  etc.): if a provider rotates endpoints, the skill breaks. For Nova,
  route through OpenClaw's model registry instead.
- **Per-harness install layout** paths: their install path
  (`~/.agents/skills/<name>/`) hardcoded in places. OpenClaw has its
  own path. Keep the package install-agnostic.

## 5. Risk register (if anyone copies the whole skill)

| Risk | Severity | Mitigation |
|------|----------|-----------|
| External LLM provider exposure (Google, OpenAI, xAI) | Medium | User topics externalised; add topic-scrub for sensitive queries |
| Optional auth tokens (X AUTH_TOKEN/CT0, Bluesky app passwords) in env | Medium | Externalise; never commit; document in .env.example |
| Active scraping of YouTube/Reddit/IG/TikTok | High (ToS) | Personal use only; no commercial deployment |
| Cookie import for auth | High | Skip; use API keys where possible |
| Data persistence (`~/.local/share/last30days/research.db`) | Low | Add retention/cleanup policy |
| Hardcoded provider URLs | Medium | Route through OpenClaw model registry |
| Python 3.12+ hard requirement | Low | Acceptable; we already run 3.12 |

## 6. Concrete picks for Nova (next sprint candidates)

1. **8-LAWs output contract** → template for Nova's "research digest"
   output surface (Telegram, email, briefings). Low risk, high signal.
2. **Entity-grounding demotion** → add to nova-ops-dashboard's
   `/api/support-digest` quality scoring (penalise candidates that
   don't mention the primary ticket/product entity).
3. **URL dedup with engagement bump** → reuse in
   `shopee-affiliate-automation` and `fund-research-assistant` for
   "what's trending on this URL" tracking.
4. **Run-to-run delta** → add to support digest briefing layer so
   each digest shows new vs continued URLs vs yesterday.
5. **Weighted RRF** → adopt if Nova ever builds a multi-source
   retrieval layer (not urgent; current single-source is fine).

## 7. How to try it (without committing)

```bash
# One-shot install into a scratch harness
npx skills add mvanhorn/last30days-skill -g
# Inside Claude Code or OpenClaw:
/last30days OpenClaw RCA tooling
# Direct CLI (dev/testing only, AGENTS.md is explicit about this)
python3 skills/last30days/scripts/last30days.py "OpenClaw RCA tooling" --emit=compact
```

Note: with no API keys, the engine degrades to public sources
(Reddit public, HN, GitHub, Polymarket, Bluesky public). X, YouTube,
TikTok, IG, TruthSocial require platform tokens. SCRAPECREATORS_API_KEY
is the primary optional env per the SKILL.md frontmatter.

## 8. References

- 4 individual review files at `research/cheap-repo-reviews/...last30days...-20260611-003{707,752,828,922}.md`
- First minimax review (`…-20260611-002110.md`) for the SKILL.md / 8 LAWs
  detail
- Groq shallow review (`…-20260611-000951.md`) for baseline comparison
- `research/cheap-repo-reviews/` index shows all runs

---

End of deep-dive. Saved 2026-06-11 00:42 +07 by Nova, while Nick sleeps.
