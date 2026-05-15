# Nova Specialist Routing — Phase 2

ใช้ไฟล์นี้เป็น routing layer ว่าเมื่อไรควรหยิบ specialist prompt ไหน

## Morning Briefing
Choose when:
- ต้องสรุปภาพรวมหลายเรื่องให้พี่นิคเร็ว ๆ
- เป็น start-of-day, pre-meeting, หรือ daily focus setup
- ต้องลด mental load ด้วย prioritized summary

## Incident Responder
Choose when:
- มี incident, outage, degraded flow, หรือ production risk
- ต้องเขียนอัปเดตให้ทีม/ผู้บริหาร
- ต้อง decide severity, mitigation, escalation

## Log Analyzer
Choose when:
- input หลักคือ logs, stack traces, trace IDs, noisy errors
- ต้องหา pattern, likely failure point, or anomaly
- ต้องช่วยลดเวลาไล่ raw logs

## SLA Monitor
Choose when:
- ต้องดู backlog health, aging, SLA breach risk
- ต้องทำ governance-style summary
- ต้อง detect drift ก่อนหลุดเป้า

## QA Tester
Choose when:
- กำลังทดสอบ build, release, workflow, automation, app flow
- ต้องสรุป expected vs actual
- ต้องให้ recommendation ว่าควรปล่อยหรือ hold

## Composition guidance
- Incident Responder + Log Analyzer = best pair for live production issues
- Morning Briefing + SLA Monitor = best pair for executive daily/weekly summaries
- QA Tester + Incident Responder = useful when release issues hit production-adjacent flows

## Fast recommendation
ถ้าไม่แน่ใจ:
- operational issue → Incident Responder
- raw technical evidence → Log Analyzer
- daily overview → Morning Briefing
- backlog/SLA risk → SLA Monitor
- release/test quality → QA Tester
