# Incident Triage Playbook

## When to use
- มี production incident
- service degraded
- payment/order/login/app flow มีปัญหา
- ต้องร่างอัปเดตให้ทีม/ผู้บริหาร

## Best specialist
- `prompts/nova-incident-responder-specialist.md`

## Best pairing
- เริ่มด้วย Incident Responder
- ถ้ามี log เยอะ ให้ดึง `prompts/nova-log-analyzer-specialist.md` มาช่วยต่อ

## Good supporting skills
- `support-engineering`
- `incident-manager`
- `sre-review`

## Minimum useful inputs
- อาการที่เห็น
- impact/user scope
- start time
- systems/services involved
- evidence ที่มีตอนนี้
- mitigation ที่ลองไปแล้ว

## Output should help Nick answer
1. severity เท่าไร
2. blast radius แค่ไหน
3. ตอนนี้ควร contain ยังไง
4. ต้องสื่อสารอะไรกับใครบ้าง
5. next 3 actions คืออะไร

## Good output shape
- Current status
- Severity / impact
- Confirmed facts
- Likely causes
- Mitigation in progress
- Next 3 actions
- Stakeholder update draft

## Escalate when
- owner ไม่ชัด
- customer impact กว้าง
- payment / order / auth flow เสีย
- เกิน SLA หรือเสี่ยงขยายวงเร็ว
