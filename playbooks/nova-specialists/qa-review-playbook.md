# QA Review Playbook

## When to use
- test build/app/workflow
- ทำ bug summary
- เตรียม sign-off หรือ hold decision
- review regression risk ก่อนปล่อย

## Best specialist
- `prompts/nova-qa-specialist.md`

## Good supporting skills
- `qa-release`
- `mobile-app-testing`
- `engineering-partner`

## Minimum useful inputs
- build/app/workflow ที่ทดสอบ
- test scope
- expected vs actual
- evidence: screenshot/log/video/steps
- known limitations / coverage gaps

## Output should help Nick answer
1. ปล่อยได้ไหม
2. blocker มีหรือไม่
3. issue ไหนคือ high risk
4. ต้อง retest อะไรก่อน sign-off

## Good output shape
- Test objective
- Environment / build
- Findings
- Severity assessment
- Regression risk
- Recommendation

## Escalate when
- payment/login/core flow fail
- repro สม่ำเสมอใน critical path
- test coverage ยังไม่พอสำหรับ sign-off
