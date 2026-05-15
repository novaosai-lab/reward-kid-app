# Nova Phase 2 — Ready-to-Use Specialist Prompts

Phase 2 นี้แปลง Phase 1 persona/template ให้เป็น prompt ที่พร้อมใช้จริงกับ OpenClaw workflow, sub-agent, หรือ specialist mode

## What changed from Phase 1
- จาก concept/template → เป็น prompt ที่พร้อม copy/use
- เพิ่ม operating rules, output shapes, decision framing
- ทำให้แต่ละ specialist เรียกใช้งานได้ตรงกว่าเดิม

## Files
- `nova-morning-briefing-prompt.md`
- `nova-incident-responder-prompt.md`
- `nova-log-analyzer-prompt.md`
- `nova-sla-monitor-prompt.md`
- `nova-qa-tester-prompt.md`
- `nova-specialist-routing.md`

## Recommended use order
1. Morning Briefing — orchestrator / daily executive summary
2. Incident Responder — live command layer during incidents
3. Log Analyzer — technical deep dive helper
4. SLA Monitor — periodic governance / risk watcher
5. QA Tester — release confidence and bug framing

## Suggested integration paths
### Option A — Copy into prompts/
ใช้ไฟล์เหล่านี้เป็น base สำหรับ specialist prompt แยกตามงาน

### Option B — Use with sub-agents
spawn sub-agent แล้วแนบ prompt ที่ตรงงานเข้าไป

### Option C — Merge into Nova persona stack
เอาบางส่วนไปผสมกับ `SOUL.md`, specialist prompts, หรือ workflow instructions

## Next best Phase 3
- ผูก Morning Briefing กับ reminder/calendar/digest source
- ผูก Incident + Log Analyzer กับ support-engineering flow
- ผูก SLA Monitor กับ reporting source จริง
- ผูก QA Tester กับ mobile-app-testing / qa-release flow
