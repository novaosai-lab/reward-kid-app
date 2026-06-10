# Cheap Repo Review

- URL: https://github.com/mvanhorn/last30days-skill
- Provider: minimax
- Model: MiniMax-M2.7-highspeed
- Pack: /Users/nova/.openclaw/workspace/research/repo-packs/cheap-mvanhorn-last30days-skill-20260611-003640.md
- Pack truncated: True
- Max pack chars: 100000
- Max output tokens: 3500

- Include: AGENTS.md,CONCEPTS.md,skills/last30days/SKILL.md
- Extra ignore: 

---

# Repo Review: last30days-skill

## 1. Verdict
**adapt**

## 2. What It Is
- OpenClaw/Claude Code skill for multi-platform social research (Reddit, X, YouTube, TikTok, HN, Polymarket, Bluesky, etc.)
- MIT-licensed public GitHub repo (github.com/mvanhorn/last30days-skill)
- Python engine (`scripts/last30days.py`) with structured agent workflow; v3.3.2 with extensive output contracts and formatting laws
- Optional API keys for platform access (X tokens, Bluesky passwords, ScrapeCreators, Brave/Exa/Serper for web search)

## 3. Useful Patterns For Nova
- **Structured agent output contracts**: The LAWs (1-8) enforcement pattern with mandatory badge, pass-through footer, and self-check gates is a strong template for multi-agent skill authoring
- **Query plan architecture**: Separation of pre-research resolution (Step 0.55) from query planning (Step 0.75) to a reasoning model vs. deterministic engine execution
- **Cluster-first synthesis**: v3 returns story clusters across platforms rather than source-by-source dumps
- **Platform-specific targeting**: Resolving X handles, Reddit subs, GitHub repos, TikTok hashtags per-entity before search execution
- **Category peer expansion**: Adding cross-product subreddits for AI tool topics (e.g., adding r/StableDiffusion for image-gen tools)

## 4. Risks
- **Privacy**: Optional auth tokens (X AUTH_TOKEN/CT0, Bluesky app passwords) stored in env vars - not in repo. Research outputs saved to `~/Documents/Last30Days` by default
- **Supply-chain**: Python skill with dependencies on yt-dlp, platform APIs. No bundled binaries in this pack
- **Auth**: Uses optional API keys for 8+ platforms. No auth required if user configures none - engine degrades gracefully
- **Telemetry**: Not observed in pack. MIT license, no apparent telemetry calls
- **ToS**: Depends on user's compliance with X, Reddit, YouTube, TikTok platform terms. Public-data-only research
- **Runtime**: Python 3.12+ required. 1-3 minute typical runtime with 5-minute timeout

## 5. Integration Recommendation
This is a well-structured research skill. To integrate:

1. **For Claude Code/OpenClaw agents**: Install as a skill/plugin. Requires `node` and `python3.12+` in runtime environment
2. **API key requirements**: At minimum, requires no keys for basic Reddit/HN/Polymarket search. Full functionality needs platform-specific keys
3. **Read the SKILL.md fully** - the 8 LAWs and output contract sections are the core value; the Python engine enforces them
4. **Guardrail**: Do not run on private/unauthenticated topics without clarifying that research hits public platforms

## 6. Evidence
- `skills/last30days/SKILL.md` - Full skill contract with version `3.3.2`, author `mvanhorn`, MIT license
- Frontmatter declares `allowed-tools: Bash, Read, Write, AskUserQuestion, WebSearch` and `primaryEnv: SCRAPECREATORS_API_KEY`
- `AGENTS.md` and `CONCEPTS.md` are empty/minimal in this pack (expected - they are documentation files, not skill logic)
- Step 0 STALE-CLONE SELF-CHECK addresses Claude Code marketplace cache issue - confirms active maintenance
