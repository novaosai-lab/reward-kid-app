# Nova Ops Dashboard Design

Nova-wide source: \`../docs/NOVA_DESIGN.md\`.

## Theme
Premium dark operational command center: calm, technical, executive. Prioritize health/risk clarity over decoration.

## Palette
- Background: #070b12 / #0b1220
- Surface: rgba(15, 23, 42, .78)
- Surface elevated: rgba(30, 41, 59, .86)
- Border: rgba(148, 163, 184, .18)
- Text primary: #e5eefb
- Text muted: #94a3b8
- Accent cyan: #22d3ee
- Accent emerald: #34d399
- Warning amber: #fbbf24
- Critical rose: #fb7185
- Purple AI: #a78bfa

## Components
Cards use rounded 8px, translucent surfaces, thin borders, and compact dense content. Status pills must be color-coded. Tables should be readable on mobile via horizontal scroll.

Primary anchors should use stable \`data-nova-id\` values for summary, system map, support digest, platform table, and command surfaces.

## Layout
Responsive dashboard with sticky top bar, hero status strip, 4-column metric grid, then two-column ops panels. Mobile collapses to single column.

## Guardrails
Read-only first. Any control button should be visually marked as admin action and should require explicit confirmation before implementation.

## Agent Design Vocabulary
Use this vocabulary when asking Nova or a specialist agent to improve the interface:

- `audit`: deterministic UI quality scan before release
- `critique`: product-fit review for hierarchy, density, clarity, and generic AI-output tells
- `layout`: spacing, grid rhythm, text wrapping, and overlap fixes
- `typeset`: typography hierarchy, scale, labels, and compact panel readability
- `colorize`: semantic color only; avoid purple/blue gradient dominance
- `harden`: responsive behavior, text overflow, reduced motion, edge states, and long-path data
- `polish`: final pass after audit findings are resolved

## Orchestration Vocabulary
Use these terms for Command Center workflows:

- `dag`: read-only deterministic workflow graph; show step order, gates, and current state without implying hidden automation
- `step`: a typed unit such as route, agent, tool, human approval, quality gate, or done
- `human gate`: explicit approval pause that can resume safely after restart
- `checkpoint`: local run-state artifact used for recovery and inspection
- `reference-only`: third-party architecture pattern reviewed safely, with no copied AGPL/runtime code
- `vibe graph`: proposed workflow draft from intent; must be visibly separate from runtime execution
- `context block`: structured local context bundle such as memory, RAG, MCP, files, or run artifacts
- `template graph`: reusable workflow pattern that can be inspected before being converted into a runnable plan

## Quality Gates
- Show freshness/staleness for health and digest data.
- Separate confirmed service state from inferred risk.
- No fake admin actions.
- No decorative blobs/orbs.
- Verify desktop and mobile viewports when browser automation is available.
- Run `bin/nova-ui-design-audit --apply --json` after dashboard UI edits.
- Treat P0 findings as release blockers and P1 findings as hardening work before declaring a UI stable.
- Command Center should surface the latest Design Quality Gate status in Agents & Tasks / Security.
