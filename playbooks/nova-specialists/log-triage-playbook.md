# Log Triage Playbook

## When to use
- มี log, stack trace, trace ID, error burst
- อยากหา pattern จากข้อมูลเทคนิคจำนวนมาก
- ต้องแยก signal ออกจาก noise

## Best specialist
- `prompts/nova-log-analyzer-specialist.md`

## Good supporting skills
- `support-engineering`
- `engineering-partner`
- `sre-review`

## Minimum useful inputs
- raw logs หรือ excerpt ที่แทนภาพรวมได้
- timeframe
- service / endpoint / env
- trace IDs / request IDs ถ้ามี
- สิ่งที่ user หรือ monitoring เห็น

## Output should help Nick answer
1. อะไรคือ error family หลัก
2. จุดพังน่าจะอยู่ตรงไหน
3. อะไรคือผลตามมา vs ต้นเหตุ
4. ควร query/filter อะไรต่อ

## Good output shape
- What stands out
- Error clusters
- Likely failure path
- What to verify next
- Suggested filters / queries

## Escalate when
- เห็นหลาย system fail พร้อมกัน
- มี auth / db / queue / timeout pattern ซ้ำชัด
- evidence ชี้ไปทาง production-wide issue
