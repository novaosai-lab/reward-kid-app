# Nova Performance Engineering Playbook

> Purpose: ใช้เป็นกติกาเวลาที่ Nova ต้องวัด/ปรับ performance ของ agent, OpenClaw workflow, n8n automation, dashboard, document generation, API tracing, หรือ batch analysis
>
> Adapted selectively from `cfregly/ai-performance-engineering` patterns. ไม่ใช่สรุป repo และไม่ใช้ GPU-specific benchmark ตรง ๆ

## 1. Default principle

**อย่า claim ว่าเร็วขึ้น/ดีขึ้น ถ้าไม่มีหลักฐานก่อน-หลัง**

ทุก performance task ต้องมีอย่างน้อย:
- baseline
- candidate/change
- metric ที่วัดได้
- artifact/log/output ที่ย้อนกลับมาตรวจได้
- known caveat

ถ้ายังไม่มี baseline ให้เรียกว่า **exploratory measurement** ไม่ใช่ improvement

---

## 2. Nova metrics ที่ใช้จริง

### Agent / workflow
- latency ต่อ task
- success rate
- retry count
- tool-call count
- token usage
- cost estimate ถ้ามี
- failure category
- human intervention needed? yes/no

### Document / dashboard generation
- input size
- output size/pages/nodes/edges
- generation time
- verification result
- missing/blocked data
- privacy scan result

### API/mobile investigation
- capture window
- device/app/package/activity
- request host/path count
- decrypted? yes/no
- pinning/proxy limitation
- redaction status

### n8n / automation
- trigger-to-delivery latency
- failed executions
- duplicate sends
- external API errors
- retry/backoff behavior
- credential/privacy risk

---

## 3. Workload freeze rule

ก่อนเทียบผล ต้องล็อกสิ่งเหล่านี้:

| Area | Freeze |
|---|---|
| Input | same file set / same prompt / same page / same device state |
| Model | same model unless model is the variable under test |
| Tooling | same scripts/tools where possible |
| Environment | same machine, app version, network/proxy state |
| Output target | same PDF/dashboard/doc format |
| Success criteria | define before running |

ถ้าเปลี่ยนหลายอย่างพร้อมกัน ให้ระบุว่าเป็น **exploratory**

---

## 4. One-variable comparison rule

เวลา optimize ให้เปลี่ยนทีละตัว เช่น:

- prompt only
- parser only
- dashboard layout only
- graph extraction rule only
- model only
- proxy method only

ถ้าเปลี่ยน prompt + parser + model พร้อมกัน ห้ามสรุปว่าอะไรทำให้ดีขึ้น

---

## 5. Minimum artifact contract

ทุก performance/reliability run ที่ควรเก็บ ต้องมี:

```yaml
run_id: YYYY-MM-DD_topic_shortname
objective: what are we trying to improve?
baseline: current behavior / file / command / metric
candidate: changed behavior / file / command / metric
input: exact input paths or scenario
metrics:
  latency_sec:
  success_rate:
  output_size:
  token_or_cost:
  errors:
verification:
  command_or_check:
  result:
artifacts:
  raw_logs:
  generated_files:
  screenshots:
privacy:
  secret_scan:
  pii_masked:
known_limits:
  - ...
recommendation: ship / iterate / block
```

เก็บไว้ข้าง artifact หรือใน `out/<run>/RUN_SUMMARY.md`

---

## 6. Trial policy

ถ้างานเป็น benchmark จริง ไม่ใช้ผลครั้งเดียว

| Grade | Minimum |
|---|---|
| quick check | 1 run + caveat |
| internal confidence | 3 runs |
| release/performance claim | 5 runs + median/p95 or distribution |

ให้เก็บ raw results เสมอ ไม่ใช่เก็บแค่ค่าเฉลี่ย

---

## 7. Bottleneck taxonomy for Nova

เวลาช้า ให้ classify ก่อนแก้:

| Bottleneck | Signal | First check |
|---|---|---|
| model-bound | reasoning/token time สูง | model, prompt size, context size |
| tool-bound | tool call นาน | command time, network, file size |
| IO-bound | read/write/zip/pdf ช้า | file count/size, disk, image/PDF renderer |
| network-bound | web/API/proxy ช้า | DNS, endpoint, TLS, proxy, rate limit |
| parsing-bound | graph/doc extraction ช้า | regex/parser complexity, table size |
| orchestration-bound | subagents/waits/retries | unnecessary steps, polling, dependency order |
| verification-bound | tests/builds slow | choose smallest meaningful gate |

ห้ามเดาว่าเป็น model ช้า ถ้ายังไม่ดู tool timing

---

## 8. Regression guardrails

ก่อนบอกว่า improved ต้องเช็กว่าไม่ทำให้ของสำคัญแย่ลง:

- output completeness ลดไหม
- privacy risk เพิ่มไหม
- accuracy/citation หายไหม
- dashboard เปิด offline ได้จริงไหม
- PDF readable ไหม
- graph node/edge count หายผิดปกติไหม
- user workflow ใช้ยากขึ้นไหม
- retry/failure เพิ่มไหม

ถ้าดีขึ้นด้านเดียวแต่เสี่ยงขึ้น ต้องระบุ tradeoff

---

## 9. Evidence-first response format

เวลารายงาน performance ให้ตอบแบบนี้:

```text
Result: improved / no clear improvement / worse / blocked
Baseline: ...
Candidate: ...
Evidence: command/log/artifact path
Metrics: ...
Risk/Caveat: ...
Recommendation: ...
```

ไม่ใช้คำว่า “น่าจะเร็วขึ้น” ถ้าไม่มี metric

---

## 10. Practical checklists by task

### 10.1 Dashboard generation
- [ ] count nodes/edges before and after
- [ ] verify JSON parses
- [ ] verify ZIP integrity
- [ ] check no CDN if promised offline
- [ ] check no `fetch()` if opening via `file://`
- [ ] check no `innerHTML` if data may be untrusted
- [ ] include mode/filter/search usability note
- [ ] include known performance risk for >1k nodes

### 10.2 PDF/doc generation
- [ ] source files listed
- [ ] PDF exists and `file` recognizes it
- [ ] size/page count recorded if available
- [ ] links/images resolve
- [ ] secret scan for common token patterns
- [ ] mark generated from static analysis vs runtime observation
- [ ] preserve source docs/traceability

### 10.3 Mobile/API investigation
- [ ] record package/activity/device
- [ ] capture screenshot
- [ ] dump focused activity
- [ ] if proxy used, record proxy before/after and restore
- [ ] distinguish host-only capture vs decrypted request path/body
- [ ] redact tokens/address/customer data
- [ ] note if pinning/cache/proxy limitation applies

### 10.4 Agent/workflow optimization
- [ ] define task corpus
- [ ] run baseline on same corpus
- [ ] measure latency, tool calls, failures, retries
- [ ] change one variable
- [ ] rerun
- [ ] compare median and failure categories
- [ ] keep raw transcripts/log summaries when safe

---

## 11. What Nova should not do

- Do not run heavy GPU/CUDA benchmarks from the repo on this Mac mini
- Do not claim GPU/LLM serving improvements without proper hardware/runtime evidence
- Do not use benchmark numbers from unsupported fallback paths
- Do not compare before/after if workload changed materially
- Do not publish raw logs containing tokens, addresses, PII, or customer data
- Do not optimize for speed by skipping verification silently

---

## 12. Reusable mini-template

```markdown
# Performance Run Summary

## Objective

## Baseline
- command/scenario:
- metric:
- artifact:

## Candidate
- change:
- command/scenario:
- metric:
- artifact:

## Result

## Verification

## Privacy / Safety

## Known limits

## Recommendation
```

---

## 13. When to use this playbook

Use for:
- improving Nova/OpenClaw workflow speed
- comparing models/prompts/tools
- dashboard/PDF generation reliability
- mobile/API capture methodology
- n8n workflow latency/reliability
- release confidence for automation artifacts

Do not use for:
- generic summaries
- one-off factual answers
- tasks where performance is irrelevant
