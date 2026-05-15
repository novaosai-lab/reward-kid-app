# Nova Agent Stack — Phase 4 Summary

ตอนนี้ชุด `awesome-openclaw-agents` ที่ปรับให้เข้ากับ Nova ถูกทำต่อครบเป็น 4 ระดับแล้ว

## Phase 1
Location: `templates/agents/nova-phase1/`
- persona/template skeletons
- routing concept

## Phase 2
Location: `templates/agents/nova-phase2/`
- ready-to-use prompts
- output framing / rules / success criteria

## Phase 3
Location: `prompts/`
- workspace-integrated specialist overlays
- routing playbook
- linked from `SKILL-PRIORITY.md`

## Phase 4
Location: `playbooks/nova-specialists/`
- operational playbooks
- best specialist per situation
- input checklist
- escalation guidance
- practical output expectations

## Heartbeat integration
- `HEARTBEAT.md` now allows short prioritized briefing style when there is real value

## Recommended default stack
- Daily overview → Morning Briefing
- Live prod issue → Incident Responder
- Raw technical evidence → Log Analyzer
- Backlog/SLA risk → SLA Monitor
- Test/release decisions → QA Specialist

## Best pairings
- Incident Responder + Log Analyzer
- Morning Briefing + SLA Monitor
- QA Specialist + Incident Responder
