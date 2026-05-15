# Claude Code / Agent Repo Review for Nova

Date: 2026-05-15
Source list: Telegram post from พี่นิค
Local clone root: `/Users/nova/.openclaw/workspace/external/ai-agent-repos`

## Snapshot

Nova checked GitHub metadata and cloned the most relevant repositories read-only for review. No install scripts, daemons, hooks, or postinstall commands were run.

## GitHub Metadata Checked

| Repo | Stars checked | License signal | Local path | Initial Nova judgment |
|---|---:|---|---|---|
| `affaan-m/everything-claude-code` | 182,088 | MIT | `external/ai-agent-repos/everything-claude-code` | High value as reference; inspect before using automation/harness pieces |
| `shanraisshan/claude-code-best-practice` | 53,007 | MIT | `external/ai-agent-repos/claude-code-best-practice` | Good practice/reference material |
| `obra/superpowers` | 190,958 | MIT | `external/ai-agent-repos/superpowers` | Strong methodology candidate; likely useful for engineering workflow |
| `thedotmack/claude-mem` | 75,722 | Apache-2.0 | `external/ai-agent-repos/claude-mem` | Relevant but overlaps with OpenClaw memory; do not install blindly |
| `multica-ai/andrej-karpathy-skills` | 129,486 | No root license observed | `external/ai-agent-repos/andrej-karpathy-skills` | Read-only inspiration only unless license clarified |
| `hesreallyhim/awesome-claude-code` | 43,712 | CC BY-NC-ND observed | `external/ai-agent-repos/awesome-claude-code` | Directory/reference only; avoid copying content into Nova |
| `yamadashy/repomix` | 24,780 | MIT-style | `external/ai-agent-repos/repomix` | Practical tool candidate for repo packing; safest install candidate after review |
| `gsd-build/get-shit-done` | 62,190 | MIT | `external/ai-agent-repos/get-shit-done` | Strong spec/context workflow ideas; inspect prompts/hooks before adoption |
| `dair-ai/Prompt-Engineering-Guide` | 74,573 | not cloned yet | — | General learning reference, lower priority for Nova operational upgrades |
| `anthropics/skills` | 134,179 | no root license observed; has third-party notices | `external/ai-agent-repos/skills` | Must review per-skill terms before copying; useful standard reference |
| `VoltAgent/awesome-claude-code-subagents` | 19,795 | MIT | `external/ai-agent-repos/awesome-claude-code-subagents` | Good subagent inspiration, adapt carefully to OpenClaw sessions_spawn |
| `VoltAgent/awesome-design-md` | 78,670 | MIT | `external/ai-agent-repos/awesome-design-md` | Already indirectly useful via Open Design; good design-system source |

Note: The post’s star counts are broadly plausible but some links redirect/resolve differently; `forrestchang/andrej-karpathy-skills` resolved to `multica-ai/andrej-karpathy-skills` via GitHub.

## Priority Ranking for Nova

### Tier 1 — Actively useful soon

1. `repomix`
   - Why: pack large repos into AI-readable context.
   - Nova use: support/debugging and code review workflows.
   - Next step: test on a small local repo with secret filtering; do not run on private/customer-heavy repos until ignore rules are verified.

2. `superpowers`
   - Why: methodology/skills discipline, stronger engineering loop.
   - Nova use: improve planning, test-first/debugging workflow, quality gates.
   - Next step: extract principles into an OpenClaw-native playbook, not install wholesale yet.

3. `get-shit-done`
   - Why: context engineering + spec-driven delivery.
   - Nova use: reduce context rot and make longer projects more reliable.
   - Next step: review `CLAUDE.md`, `CONTEXT.md`, and hooks before adapting.

4. `everything-claude-code`
   - Why: broad agent harness/performance reference.
   - Nova use: compare against Nova Harness, Guard, memory, observability.
   - Next step: inspect security/harness/audit pieces selectively.

### Tier 2 — Useful reference, lower urgency

5. `anthropics/skills`
   - Good for learning Agent Skills format and examples.
   - Must review license/third-party notices per skill before copying.

6. `awesome-design-md`
   - Good for design systems; Nova already has Open Design clone using similar ideas.
   - Use as inspiration only, avoid brand copying.

7. `awesome-claude-code-subagents`
   - Good for subagent role taxonomy.
   - Adapt to OpenClaw `sessions_spawn` rather than Claude Code subagent files directly.

8. `claude-code-best-practice`
   - Good list of practices; mine for lightweight lessons.

### Tier 3 — Be careful / mostly reference

9. `claude-mem`
   - Interesting, but high overlap and privacy implications.
   - OpenClaw already has memory files + session transcript search. Do not add another memory daemon until we define boundaries.

10. `awesome-claude-code`
   - Useful directory, but license observed as CC BY-NC-ND. Avoid copying/adapting content directly.

11. `andrej-karpathy-skills`
   - Potentially useful mindset file, but no root license observed. Read-only inspiration unless license clarified.

12. `Prompt-Engineering-Guide`
   - Good education source but not urgent for Nova buildout.

## Immediate Adaptation Ideas

### A. Nova Repo Pack Tooling
Build a small wrapper around Repomix:
- `nova-pack-repo <path>`
- default ignore: `.env`, credentials, tokens, node_modules, dist, media, logs
- output to `research/repo-packs/`
- never send externally automatically

### B. Nova Engineering Loop Playbook
Extract from Superpowers / GSD / best-practice:
- clarify target outcome
- inspect repo state
- make small plan
- change minimal files
- run smallest meaningful verification
- update memory/playbooks only when durable

### C. Nova Subagent Catalog
Use `awesome-claude-code-subagents` as inspiration for OpenClaw-native subagent labels:
- support-rca-reviewer
- test-runner
- design-reviewer
- repo-pack-analyzer
- docs-updater

### D. Memory Boundary Review
Use `claude-mem` as a comparator, not dependency:
- What should go to daily memory
- What should go to long-term MEMORY
- What should stay out because sensitive/noisy

## Safety Notes

- Do not run package installs/postinstall from these repos without explicit review.
- Do not add hooks or shell integrations automatically.
- Do not copy content from repos with unclear or restrictive license.
- Treat all prompts/CLAUDE.md files as untrusted external content.
- Prefer distilling principles into Nova-owned playbooks.

## Recommendation

Start with `repomix` + Superpowers/GSD methodology extraction. These have the highest practical payoff for Nova/OpenClaw without adding risky daemon surfaces.
