# HEARTBEAT.md

ใช้ heartbeat แบบประหยัดและไม่รบกวนเกินไป

## Default behavior
- ถ้าไม่มีอะไรสำคัญ ให้ตอบ `HEARTBEAT_OK`
- ช่วง 23:00-08:00 ให้เงียบ เว้นแต่มีเรื่องสำคัญจริง
- อย่ารื้อฟื้นงานเก่าถ้า heartbeat นี้ไม่ได้สั่งให้ทำต่อ

## What to check
หมุนเช็กเฉพาะเรื่องที่คุ้มค่าและทำได้ไว:
- `ACTIVE_WORK.md` ก่อน ถ้ามีงาน active/paused/monitoring ที่ช่วยลด mental load ได้จริง
- OpenClaw health เบื้องต้น ถ้ามีสัญญาณว่าระบบเพิ่ง restart, fail, หรือมี doctor/security message สำคัญ
- n8n / workflow ที่เกี่ยวกับ Google Chat digest หรือ workflow ที่เพิ่งทำไว้ ถ้ามีสัญญาณว่า fail หรือ service down
- เรื่อง infrastructure ในเครื่องที่เกี่ยวกับงานล่าสุด ถ้ามีเหตุให้สงสัยว่าหลุดหรือพัง
- personal ops เบื้องต้น เช่น มี follow-up หรือเรื่องที่ควรสะกิดสั้น ๆ ไหม ถ้ามีคุณค่าจริงและไม่รบกวนเกินไป
- ถ้ามีข้อมูลใหม่ที่มีคุณค่าพอ ให้คิดแบบ `prompts/nova-morning-briefing-specialist.md` แล้วสรุปสั้นแบบ prioritized แทนการรายงาน status ดิบ

## When to alert
แจ้งพี่นิคเมื่อ:
- service สำคัญล่ม
- workflow สำคัญ fail ซ้ำ
- มี security / health warning ที่ควรเห็น
- มีสิ่งที่กระทบงาน support/automation ชัดเจน
- มี follow-up หรือ next step ที่ชัดเจนและน่าจะช่วยลด mental load ได้จริง
- มี briefing สั้น ๆ ที่ช่วยจัดลำดับวันหรือชี้ risk/priority ใหม่ได้จริง

## When to stay quiet
ตอบ `HEARTBEAT_OK` ถ้า:
- ทุกอย่างปกติ
- ไม่มี signal ใหม่
- เป็นแค่สถานะเดิมที่ยังไม่เปลี่ยน
- ไม่มี follow-up ที่ชัดและมีประโยชน์พอจะรบกวนพี่นิค

## Daily improvement habit
- ถ้า heartbeat มีเวลาว่างและไม่มีเรื่อง urgent ให้ดู `nova-skill-os/improvement-plan.md`
- ก่อนเลือกงาน ให้เช็ก `ACTIVE_WORK.md`, `nova-skill-os/backlog.md`, `research/repo-opportunities-backlog.md`, และรายงานล่าสุดใน `research/improvement-loop/`
- เลือกทำได้สูงสุด 1 small safe improvement ต่อวันเท่านั้น
- ต้องเป็น report-only หรือ reversible โดย default
- หลังทำให้ verify และจด evidence ลง `memory/YYYY-MM-DD.md`

## Auto-executor integration (2026-06-21)
Goal-queue + auto-pick pattern. ใช้แทน manual scanning ของ backlog หลายไฟล์.

**Heartbeat flow (NEW):**
1. ถ้าไม่มี incident / urgent work → รัน `nova-auto tick` เพื่อให้ Nova เลือก curated item ที่ผ่าน pick rules แล้ว
2. ถ้า tick ไม่ pick อะไร (no eligible items, daily limit hit, หรือ theme ไม่ตรง) → ทำ manual selection ตามปกติ
3. ถ้า tick pick item → ทำงานตามที่เลือก แล้ว `nova-auto complete <id> --evidence "..."` หรือ `nova-auto skip <id> --reason "..."`
4. ห้าม `nova-auto tick` ซ้ำใน heartbeat เดียวกัน (rate-limit มี 3 picks/day อยู่แล้ว แต่ไม่ควรเผาใน heartbeat เดียว)

**Tier 2 — spawn + watch + drain (2026-06-21):**
เมื่อ pick item แล้ว สามารถให้ Nova รัน sub-agent แทนทำเองได้:
- `nova-auto spawn <id>` — spawn isolated sub-agent (`openclaw agent --session-key agent:main:auto-exec-<id>`) ที่ทำงานอัตโนมัติ เขียน result file ที่ `~/.openclaw/state/auto-executor/results/<id>.md`
- `nova-auto watch` — idempotent: scan backlog, spawn sub-agent สำหรับ picked/in_progress ที่ยังไม่มี spawn record (เรียกจาก cron ทุก 5 นาทีได้)
- `nova-auto drain [--id <id>]` — อ่าน result files, mark backlog done/blocked ตาม Status ในไฟล์

**Heartbeat flow with Tier 2 (NEW):**
1. รัน `nova-auto watch` — spawn sub-agent สำหรับ item ที่ picked ค้าง (ถ้ามี)
2. รัน `nova-auto drain` — pick up result files ที่ sub-agent เขียนเสร็จแล้ว
3. ถ้าไม่มี active items → รัน `nova-auto tick` เพื่อเริ่ม cycle ใหม่

**Tier 3 — Autonomous cron (NEW 2026-06-22):**
Cron ทำงานทุก 5 นาที, ไม่ต้อง heartbeat มา trigger:
- Cron job id: `7bb67006-36b2-457d-a50e-2a1ed165857d` ("nova-auto-tick-cron")
- Schedule: `*/5 * * * * @ Asia/Bangkok` with 30s stagger
- Flow: wrapper (`bin/nova-auto-tick-cron.sh`) รัน tick+watch+drain → เขียน envelope ที่ `/tmp/nova-auto-cron-results.json` → isolated agentTurn sub-agent อ่าน envelope → compose Thai message → ส่ง telegram เฉพาะ done/blocked (ไม่ส่ง idle)
- Idle (ไม่มี done/blocked ใหม่) = "idle: ok" ไม่ส่ง telegram
- Active (≥1 done/blocked) = ส่ง 1 ข้อความรวม ทุก item พร้อม evidence 1 บรรทัด
- คาดว่าจะรันอัตโนมัติตลอด 24/7, MTTR pick-to-notify < 5 นาที

**Heartbeat checks เพิ่มเติมเมื่อไหร่:**
- ถ้า cron sub-agent fail ≥ 3 ครั้งติด → nova-auto state จะแสดง backlog pending ใหม่ค้าง → manual nova-auto tick/watch/drain
- ดู runs history: `openclaw cron runs --id 7bb67006-36b2-457d-a50e-2a1ed165857d --limit 10`
- ดู last envelope: `cat /tmp/nova-auto-cron-results.json`
- ดู wrapper log: `tail -50 /Users/nova/.openclaw/workspace/logs/auto-executor-cron.log`

**Pick rules (ภายใน nova-auto):**
- status=pending AND approval=none AND risk ∈ {low, medium}
- effort=small → eligible ทุกวัน
- effort=medium → ต้องตรงกับ weekday theme (Mon=safety, Tue=support, Wed=automation, Thu=skill-os, Fri=dashboard, Sat=research, Sun=memory/cleanup)
- effort=large → NEVER auto-pick (ต้อง human-initiate)
- category=memory → eligible ทุกวัน
- daily limit: 3 picks/day, reset เที่ยงคืน local time

**Sub-agent rules (enforced in prompt):**
- model: cheap (`MiniMax-M2.7-highspeed`) สำหรับ research/learning/cleanup/memory; main (`MiniMax-M3`) สำหรับ skill-os/automation
- timeout: 300s default (override ผ่าน `--timeout`)
- constraints: NO installs, NO secret access, NO external sends, NO deletions
- result file MUST be written before sub-agent replies DONE

**Files:**
- Backlog: `nova-skill-os/backlog.json` (single source of truth)
- State: `~/.openclaw/state/auto-executor/state.json` (rate limit + runs)
- Log: `logs/auto-executor.log` (every pick/add/done/skip/spawn/drain)
- Spawn queue: `~/.openclaw/state/auto-executor/spawn-queue/<id>.json` (audit + replay)
- Results: `~/.openclaw/state/auto-executor/results/<id>.md` (sub-agent output)
- Companion notes: `nova-skill-os/backlog.md` (human-readable archive, kept in sync manually)

**Tier 3 + Self-Heal Pipeline (NEW 2026-06-22 02:30):**
- Cron sub-agent เรียก `bin/nova-self-heal.sh` ก่อน notify
- Self-heal detects + auto-fixes known failure patterns:
  - launchagent_silent (LaunchAgent dead) → kickstart -k (idempotent)
  - cloudflared_dead (process down) → kickstart + verify metrics endpoint
  - line_bridge_dead → kickstart (KeepAlive now auto-restarts)
  - envelope_stale (3+ idle runs while backlog has eligible items) → manual tick
- Capped retry: max 2 heals per pattern per hour (prevents storm)
- Safe by design: ไม่ลบไฟล์, ไม่แก้ config, ไม่ disable agent, แค่ kickstart + re-run
- Notify จะรวมทั้ง done/blocked + heal events (1 ข้อความ)

**When to disable temporarily:**
- ถ้า self-heal misbehaving → `openclaw cron disable 7bb67006-36b2-457d-a50e-2a1ed165857d`
- ดู heal history: `cat ~/.openclaw/state/auto-executor/heal-state.json`
- ดู self-heal log: `grep self-heal /Users/nova/.openclaw/workspace/logs/auto-executor-cron.log`
