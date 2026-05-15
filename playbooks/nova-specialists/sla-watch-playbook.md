# SLA Watch Playbook

## When to use
- review backlog health
- ดู aging tickets
- หาความเสี่ยง breach ก่อนหลุดจริง
- ทำ governance summary รายสัปดาห์/รายเดือน

## Best specialist
- `prompts/nova-sla-monitor-specialist.md`

## Good supporting skills
- `support-engineering`
- `application-support`
- `support-reporting`

## Minimum useful inputs
- ticket counts / aging buckets
- pending / no-response / reopened patterns
- trend เทียบวันก่อน/สัปดาห์ก่อน
- critical queues หรือ business-critical categories

## Output should help Nick answer
1. overall health อยู่ระดับไหน
2. ticket/case ไหนน่าห่วงสุด
3. เป็น one-off หรือ trend
4. ต้อง intervene ตรงไหนก่อน

## Good output shape
- Overall health
- Immediate risks
- Aging patterns
- Trend shifts
- Recommendations

## Escalate when
- queue ใด queue หนึ่งโตเร็วผิดปกติ
- aging > SLA เริ่มสะสม
- no-response / blocked cases สูงขึ้นต่อเนื่อง
