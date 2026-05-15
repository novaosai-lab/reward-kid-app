# Nova Phase 1 — Awesome OpenClaw Agents Adaptation

Phase 1 นี้คือการแปลงไอเดียจาก `mergisi/awesome-openclaw-agents` ให้เป็นโครง persona/template ที่เข้ากับ Nova และงานของพี่นิค โดยยังไม่ผูก automation หรือ workflow จริง

## เป้าหมาย
- มี persona/template ที่หยิบไปใช้ต่อได้ทันที
- คุมทิศทางให้ Nova ไม่ generic
- เตรียมฐานสำหรับ Phase 2 ที่จะลง workflow / routing / automation จริง

## Shortlist ที่เลือก
1. Morning Briefing
2. Incident Responder
3. Log Analyzer
4. SLA Monitor
5. QA Tester

## ไฟล์ใน Phase 1
- `nova-morning-briefing.md`
- `nova-incident-responder.md`
- `nova-log-analyzer.md`
- `nova-sla-monitor.md`
- `nova-qa-tester.md`
- `nova-routing-guide.md`

## วิธีใช้
- ใช้แต่ละไฟล์เป็น base prompt / SOUL fragment / specialist instruction
- ถ้าจะทำ agent จริงใน OpenClaw ให้เอาโครงในไฟล์เหล่านี้ไป merge กับ persona หลักของ Nova
- `nova-routing-guide.md` ใช้เป็นตัวกำหนดว่าเมื่อไรควรเรียก template ไหน

## Recommendation
ถ้าจะทำต่อ Phase 2 แบบคุ้มสุด ให้เริ่มลำดับนี้:
1. Morning Briefing
2. Incident Responder + Log Analyzer
3. SLA Monitor
4. QA Tester
