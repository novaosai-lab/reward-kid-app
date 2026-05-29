# Open Design Review for Nova

Date: 2026-05-14
Repo: https://github.com/nexu-io/open-design
Local clone: `/Users/nova/.openclaw/workspace/external/open-design`
Commit reviewed: `7549883`
Latest refreshed review: 2026-05-19, upstream `56988e40`
License: Apache-2.0

## Executive Summary

Open Design is a strong reference for Nova's design/artifact workflow, but should be adapted selectively rather than installed wholesale.

Best fit for Nova:
- Design-system tokens and style references.
- Craft quality gates, especially anti-AI-slop checks.
- Artifact workflow ideas: design brief → direction picker → generated files → sandbox preview → export.
- Nova Intro / Ops Dashboard visual upgrade using `mission-control`, `hud`, `glassmorphism`, `neon`, `linear-app` patterns.

Avoid for now:
- Running the full daemon stack.
- BYOK proxy / API proxy surfaces.
- Media-generation skills that depend on external providers/credentials.
- Copying brand-specific systems too literally.

## Confirmed Inventory

- Design systems: 149 `DESIGN.md` files.
- Skills: 107 `SKILL.md` files.
- Current README claims broader runtime support including Codex CLI auto-detection, BYOK proxy fallback, design/media skills, and local daemon/web/desktop surfaces. Treat those as runtime-product capabilities to review separately, not as permission to install.
- Main runtime: Next.js web app + local Node daemon + agent CLI adapters.
- Package manager: `pnpm@10.33.2`.
- License: Apache-2.0.

Top skill categories observed:
- image-generation: 20
- design-systems: 17
- video-generation: 8
- figma: 7
- marketing-creative: 6
- documents: 5
- creative-direction: 5
- animation-motion: 5
- audio-music: 4
- slides: 4

## Most Useful Design Systems for Nova

### 1. `mission-control`
Use for Nova Ops Dashboard and support/incident command views.

Key tokens:
- Background: `#0B1120`
- Surface: `#111827`
- Primary telemetry: `#FFB800`
- Active/healthy: `#00D4FF`
- Critical: `#FF4757`
- Success: `#26DE81`
- Font: JetBrains Mono for telemetry, Inter for UI labels

Why it fits:
- Built for operations dashboards, CI/CD, incident response, real-time telemetry.
- Good mental model for Nova Harness / Guard / Node / Gateway dashboard.

### 2. `hud`
Use for Nova Intro / boot sequence overlay, not admin dashboards.

Key tokens:
- Background: `#0A0A0A`
- Primary data: `#00FF41`
- Warning: `#FFB800`
- Alert: `#FF3B3B`
- Font: JetBrains Mono

Important guardrail:
- Avoid copying fighter-jet/combat language too hard. Use as visual grammar only: overlays, reticles, telemetry ticks.

### 3. `glassmorphism` + `neon`
Use sparingly for Nova Intro and landing/demo surfaces.

Recommendation:
- Combine with Mission Control, not alone. Too much glass/neon quickly becomes generic AI-slop.

### 4. `linear-app`
Use for productivity/task views.

Useful patterns:
- Near-black native canvas.
- Sparse accent color.
- Semi-transparent borders.
- Inter variable weight discipline.

Caution:
- Do not copy Linear branding too closely. Extract principles only.

## Craft Rules Worth Adopting

From `craft/anti-ai-slop.md`:
- Avoid default Tailwind indigo/purple-blue gradients.
- Avoid emoji as feature icons.
- Avoid invented metrics like “10× faster” or “99.9% uptime” unless sourced.
- Avoid filler copy and generic `feature one/two/three` text.
- Prefer 80% proven pattern + 20% distinctive choice.
- Use one memorable micro-interaction, not decoration everywhere.

Nova-specific adaptation:
- Add a `nova-design-quality-check.md` playbook.
- Use before shipping Nova Intro v3 or dashboard redesigns.

## Architecture Ideas to Borrow

Good ideas:
1. Plain artifact folder layout (`.od/artifacts/...`) for git-friendly generated outputs.
2. `DESIGN.md` resolver injected into generation prompts.
3. Skill frontmatter extensions for mode, preview type, inputs, and outputs.
4. Sandboxed iframe preview for generated artifacts.
5. Comment/surgical edit pattern using stable element IDs like `data-od-id`.
6. Codex-compatible agent adapter pattern: run Codex scoped to the artifact directory, not the whole workspace.
7. P0/P1/P2 checklist per artifact skill before emitting final output.
8. Explicit direction picker before generation: ask for audience/surface/tone, then choose a deterministic design direction instead of improvising visuals.

Not recommended now:
1. Full daemon install/running alongside OpenClaw; overlap and extra attack surface.
2. BYOK proxy routes; sensitive credential surface.
3. Auto-spawning arbitrary agent CLIs; OpenClaw already provides controlled sessions/tools.

## Skills Worth Reviewing Further

High-priority, low-risk references:
- `gsap-react` — animation cleanup/pattern discipline for React apps.
- `threejs` — scene/material/post-processing guidance for Nova Intro.
- `web-artifacts-builder` — artifact packaging conventions.
- `design-review`, `creative-director`, `color-expert`, `frontend-design` — review heuristics.

Medium-risk / inspect before using:
- Figma skills: require external write access.
- image/video/audio generation skills: credential/provider-heavy.
- screenshot/browser skills: overlap with OpenClaw browser tooling.

## 2026-05-19 Codex/Nova Fit Update

What Codex already supports well:
- Reading and applying `SKILL.md` workflows.
- Using repo-local design instructions such as `DESIGN.md`, AGENTS-style rules, and quality checklists.
- Generating/editing HTML/CSS/React artifacts directly in a project folder.
- Running local validation gates: typecheck, lint/build, browser screenshot, Playwright-style inspection when available.

What Nova should adapt now:
- A small Nova-native `DESIGN.md` format using the 9 sections from Open Design.
- A lightweight UI-generation loop: brief -> design direction -> implement -> screenshot/viewport check -> P0 checklist -> final.
- A P0 anti-slop gate: no invented metrics, no generic purple/blue AI gradients, no emoji-as-icons, no lorem ipsum, no broken mobile reflow, no placeholder links.
- Stable UI anchors such as `data-nova-id` or component IDs for future surgical edits and visual review comments.

What not to run blindly:
- Full `pnpm tools-dev` daemon/web/desktop stack.
- BYOK/API proxy routes or media credential surfaces.
- Agent auto-spawning against broad workspaces.
- Third-party skills that are catalogue stubs pointing to upstream repos without inspecting the upstream code/license first.

## Recommended Nova Roadmap

### Phase 1 — Safe extraction
- Create `/Users/nova/.openclaw/workspace/playbooks/nova-design-quality-check.md` from anti-AI-slop + Nova preferences.
- Create `/Users/nova/.openclaw/workspace/nova-design-systems/` with curated, original Nova tokens inspired by `mission-control`, `hud`, and `linear-app`.
- Do not install Open Design skills globally yet.

### Phase 2 — Nova Intro v3
- Move from current sci-fi HUD to a cleaner “Nova Genesis” direction:
  - Mission-control base.
  - Subtle HUD ring/telemetry layer.
  - One memorable boot micro-interaction.
  - Original audio already created: `nova-genesis-theme.mp3`.
- Add visible mobile CTA and audio state indicator.
- Add `data-od-id` style stable element IDs to support future surgical edits.

### Phase 3 — Nova Ops Dashboard v2
- Apply Mission Control tokens.
- Replace generic cards with telemetry strips and explicit status hierarchy.
- Add incident/support lead views: degraded/critical/nominal lanes.
- Keep admin actions read-only unless explicitly approved.

### Phase 4 — Nova Design Harness
- Build a lightweight OpenClaw-native harness instead of running OD daemon:
  - `brief.md`
  - `DESIGN.md`
  - `artifact/`
  - `quality-check.md`
  - browser screenshot verification
  - optional export script

## Security / Operational Notes

- Repo is external/untrusted. Do not execute install scripts or daemon without explicit review.
- `postinstall` exists in package scripts; avoid `pnpm install` until script reviewed.
- Daemon includes agent spawning and proxy surfaces; treat as privileged runtime.
- Prefer copying design references/playbooks manually over installing runtime components.

## Bottom Line

Open Design is valuable as a design operating system reference, not as something Nova should blindly run. The fastest safe win is to extract its design/craft discipline into Nova’s own playbooks and then upgrade Nova Intro v3 + Nova Ops Dashboard v2 using a curated Nova-original design system.
