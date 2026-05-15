# Nova Agent Engineering Lifecycle

> Purpose: ใช้เป็น workflow guardrail เวลาที่ Nova ทำงาน coding / automation / dashboard / docs / QA / release ให้พี่นิค
>
> Adapted selectively from `addyosmani/agent-skills`. ไม่ติดตั้งทั้ง repo และไม่ copy skill ตรง ๆ เพราะ OpenClaw มี skill system ของตัวเองอยู่แล้ว

## 1. Lifecycle default

ทุกงาน engineering ที่ไม่ trivial ให้เดินตามนี้:

```text
SPEC → PLAN → BUILD → VERIFY → REVIEW → SHIP
```

ไม่ต้องทำทุก step แบบพิธีการ แต่ห้ามข้าม **VERIFY** และห้าม claim งานเสร็จถ้าไม่มี evidence

---

## 2. When to use each phase

| Phase | Use when | Output |
|---|---|---|
| SPEC | งานยังคลุมเครือ / feature ใหม่ / dashboard ใหม่ | scope, goal, constraints, non-goals |
| PLAN | งานหลายขั้น / หลายไฟล์ / มี risk | short task plan + acceptance checks |
| BUILD | ลงมือแก้/สร้าง | small vertical slice, not giant rewrite |
| VERIFY | ทุกงานที่มี artifact/code | test/build/lint/screenshot/file check/QA gate |
| REVIEW | ก่อนส่ง artifact สำคัญ | risk, correctness, privacy, usability check |
| SHIP | ส่งไฟล์/สรุป/ใช้งานจริง | artifact path + evidence + known limits |

---

## 3. Nova execution rules

### Start from evidence
- อ่านไฟล์จริงก่อนเดา
- ตรวจ package/app/activity จริงก่อนเขียนเอกสาร
- ถ้าเป็น framework/library ให้ดู docs/source ก่อนใช้ memory
- ถ้าเป็น mobile/API ให้แยก static mapping vs runtime capture ให้ชัด

### Build in vertical slices
- ทำ version ที่เปิดได้ก่อน
- verify ก่อน polish
- ถ้า graph/dashboard ให้นับ nodes/edges และเช็ก offline behavior
- ถ้า PDF/doc ให้ preserve source และเช็ก secret/PII

### No silent degradation
ถ้ามีข้อจำกัดให้พูดตรง ๆ:
- proxy เห็นแค่ host ไม่เห็น path/body
- static analysis ไม่ใช่ runtime truth
- dashboard offline จริงหรือยังไม่จริง
- mapping ต้อง dev owner confirm

---

## 4. Doubt gate for high-risk claims

ใช้เมื่อ Nova กำลังจะพูดว่า:
- “อันนี้ปลอดภัย”
- “อันนี้ถูก app แล้ว”
- “อันนี้ offline แล้ว”
- “ไม่มี secret”
- “API เส้นนี้ runtime ยิงจริง”
- “ใช้ส่งต่อทีมได้แล้ว”

ต้องถามตัวเอง:

```text
CLAIM:
EVIDENCE:
WHAT COULD BE WRONG:
CHECK PERFORMED:
LIMITATION:
```

ถ้าหลักฐานไม่พอ ให้เปลี่ยนคำเป็น “จาก static/source docs น่าจะ...” หรือ “ยังต้อง verify...”

---

## 5. Source-driven rule

เมื่องานเกี่ยวกับ framework/tool/library:

1. Detect version/source
2. Read official docs or repo source
3. Use documented pattern
4. Cite or name source internally when useful

ใช้กับ:
- OpenClaw docs/config
- React/D3/dashboard
- Android adb/mobile testing
- proxy/mitm tools
- GitHub repos ที่จะ adapt

ไม่ใช้กับงาน mechanical เช่น rename/file copy

---

## 6. Testing patterns Nova should keep

### Arrange / Act / Assert
ใช้กับ scripts/parsers/dashboard checks:

```text
Arrange: input file / scenario
Act: run parser/generator
Assert: output exists, parses, counts match, no unsafe patterns
```

### Mock at boundaries only
Mock/approximate ได้ที่:
- external API
- browser/device unavailable
- network capture not possible

อย่า mock:
- business logic ที่กำลัง verify
- parser correctness
- security/privacy checks

---

## 7. Review checklist before sending artifacts

### Docs/PDF
- [ ] source files preserved
- [ ] generated PDF/HTML/MD exists
- [ ] links/images resolve
- [ ] app/package/context ถูกต้อง
- [ ] secret/PII scan หรือ masking done
- [ ] limitations stated

### Dashboard
- [ ] JSON parses
- [ ] node/edge count verified
- [ ] offline claim verified: no CDN/fetch if promised
- [ ] no unsafe `innerHTML` with untrusted data
- [ ] ZIP integrity tested
- [ ] usage instructions included

### Mobile/API
- [ ] package/activity/device captured
- [ ] screenshot evidence
- [ ] proxy/log method documented
- [ ] token/address/customer data redacted
- [ ] static vs runtime distinction clear
- [ ] proxy/device settings restored

### Code/automation
- [ ] smallest meaningful test/lint/build run
- [ ] rollback/risk noted if needed
- [ ] no destructive command without approval
- [ ] no credential printed

---

## 8. Anti-patterns to avoid

| Anti-pattern | Replace with |
|---|---|
| “น่าจะได้” without evidence | run/check/screenshot/path |
| Big rewrite | vertical slice |
| Static docs treated as runtime truth | label as static and verify runtime separately |
| Prompt-only fix | artifact + verification |
| Hidden external dependency | mention CDN/API/tool requirement |
| Silent fallback | explicit degraded mode |
| Over-polished but shallow docs | source-linked inventory + flow + risk |

---

## 9. Practical Nova command mental model

When user says “ทำเลย”:

```text
1. Identify artifact goal
2. Read inputs/state
3. Build minimal useful version
4. Verify with smallest meaningful gate
5. Polish only after it works
6. Send artifact + evidence + caveat
```

When user asks “อันนี้ช่วยไหม”:

```text
1. Inspect repo/file
2. Identify usable patterns only
3. Avoid installation unless needed
4. Create/adapt local playbook if valuable
5. State what not to use
```

When user asks “ตรวจให้หน่อย”:

```text
1. Define scope
2. Check existence/openability
3. Check correctness/completeness
4. Check privacy/security
5. Report passed/failed/blocked/risk/recommendation
```

---

## 10. Where this fits with existing Nova skills

- `engineering-partner`: technical execution + judgment
- `qa-release`: signoff/release confidence
- `mobile-app-testing`: device/app evidence
- `design-system-ui`: polished dashboard/docs
- `support-engineering`: incident/support framing
- This playbook: lifecycle glue and quality gates

