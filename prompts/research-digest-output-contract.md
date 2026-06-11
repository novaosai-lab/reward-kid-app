# Nova Research Digest — Output Contract v1.0 (8 LAWs)

> **Purpose:** A single, opinionated output contract for every "research digest" or
> "synthesis brief" Nova produces or sends on Nick's behalf (Telegram, email,
> dashboard cards, repo-review summaries, support digests, BTC daily check,
> fund brief, repo-opportunity backlog briefs, etc).
>
> **Origin:** Adapted from `last30days-skill` v3.0.10+ OUTPUT CONTRACT (8 LAWs),
> which solved the v3.0.6 / v3.0.7 canonical-compliance regressions by hoisting
> the laws into the same guaranteed-loaded band as the synthesis prompt and
> enforcing them with structural anchors (mandatory first-line badge,
> `What I learned:` prose label, bold-lead-in paragraphs, no `##` headers, etc).
>
> **Scope of adaptation:** kept the SPIRIT of all 8 LAWs from last30days, but
> re-mapped two laws because Nova digests do not have a Python engine emitting
> a deterministic `✅ All agents reported back!` footer:
>
> - LAW 5 → **"STRUCTURED STATS BLOCK"** instead of engine footer
> - LAW 7 → **"PRE-FLIGHT SCOPE"** instead of `--plan` flag

---

## When to use this contract

Use it for any output that synthesises evidence into a "here is what I found"
brief for Nick. Specifically:

- BTC daily investment check (06:00 cron)
- Fund brief (Thai / English)
- Support digest (`/api/support-digest`)
- Repo-review synthesis (cheap-repo-reviews)
- Repo-opportunity backlog entries
- Last30days-style "what people are saying" digests
- Market / sector / earnings briefings
- Any cron / isolated session that currently emits "## …" markdown

Do **not** use it for:

- Operational status lines (`HEARTBEAT_OK`, ack messages)
- Incident/RCA responses (use `support-engineering-specialist.md` framing)
- Code review or PR comments (use `nova-code-review-specialist.md`)
- Internal reasoning that Nick never sees

---

## The 8 LAWs (adapted for Nova)

> **Read these BEFORE you start writing the digest.**
> The self-check at the bottom is the same as writing.

**LAW 1 - NO `Sources:` / `References:` / `Further reading:` BLOCK AT THE END.**
The `🌐 Source:` line in the structured stats block is the only visible
citation. Do not append a trailing bullet list of URLs, publication names, or
"See also" links. Output ends at the invitation. Nothing below it.
*Exception:* structured `## Sources` / `## References` sections are allowed
**inside the structured stats block** (see LAW 5), never as trailing
post-invitation content.

**LAW 2 - NO INVENTED TITLE LINE. PROSE LABEL IS THE TITLE.**
The badge on line 1 is the title. The prose label `What I learned:` on line 3
IS the start of the body. Do not write `{Topic} brief`, `## {Topic}`, or any
title line above `What I learned:`.
*Exception:* if the digest is a **named-entity** brief (specific ticker,
product, person, project, repo, app), the badge can include the entity handle
(e.g. `🌐 nova-research v1.0 · BTC daily · synced 2026-06-11`) — but the body
still starts at `What I learned:`.

**LAW 3 - NO EM-DASHES OR EN-DASHES.**
Use ` - ` (single hyphen with spaces on both sides) instead of `—` or `–`.
Applies everywhere: body, KEY PATTERNS, invitation, structured stats.
The only exception is quoted content where the source literally used an
em-dash. Em-dashes are the most reliable AI-slop tell.

**LAW 4 - NO `##` OR `###` SECTION HEADERS IN BODY.**
No `## The launch`, `## Polymarket`, `## Bottom line`, `## Where it
disappoints`, `## Key patterns`, `## Model status`, `## Buckets`. The
narrative is bold-lead-in paragraphs (each starting with `**{headline}**`),
then the prose label `KEY PATTERNS from the research:`, then a numbered list.
That is the only structure outside the structured stats block.
*Exception:* the **structured stats block** at the end of the digest MAY
use `##` headers (`## Evidence counts`, `## Sources used`, `## Methodology
note`) because it is a deterministic post-narrative evidence table, not the
synthesis body.

**LAW 5 - STRUCTURED STATS BLOCK (replaces engine footer).**
Every digest MUST end with a structured stats block (after KEY PATTERNS,
before the invitation) that contains at minimum:

```
## Evidence
- Sources used: {count} ({list of source families})
- Items processed: {count} ({raw / clustered / scored})
- Time window: {start} → {end} ({window label})
- Confidence: {HIGH / MEDIUM / LOW} ({reason})
- Method: {1-2 line note on how the digest was produced}
```

The stats block MUST appear after the prose narrative and KEY PATTERNS, and
BEFORE the invitation. It is the durable evidence trail. Do not skip it, do
not paraphrase, do not invent a `## Notable Stats` or `## Sources` block
that violates LAW 4 (those `##` headers are legal ONLY inside this block).

**LAW 6 - NO RAW EVIDENCE DUMP IN BODY.**
Ranked evidence clusters, raw score tuples, raw source lists, and any
`{score: N, items: M, sources: ...}` style data are READ by you to write
the digest, not EMITTED to Nick. Transform them into `What I learned:`
prose paragraphs per LAW 2. If your response contains `### 1.` followed by
a score tuple, or a bullet list of `Uncertainty: thin-evidence` style raw
metadata in the body, you dumped evidence instead of synthesising. STOP and
regenerate.

**LAW 7 - PRE-FLIGHT SCOPE.**
Before you start the digest, you MUST define a scope block. For named-entity
topics (ticker, product, person, project, repo, app) the scope block MUST
include:

```
## Scope
- Topic: {canonical name}
- Entity handles: {[primary], [secondary], ...}  (or "n/a")
- Time window: {start} → {end} ({window label})
- Sources planned: {list, e.g. price feeds, GitHub, X, Reddit, official docs}
- Method: {1-2 line note on how you will gather + score evidence}
- Prior-brief delta: {what changed since last brief, or "first brief"}
```

Skip the scope block ONLY for cron-driven one-shot digests (BTC daily check
at 06:00) where the scope is already baked into the cron payload. For
ad-hoc digests, the scope block lives in the digest's preflight, NOT in
the user-facing output. (User-facing output starts at LAW 2 / line 1.)

**LAW 8 - EVERY CITATION IN THE NARRATIVE IS AN INLINE MARKDOWN LINK
`[name](url)`. NEVER A RAW URL STRING. NEVER A PLAIN NAME WHEN A URL IS
AVAILABLE.**
Applies to every digest. In `What I learned:`, in `KEY PATTERNS`, and in
the structured stats block. Every cited `@handle`, `r/sub`, publication,
YouTube channel, ticker, repo, or app is wrapped as `[name](url)` at first
mention. Telegram / dashboard renderers may strip URLs visually — that is
fine, the link is still in the markdown. Fall back to plain text ONLY when
the raw evidence has no URL for that specific source.

---

## Output skeleton (annotated example)

```
🌐 nova-research v1.0 · {topic / handle} · synced {YYYY-MM-DD}

What I learned:

**{Headline 1 - specific, newsy, not generic}** - 1-2 sentences with
inline citation [name](url). Use ` - ` separators. No em-dash.

**{Headline 2}** - 1-2 sentences, inline citation [name](url).

**{Headline 3}** - 1-2 sentences, inline citation [name](url).

KEY PATTERNS from the research:
1. [Pattern] - per [@handle](https://x.com/handle) and [r/sub](https://reddit.com/r/sub)
2. [Pattern] - per [publication](https://example.com/article)
3. [Pattern] - per [repo](https://github.com/owner/repo) (commit {sha})

## Evidence
- Sources used: {N} ({source families})
- Items processed: {N} ({raw / clustered / scored})
- Time window: {start} → {end} ({window label})
- Confidence: {HIGH / MEDIUM / LOW} ({reason})
- Method: {1-2 line note}
- Sources: [source 1](url), [source 2](url), [source 3](url)

---
{Invitation - 2-3 specific example suggestions based on what you ACTUALLY
learned, not generic "Want to go deeper?"}
```

Headslines should be specific and newsy ("ETF inflow flipped to outflow",
"v3.0.7 fixed the LAWs hoist regression"), not generic ("Market update",
"Latest changes"). Bold-lead-in paragraphs each cover ONE point.

---

## Post-synthesis self-check (do BEFORE emitting)

Run this scan on the last 25 lines of your draft:

1. **LAW 1 check:** no `Sources:` / `References:` / `Further reading:` /
   `Citations:` followed by a bulleted list AFTER the invitation block.
2. **LAW 2 check:** body starts with `What I learned:` (or is a named-entity
   brief that already had the entity in the badge).
3. **LAW 3 check:** zero `—` or `–` anywhere (grep your draft).
4. **LAW 4 check:** zero `## ` or `### ` in the body BEFORE the structured
   stats block. `## ` headers in the structured stats block are OK.
5. **LAW 5 check:** structured `## Evidence` block exists and contains
   Sources used / Items processed / Time window / Confidence / Method.
6. **LAW 6 check:** no `### 1.` followed by a score tuple, no
   `Uncertainty:` raw metadata in the body.
7. **LAW 7 check:** scope block was defined (ad-hoc digests) or the cron
   payload already includes scope (scheduled digests).
8. **LAW 8 check:** every cited source in the body is `[name](url)` form;
   no raw `https://...` strings, no plain names when a URL exists.

If any check fails, **DELETE** the offending lines and regenerate that
section. Do not patch around the violation.

---

## Adapter table (current Nova digests → contract)

| Digest                              | Cron / API                  | Adaptations                                       |
|-------------------------------------|------------------------------|---------------------------------------------------|
| BTC daily check                     | `cron 303fa371` 06:00        | LAW 7 scope is in the cron payload (skip block)  |
| Fund brief                          | `brief_cli.py` ad-hoc        | LAW 7 pre-flight scope block REQUIRED             |
| Support digest                      | `/api/support-digest`        | LAW 5 stats block uses Grafana/Loki source list  |
| Repo-review synthesis               | `nova-pack-repo` + reviews   | LAW 7 scope = repo URL + commit SHA               |
| Repo-opportunity backlog entry      | `repo-opportunities-backlog` | LAW 5 evidence count = 1 (the source repo)        |
| Last30days-style digest (future)    | TBD                          | Use last30days SKILL.md directly + add LAW 5 stub|
| AI course / nightly learning        | `improve` cron 22:45         | Out of scope (uses its own contract)              |

---

## Migration notes

**For existing `##`-based briefs** (lottery-2digit, fund-research-assistant
default, support digest legacy):

1. Do NOT mass-rewrite at once.
2. Pick the next ad-hoc instance of the brief, render in the new contract,
   save `*-LAWS-8-v1.md` next to the original.
3. Compare side-by-side with Nick. If accepted, archive the old format and
   update the generator / prompt.
4. If rejected, log the rejection reason to `research/2026-06-11-8laws-adaptation.md`
   evidence file and back out the change.

**For cron prompts** (BTC daily check): the prompt can be updated in one
patch by appending "Use the 8 LAWs output contract at
`prompts/research-digest-output-contract.md`." Do not re-write the rest of
the prompt until Nick validates the new format.

---

## Why this contract exists (1 paragraph)

Em-dashes, `##` section headers, invented title lines, and trailing
`Sources:` blocks are the four most reliable "AI slop" tells. The
last30days skill observed 4/4 compliance failures across 8 test runs when
these rules lived deep in SKILL.md (line 1224+), and 10/10 compliance
when they were hoisted to the top of the file with structural anchors.
Nova has the same risk profile on every ad-hoc digest. Adopting the
hoisted 8 LAWs turns "remember to follow the format" into "the format
loads on first read and the structure forces compliance." Same
trade-off, same win.
