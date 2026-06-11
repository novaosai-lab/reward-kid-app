# Nova Cron Job — Model Overrides Inventory

**Snapshot date:** 2026-06-11 11:16 GMT+7
**Source:** `openclaw cron list --json` (11 jobs total)
**Default model:** `minimax-portal/MiniMax-M3` (MiniMax-M3, minimax-portal)
**Fallback chain:** `M3 → M2.7-highspeed → M2.7` (minimax-only as of 11:01)
**Audit trigger:** `Core OpenClaw Audit 2026-06-11` recommendation #4

---

## TL;DR

**11 jobs total. 1 override. 10 inherit default.**

The single override (`Nightly multi-agent repo learning`) was changed from
`openai/gpt-5.5` (Codex) → `minimax-portal/MiniMax-M2.7-highspeed` as part of
the audit #1 fix (switch to minimax-only fallback chain).

This doc captures the rationale so future Nick (or future Nova) doesn't
accidentally remove an override that was intentional, or fail to update one
when a model is deprecate.

---

## Full inventory (11 jobs)

| # | Job name                                  | Schedule (Asia/Bangkok) | Model                              | Override? |
|---|-------------------------------------------|-------------------------|------------------------------------| --------- |
| 1 | Prod HPC log digest 18:00 weekdays        | `0 18 * * 1-5`          | `minimax-portal/MiniMax-M3` (def.) | inherits  |
| 2 | Nova Self-Improvement Loop                | `45 22 * * *`           | `minimax-portal/MiniMax-M3` (def.) | inherits  |
| 3 | Nova Dreaming Loop                        | `15 23 * * *`           | `minimax-portal/MiniMax-M3` (def.) | inherits  |
| 4 | Nova Nightly Memory Distillation          | `30 23 * * *`           | `minimax-portal/MiniMax-M3` (def.) | inherits  |
| 5 | Nightly GitHub checkpoint                 | `55 23 * * *`           | `minimax-portal/MiniMax-M3` (def.) | inherits  |
| 6 | Nightly multi-agent repo learning        | `0 2 * * *`             | **`minimax-portal/MiniMax-M2.7-highspeed`** | **OVERRIDE** |
| 7 | Nightly AI course learning                | `15 3 * * *`            | `minimax-portal/MiniMax-M3` (def.) | inherits  |
| 8 | Nightly GitHub repo trending learning     | `30 4 * * *`            | `minimax-portal/MiniMax-M3` (def.) | inherits  |
| 9 | daily-btc-investment-check                | `0 6 * * *`             | `minimax-portal/MiniMax-M3` (def.) | inherits  |
| 10 | Morning summary: nightly repo learning   | `45 8 * * *`            | `minimax-portal/MiniMax-M3` (def.) | inherits  |
| 11 | Morning summary: nightly AI course       | `5 9 * * *`             | `minimax-portal/MiniMax-M3` (def.) | inherits  |

---

## The 1 override — rationale

### #6 `Nightly multi-agent repo learning` → `M2.7-highspeed`

**Previous model:** `openai/gpt-5.5` (Codex, was chosen for cost/throughput)
**Current model:** `minimax-portal/MiniMax-M2.7-highspeed`
**Set on:** 2026-06-11 11:01 GMT+7 (during audit #1 fix)

**Why this override exists:**

- Job processes **~50-200 KB of repo packs** per night (last30days-style reviews)
  and produces a multi-section synthesis. M3 is the strongest reasoning model
  in the chain but is best for shorter, higher-judgment work (incident response,
  RCA, planning). M2.7-highspeed has the right balance of context window +
  throughput for the bulk nightly research digest.
- M2.7 is the next fallback (inherits from `agents.defaults.model.fallbacks`),
  so if M2.7-highspeed is overloaded, M2.7 picks up automatically.

**Trade-off vs. inheriting M3:**

- M2.7-highspeed is faster and cheaper per token
- M2.7-highspeed quality is "good enough" for nightly discovery (Nick reads
  the morning summary, not the raw output)
- M3 would be wasted on this volume of routine nightly work

**What to do if M2.7-highspeed is deprecate:**

1. Remove the override → inherits M3 (works, just slower + more expensive)
2. OR change to `minimax-portal/MiniMax-M2.7` (one tier down, still works
   for synthesis)
3. OR change to whatever new minimax model replaces M2.7-highspeed tier

**Rollback path:** `openclaw cron edit 9b6f346f-90a8-4f0a-8230-8127c462c3cf --model <new_model>`

---

## The 10 inheriting jobs — why they don't need overrides

All 10 jobs inherit `minimax-portal/MiniMax-M3` because:

1. **M3 is the strongest reasoning model** in the chain — preferred when Nick
   actually reads the output and quality matters
2. **Input size is smaller** than the multi-agent repo learning job — most are
   under 30 KB of input
3. **Tasks are higher-judgment** — daily investment check, morning summaries,
   memory distillation, self-improvement reflection, GitHub checkpoint, log
   digest
4. **Fallback chain handles transient overload** — if M3 is overloaded, M2.7-highspeed
   or M2.7 picks up automatically (no need to pre-emptively pin)

**Exception (still open):** `daily-btc-investment-check` inherits M3 but had a
chain failure on 2026-06-11 06:02 due to M3 + M2.7s being overloaded + gemma 401
+ Codex rate-limit. After switching fallback chain to minimax-only (audit #1),
this risk is reduced. If M3 chain failures recur, consider adding an explicit
`failureAlert` so Nick is pinged within minutes (audit #2 still open).

---

## How the fallback chain works (current state)

```
agents.defaults.model.primary:        minimax-portal/MiniMax-M3
agents.defaults.model.fallbacks[0]:   minimax-portal/MiniMax-M2.7-highspeed
agents.defaults.model.fallbacks[1]:   minimax-portal/MiniMax-M2.7
```

When a job runs:

1. Try `payload.model` (or `primary` if inheriting)
2. If that fails/overloaded → try `fallbacks[0]`
3. If that fails → try `fallbacks[1]`
4. If all fail → job fails (no more fallbacks since 11:01)

**All 11 jobs benefit from this chain**, including the 1 override (M2.7-highspeed
→ M2.7 fallback).

**Verify anytime:** `openclaw config get agents.defaults.model` or
`session_status` (this session).

---

## What changed during the 2026-06-11 audit

| Time (BKK) | Action                                                                 | Effect                                          |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| 11:01      | `agents.defaults.model.fallbacks` เปลี่ยน gemma/gpt-5.5 → M2.7 ล้วน   | Default chain ใช้ minimax ล้วน                  |
| 11:01      | cron #6 payload.model เปลี่ยน `openai/gpt-5.5` → `M2.7-highspeed`      | Job ที่ override อยู่ตัวเดียวเปลี่ยนตามนโยบาย   |
| 11:13      | `commands.ownerAllowFrom = ["8613255279"]`                              | Security audit 4 critical → 0                  |
| 11:13      | `channels.{telegram,discord,line}.groupPolicy = "allowlist"`            | Group allowFrom scoped to Nick only             |

---

## How to use this doc

**When onboarding a new cron job:**

- Default: don't set `payload.model` — inherit M3
- Only set override if the job is bulk nightly research with input > 50 KB AND
  quality is "good enough" (not "best possible")
- Document rationale here

**When a minimax model is deprecate:**

1. Check which cron jobs have overrides pointing at the deprecate model
2. For each: decide between (a) remove override, (b) change to replacement
3. Update this doc + run `openclaw cron list --json | jq ...` to verify

**When adding a new model tier:**

1. Add to `models.providers.minimax.models[]`
2. Optionally add to `agents.defaults.models` with alias
3. Optionally add to `agents.defaults.model.fallbacks` (be careful with order)
4. Update this doc

**When the default model changes:**

1. Update `agents.defaults.model.primary`
2. All 10 inheriting jobs pick it up automatically
3. The 1 override (#6) does NOT pick it up — needs explicit change
4. Update this doc

---

## References

- `prompts/research-digest-output-contract.md` — 8 LAWs output contract
  (affects #2, #3, #6, #7, #8, #9, #10, #11 — any "research digest" style job)
- `memory/2026-06-11.md` — today's session log (audit + fixes)
- `research/2026-06-11-8laws-adaptation.md` — 8 LAWs evidence file
- Core OpenClaw audit 2026-06-11 — embedded in memory notes (in-progress; not
  yet a standalone file)
