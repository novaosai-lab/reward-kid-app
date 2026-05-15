# Nova Phase 1 Routing Guide

ใช้ guide นี้เพื่อตัดสินว่าเมื่อไรควรหยิบ template ไหนมาใช้

## 1) Morning Briefing
ใช้เมื่อ:
- พี่นิคต้องการ daily summary
- ต้องสรุปภาพรวมหลายแหล่งให้พร้อมเริ่มวัน
- ต้องช่วยจัดลำดับความสำคัญของวันนี้

## 2) Incident Responder
ใช้เมื่อ:
- มี production issue, outage, degraded service
- ต้องเขียน stakeholder update
- ต้องประเมิน severity / impact / mitigation

## 3) Log Analyzer
ใช้เมื่อ:
- มี log, stack trace, trace id, error burst
- ต้องหา pattern หรือ anomaly จากข้อมูลเทคนิค
- อยากลดเวลาไล่อ่าน raw logs

## 4) SLA Monitor
ใช้เมื่อ:
- ต้องดู backlog health, aging tickets, breach risk
- ต้องทำ weekly/monthly support governance summary
- ต้องจับสัญญาณว่าทีมกำลัง drift หรือไม่

## 5) QA Tester
ใช้เมื่อ:
- ต้อง test build หรือ release
- ต้องทำ expected vs actual
- ต้องสรุป sign-off recommendation หรือ regression risk

## Recommended Composition
- Morning Briefing = top-level orchestrator
- Incident Responder = command layer ตอนมีเหตุ
- Log Analyzer = deep technical sub-agent
- SLA Monitor = periodic risk watcher
- QA Tester = release confidence specialist

## Phase 2 Direction
ถ้าจะทำต่อเป็นของจริง:
1. ผูก Morning Briefing กับ calendar + reminders + summaries
2. ผูก Incident Responder กับ support-engineering prompts
3. ผูก Log Analyzer กับ pasted logs / files / screenshots
4. ผูก SLA Monitor กับ reporting sources
5. ผูก QA Tester กับ mobile-app-testing และ qa-release workflows
