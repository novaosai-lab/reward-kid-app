# Nova Specialist Playbook

คู่มือใช้งาน specialist prompts ที่ต่อจาก `awesome-openclaw-agents` และถูกปรับให้เข้ากับ Nova/พี่นิคแล้ว

## Available specialists
- `prompts/nova-morning-briefing-specialist.md`
- `prompts/nova-incident-responder-specialist.md`
- `prompts/nova-log-analyzer-specialist.md`
- `prompts/nova-sla-monitor-specialist.md`
- `prompts/nova-qa-specialist.md`
- `prompts/nova-inbox-triage-specialist.md`
- `prompts/nova-meeting-notes-specialist.md`
- `prompts/nova-code-review-specialist.md`
- `prompts/nova-bug-hunter-specialist.md`
- `prompts/nova-api-test-specialist.md`
- `prompts/nova-task-coordinator-specialist.md`
- `prompts/nova-followup-manager-specialist.md`

## When to use which
### Morning Briefing
ใช้เมื่อ:
- ต้องสรุปเช้า
- ต้องจัดลำดับเรื่องสำคัญ
- ต้องลด mental load

### Incident Responder
ใช้เมื่อ:
- มี incident / outage / production risk
- ต้องสรุป severity, impact, mitigation
- ต้องร่าง stakeholder update

### Log Analyzer
ใช้เมื่อ:
- input หลักคือ logs / stack traces / error burst
- ต้องหา pattern และ likely failure path

### SLA Monitor
ใช้เมื่อ:
- ต้องดู backlog health / aging / breach risk
- ต้องการ governance-style summary

### QA Specialist
ใช้เมื่อ:
- ต้องทดสอบ build / flow / release
- ต้องสรุป sign-off recommendation

## Recommended pairings
- Incident Responder + Log Analyzer
- Morning Briefing + SLA Monitor
- QA Specialist + Incident Responder

## Suggested integration
1. ใช้ไฟล์เหล่านี้เป็น base prompt ใน sub-agent/task-specific sessions
2. ใช้คู่กับ skill หลักที่เหมาะ:
   - support-engineering
   - engineering-partner
   - personal-ops
   - mobile-app-testing
3. ถ้าเป็นงาน support/incident ให้ยึด Incident Responder เป็น default frame ก่อน

## Fast defaults
- daily overview → Morning Briefing
- live ops issue → Incident Responder
- raw evidence/logs → Log Analyzer
- backlog/SLA risk → SLA Monitor
- release/test judgment → QA Specialist
- messy inbox / reply backlog → Inbox Triage
- meeting transcript / notes cleanup → Meeting Notes
- PR / diff risk review → Code Review
- symptom-first debugging → Bug Hunter
- endpoint health / API checks → API Test
- multi-step mixed work → Task Coordinator
- pending actions / loose ends → Follow-up Manager

## Workflow bindings
For repeatable execution, use the workflow files:
- `workflows/nova-specialists/shortcuts.md`
- `workflows/nova-specialists/presets/`
- `workflows/nova-specialists/intake/`
- `workflows/nova-specialists/launchers/`
- `workflows/nova-specialists/execution-flows/`
- `workflows/nova-specialists/delegation/`
- `workflows/nova-specialists/bundles/`
