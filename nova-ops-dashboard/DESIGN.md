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

## Quality Gates
- Show freshness/staleness for health and digest data.
- Separate confirmed service state from inferred risk.
- No fake admin actions.
- No decorative blobs/orbs.
- Verify desktop and mobile viewports when browser automation is available.
