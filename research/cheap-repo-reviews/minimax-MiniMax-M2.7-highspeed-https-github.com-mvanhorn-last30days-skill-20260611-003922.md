# Cheap Repo Review

- URL: https://github.com/mvanhorn/last30days-skill
- Provider: minimax
- Model: MiniMax-M2.7-highspeed
- Pack: /Users/nova/.openclaw/workspace/research/repo-packs/cheap-mvanhorn-last30days-skill-20260611-003840.md
- Pack truncated: False
- Max pack chars: 100000
- Max output tokens: 3500

- Include: skills/last30days/scripts/last30days.py,skills/last30days/scripts/store.py,skills/last30days/scripts/briefing.py,skills/last30days/scripts/watchlist.py
- Extra ignore: 

---

## Verdict
**adapt** — solid OpenClaw agent skill with useful patterns; integrate with appropriate privacy guardrails.

---

## What It Is
- **OpenClaw skill** for automated topic research and long-term monitoring across social/web sources (YouTube, Reddit, GitHub, TikTok, Instagram, Polymarket, HN)
- **SQLite-backed** research accumulator (`~/.local/share/last30days/research.db`) with FTS5 full-text search and URL-based deduplication
- **CLI tools**: `last30days.py` (main research), `watchlist.py` (cron scheduling + webhooks), `briefing.py` (daily/weekly digests), `store.py` (DB queries)
- **Per-topic delta tracking** — compares latest run vs previous run to surface new/continued/dropped URLs
- **Competitor fanout** — multi-entity `vs-mode` with per-entity targeting and optional hosting-model pre-resolution via `--competitors-plan`

---

## Useful Patterns For Nova
| Pattern | File(s) | Description |
|---------|---------|-------------|
| **SQLite WAL + FTS5** | `store.py` | Safe concurrent access (cron + user), BM25-ranked full-text search |
| **URL dedup with engagement bump** | `store.py` (`store_findings`) | Re-sighting a URL updates its engagement score; enables trend detection |
| **Run-to-run delta** | `store.py` (`compute_topic_delta`) | Classifies URLs as new/continued/dropped across consecutive research runs |
| **Subprocess orchestration** | `watchlist.py` (`cmd_run_one`) | `subprocess.run([sys.executable, cli_path, ...])` — isolates child PID, sets run status |
| **Child PID tracking + cleanup** | `last30days.py` (`_child_pids`, `_cleanup_children`) | Thread-safe set of child PIDs; SIGTERM propagation on exit |
| **Competitor plan parsing** | `last30days.py` (`parse_competitors_plan`) | Accepts inline JSON or file path; validates schema, warns on unknown fields |
| **Staleness detection** | `briefing.py` (`generate_daily`) | `hours_ago > 36` threshold for topic freshness in briefings |
| **Configurable cost tracking** | `store.py` (`get_daily_cost`, `get_setting`) | WAL-mode SQLite, per-day token cost aggregation |

---

## Risks
| Category | Detail |
|----------|--------|
| **Supply chain** | Depends on external APIs: Brave Search (`BRAVE_API_KEY`), Serper (`SERPER_API_KEY`), Perplexity (`PERPLEXITY_API_KEY`). ToS/privacy of each must be verified individually. |
| **Auth/telemetry** | Browser-cookie import (`run_full_device_auth`) for YouTube/Reddit scraping; unclear if telemetry on token usage. |
| **Telemetry** | `LAST30DAYS_DEBUG` env var exists; no visible telemetry opt-out documented in this pack. |
| **Platform ToS** | Active scraping of YouTube (via yt-dlp), Reddit, Instagram, TikTok may violate platform ToS. Cookie-import for auth heightens this. |
| **Data persistence** | SQLite at `~/.local/share/last30days/` stores all findings indefinitely; `dismiss_finding` provides per-URL removal but no bulk purge. |
| **Runtime** | `MIN_PYTHON = (3, 12)` — narrow version requirement; `sys.executable` used in subprocess calls. |
| **Maintenance** | Complex fanout logic (`_competitor_runner`, `subrun_kwargs_for`) — long-term maintenance burden for entity targeting. |

---

## Integration Recommendation
**Proceed to Nova/Codex main review** with these guardrails:

1. **Verify API key privacy**: Confirm `BRAVE_API_KEY`/`SERPER_API_KEY`/`PERPLEXITY_API_KEY` are user-provided, not hardcoded or logged.
2. **Platform ToS review**: Check whether active YouTube/Reddit scraping is acceptable under the agent's operating context (personal use vs. commercial deployment).
3. **Cookie auth risk**: `run_full_device_auth` imports browser cookies — ensure this aligns with the agent's security policy.
4. **Data retention**: Add a cleanup mechanism or retention policy for the SQLite store if monitoring sensitive topics.
5. **Child process cleanup**: The `_cleanup_children` pattern is good; ensure SIGTERM is sufficient for the pipeline run's cleanup needs.

---

## Evidence
- **Storage path**: `store.py` — `DB_DIR = Path.home() / ".local" / "share" / "last30days"`; `DB_PATH = DB_DIR / "research.db"`
- **FTS5 + WAL**: `store.py` — `SCHEMA_V1` creates `findings_fts` with `tokenize="porter unicode61"`; `_connect()` enables WAL
- **Engagement dedup**: `store.py` — `store_findings` updates `engagement_score` on re-sighting; `_UPDATABLE_FINDING_COLUMNS` allows patching
- **Run delta**: `store.py` — `compute_topic_delta` computes `new_urls`, `dropped_urls`, `continued_urls` via `_sightings_by_url`
- **Subprocess isolation**: `watchlist.py` — `cmd_run_one` uses `subprocess.run([sys.executable, cli_path, ...])`; `last30days.py` tracks `_child_pids` with `register_child_pid`/`unregister_child_pid`
- **Competitor plan schema**: `last30days.py` — `known_fields = {"x_handle", "subreddits", "x_related", "github_user", "github_repos", "context"}`
- **Staleness**: `briefing.py` — `stale = hours_ago > 36`
- **Python requirement**: `last30days.py` — `MIN_PYTHON = (3, 12)`
