# Nova Design Quality Check

Use this before shipping Nova-generated web apps, dashboards, slides, or intro animations.

## Core Rule

Ship something that looks like a human product designer made one strong decision — not a generic AI template.

Aim for:
- 80% proven interaction/layout pattern
- 20% distinctive Nova detail

## P0 — Must Fix

- No copied brand UI, logos, or copyrighted visual identity unless explicitly licensed.
- No default AI gradient hero: purple → blue, blue → cyan, indigo → pink.
- No default Tailwind indigo/purple accent as the main identity unless deliberately justified.
- No emoji feature icons in serious product surfaces.
- No invented metrics (`10× faster`, `99.9% uptime`) unless sourced or clearly marked placeholder.
- No filler copy (`feature one`, `lorem ipsum`, `sample content`).
- Mobile CTA must be visible and tappable.
- Interactive/audio/video elements must have explicit user-triggered controls when browser autoplay restrictions apply.

## P1 — Should Fix

- Use one clear visual direction, not mixed metaphors.
- Use tokens from a design system; avoid random one-off hex values.
- Limit accent color to 1–2 visible uses per screen.
- Prefer monoline SVG/icons over decorative blobs.
- Add stable IDs/classes for surgical edits when useful (`data-nova-id`).
- Ensure readable text contrast on dark backgrounds.
- Animation should communicate state, hierarchy, or delight — not motion for motion’s sake.

## Nova Visual Directions

### Mission Control
Best for: Ops Dashboard, support command center, health monitoring.
- Dark navy canvas
- Amber telemetry values
- Cyan healthy indicators
- Red critical alerts
- Dense but readable grid

### Genesis HUD
Best for: Nova Intro, boot sequence, futuristic demos.
- Near-black background
- Thin telemetry overlays
- Subtle reticle/ring geometry
- Minimal phosphor/cyan/gold accents
- One memorable boot action

### Linear Precision
Best for: task/project/productivity UIs.
- Near-black native dark mode
- Sparse accent
- Thin borders
- Tight typography discipline

## Acceptance Checklist

Before final response, verify at least one:
- Build passes
- Local page loads
- Screenshot inspected
- Audio/media asset returns 200 OK
- Mobile layout checked or CSS inspected for CTA visibility

## Nova-Specific Guardrails

- Dashboard admin actions stay read-only unless พี่นิค explicitly approves.
- Voice/audio must not imitate real identifiable people.
- Nova Intro music and visuals must be original, not Iron Man/JARVIS branded.
