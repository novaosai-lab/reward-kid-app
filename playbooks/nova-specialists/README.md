# Nova Specialists — Operational Playbooks

ชุดนี้คือ Phase 4 ที่ทำให้ specialist prompts ใช้งานต่อได้จริงในงานประจำของพี่นิค

## Playbooks
- `daily-briefing-playbook.md`
- `incident-triage-playbook.md`
- `log-triage-playbook.md`
- `sla-watch-playbook.md`
- `qa-review-playbook.md`

## จุดประสงค์
- ทำให้รู้ทันทีว่าแต่ละ specialist ใช้เมื่อไร
- มี input checklist แบบสั้น
- มี output expectation ที่พร้อมเอาไปใช้ต่อ
- ลดเวลาคิดว่าจะเรียกโหมดไหนก่อน

## Fast map
- เริ่มวัน / อยากได้ภาพรวม → Daily Briefing
- prod issue / outage / risk → Incident Triage
- มี log / stack trace → Log Triage
- backlog / aging / SLA risk → SLA Watch
- test / release / bug summary → QA Review

## Integration with current workspace
ใช้คู่กับ:
- `prompts/nova-specialist-playbook.md`
- `prompts/nova-*-specialist.md`
- `skills/support-engineering`
- `skills/engineering-partner`
- `skills/mobile-app-testing`
- `skills/personal-ops`
