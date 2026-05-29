# Nova Design Quality Check

Use this before shipping Nova-generated web apps, dashboards, slides, intro animations, or control-room surfaces.

Canonical design source: \`docs/NOVA_DESIGN.md\`.

## Core Rule

Ship something that looks like a human product designer made one strong decision, not a generic AI template.

Aim for:
- 80% proven interaction/layout pattern
- 20% distinctive Nova detail

Before substantial web/UI generation, state a compact design read:
- Page kind and audience
- Visual language or design-system family
- Three practical dials: layout variance, motion intensity, and information density

Use the read to avoid falling back to the default AI website recipe.

## P0 — Must Fix

- No copied brand UI, logos, or copyrighted visual identity unless explicitly licensed.
- No default AI gradient hero: purple to blue, blue to cyan, indigo to pink.
- No default Tailwind indigo/purple accent as the main identity unless deliberately justified.
- No centered hero + three equal feature cards as the default landing-page layout.
- No decorative section-number eyebrows, status dots, scroll cues, fake beta/version badges, or overlaid image pills unless they are real product information.
- No fake product dashboards/terminals built from decorative divs on marketing pages unless the brief calls for an abstract product concept.
- No repeated left-text/right-image sections across a full page; vary section layout families deliberately.
- No emoji feature icons in serious product surfaces.
- No invented metrics such as \`10x faster\` or \`99.9% uptime\` unless sourced or clearly marked placeholder.
- No filler copy such as \`feature one\`, \`lorem ipsum\`, or \`sample content\`.
- No placeholder links, dead buttons, or fake controls. If a control is not wired, mark it disabled or remove it.
- CTA text/background contrast must be readable. Watch for white text on white/transparent buttons, especially over images.
- Mobile CTA must be visible and tappable.
- Interactive/audio/video elements must have explicit user-triggered controls when browser autoplay restrictions apply.
- Every generated UI must include loading, empty, and error states for its primary data surface.
- No production/external action from UI without a confirmation state.
- No hidden credential/token surfaces in browser storage unless explicitly scoped and explained.

## P1 — Should Fix

- Use one clear visual direction, not mixed metaphors.
- Use tokens from \`docs/NOVA_DESIGN.md\`; avoid random one-off hex values.
- Limit accent color to 1-2 visible uses per screen.
- Lock one accent and one corner-radius rule per screen unless the design system explicitly defines exceptions.
- Prefer monoline icons over decorative blobs.
- Add stable IDs/classes for surgical edits when useful, such as \`data-nova-id\`.
- Ensure readable text contrast on dark backgrounds.
- Animation should communicate state, hierarchy, or delight, not motion for motion's sake.
- Separate confirmed facts, calculated signals, and opinion when showing operational or investment data.
- Add stale/freshness labels for dashboards and briefs that depend on live data.

## Nova Visual Directions

### Mission Control
Best for: Ops Dashboard, support command center, health monitoring.
- Dark navy canvas
- Amber telemetry values
- Cyan healthy indicators
- Red critical alerts
- Dense but readable grid

### Technical HUD
Best for: Claw3D, system maps, agent control surfaces.
- Near-black background
- Thin telemetry overlays
- Subtle geometry tied to actual state
- Minimal cyan/gold/rose semantic accents
- No decorative orbs or fake sci-fi noise

### Linear Precision
Best for: task/project/productivity UIs.
- Near-black native dark mode
- Sparse accent
- Thin borders
- Tight typography discipline
- Clear state transitions

## Acceptance Checklist

Before final response, verify at least one:
- Build passes
- Local page loads
- Screenshot inspected
- Audio/media asset returns 200 OK
- Mobile layout checked or CSS inspected for CTA visibility

For frontend work with a browser-accessible page, prefer this gate:
- desktop viewport checked: 1365x900
- mobile viewport checked: 390x844
- console has no fatal errors
- primary flow works or the blocker is stated
- screenshot saved or direct browser inspection summarized

If browser automation is blocked, run the strongest fallback:
- API/HTML returns 200
- CSS inspected for responsive constraints
- service status checked
- missing visual verification stated clearly

## Open Design Pattern Adoption

Adopt:
- brief -> direction -> build -> screenshot/test -> revise
- P0/P1/P2 checklist discipline
- deterministic visual directions instead of model freestyle
- stable anchors such as \`data-nova-id\`
- sandboxed preview mindset for experimental artifacts

## Taste-Skill Pattern Adoption

Adopt selectively from \`Leonxlnx/taste-skill\`:
- design-read-first discipline
- layout/motion/density dials
- audit-first redesign workflow
- section-specific image references for visual marketing sites
- hard anti-AI-template pre-flight checks

Do not apply landing-page art direction to dashboards, support tools, data tables, multi-step forms, or operational control surfaces. Those need dense, predictable, task-first UI.

Do not adopt without review:
- full Open Design daemon
- BYOK/API proxy
- media generation credential surfaces
- third-party agent auto-spawn on broad workspace scope
- brand-specific design systems copied directly into Nova

## Nova-Specific Guardrails

- Dashboard admin actions stay read-only unless พี่นิค explicitly approves.
- Voice/audio must not imitate real identifiable people.
- Nova Intro music and visuals must be original, not Iron Man/JARVIS branded.
- Session viewers are read-only unless the UI clearly says where a reply will be sent.
