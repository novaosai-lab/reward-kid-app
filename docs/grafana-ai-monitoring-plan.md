# Grafana AI Monitoring Plan

Purpose: เตรียมแนวทางให้ Nova/OpenClaw ใช้ Grafana API แบบ read-only เพื่อช่วย App Support / Incident / SRE monitoring เมื่อมี `GRAFANA_URL` และ `GRAFANA_TOKEN`.

## Current Phoenix Connection

- Project: Phoenix
- Grafana URL: `https://grafana.lotussphoenix.com`
- Private env file: `/Users/nova/.openclaw/workspace/grafana-openclaw-bridge/.env`
- MCP bridge command: `/Users/nova/.openclaw/workspace/grafana-openclaw-bridge/run-mcp-grafana.sh`
- Safety mode: read-only MCP flags enabled via `-disable-write`, `-disable-admin`, `-disable-annotations`, `-disable-alerting`, `-disable-oncall`, `-disable-incident`, and `-disable-rendering`.
- Verified dashboard: `ae2iusdg7aepsd` / `PROD-Microservice-Logging`
- Default datasource variables from provided dashboard link: `prod-quickwit` and Prometheus uid `de2e5ukcfjugwe`

Do not store service account tokens in this file. Tokens belong only in the private `.env` file.

## Required inputs

```bash
GRAFANA_URL="https://grafana.example.com"
GRAFANA_TOKEN="<read-only service account token>"
```

Recommended token scope/role:
- Service Account role: Viewer
- Read-only only
- Expiration enabled if possible
- No Admin/Edit dashboard permission

## Capability levels

### Level 1 — Connectivity & Inventory
Goal: เช็กว่า token ใช้ได้ และเห็น dashboard/datasource อะไรบ้าง

Can do:
- Verify Grafana health
- List dashboards
- Search dashboards by folder/tag/name
- List datasources metadata if permission allows
- Identify candidate dashboards for support monitoring

Useful APIs:
```bash
curl -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA_URL/api/health"
curl -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA_URL/api/search?type=dash-db"
curl -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA_URL/api/datasources"
```

Output:
- Dashboard inventory
- Suggested dashboard shortlist
- Missing permission checklist

---

### Level 2 — Dashboard / Panel Reading
Goal: ให้ AI อ่าน dashboard structure แล้วบอกว่า panel ไหนควร monitor

Can do:
- Fetch dashboard JSON by UID
- Extract panel titles, datasource refs, queries, thresholds
- Map panels to business flows เช่น login, order, payment, reward, campaign, API gateway
- Build monitoring checklist from existing dashboard

Useful API:
```bash
curl -H "Authorization: Bearer $GRAFANA_TOKEN" \
  "$GRAFANA_URL/api/dashboards/uid/<dashboard_uid>"
```

Output:
- Panel inventory
- Key metrics list
- Suggested thresholds
- Query candidates for automation

---

### Level 3 — Query Metrics Directly
Goal: ให้ AI ดึง metric จริงแล้วสรุป health / anomaly

Depends on datasource:
- Prometheus / Mimir: query via Grafana datasource proxy or Grafana query API
- Loki: query logs / error patterns
- Elasticsearch: query app logs / error counts
- CloudWatch / other: depends on plugin permission

Can do:
- 5xx rate / error count
- p95/p99 latency
- traffic drop/spike
- login/order/payment/reward failure trend
- compare current window vs previous window
- detect sudden anomaly

Example output format:
```text
Status: Warning
Impact: Reward issuing error rate increased from 0.4% to 3.2% in last 15m
Likely area: campaign/reward API
Evidence: panel/query xxx, top error yyy
Recommended action: check deployment/change, inspect logs by trace/error code, notify owner
```

---

### Level 4 — Alert Review & Triage
Goal: ให้ AI อ่าน Grafana alerts แล้วช่วย prioritize

Can do:
- List firing/resolved alerts
- Group noisy duplicate alerts
- Classify severity by business impact
- Create incident-style summary
- Suggest owner/action/runbook

Useful APIs may vary by Grafana version:
```bash
curl -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA_URL/api/alertmanager/grafana/api/v2/alerts"
curl -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA_URL/api/ruler/grafana/api/v1/rules"
```

Output:
- Active alerts summary
- Highest risk first
- Suggested next action
- Unknowns / missing context

---

### Level 5 — Scheduled AI Health Brief
Goal: ตั้ง OpenClaw cron ให้เช็กเป็นรอบ ๆ และแจ้งเฉพาะเมื่อควรแจ้ง

Possible schedules:
- Morning health brief: 08:30
- Evening support handoff: 18:00
- High-risk services: every 15–30 min, but only notify on anomaly

Recommended notification behavior:
- Normal: no message or short OK summary
- Warning/Critical: send Telegram/Discord/Google Chat
- Include: impact, evidence, suspected area, recommended action, dashboard link

OpenClaw flow:
```text
cron trigger
→ query Grafana API
→ normalize metrics/alerts
→ compare threshold/baseline
→ AI support-engineering summary
→ notify only if useful
```

---

## Safe first implementation

Start with read-only, non-invasive steps:

1. Verify token:
   - `/api/health`
   - `/api/search?type=dash-db`
2. Pick 1 dashboard only, e.g. order/payment/login/reward service
3. Extract panel/query list
4. Define 3–5 metrics only:
   - error rate
   - 5xx count
   - p95 latency
   - traffic volume
   - business failure count
5. Create one manual command/script to generate a health summary
6. Then add cron after result quality is good

## Risk & guardrails

Do:
- Use Viewer/read-only token
- Store token outside repo when possible
- Redact token in logs
- Query small windows first, e.g. last 15m/1h
- Rate-limit scheduled checks
- Keep dashboard links in output for human verification

Don't:
- Use Admin token
- Auto-edit dashboards/alerts initially
- Spam chat on every minor alert
- Claim RCA from metrics alone
- Run expensive wide-range queries during peak hours

## What Nova can produce once token is available

1. Grafana dashboard inventory
2. Monitoring candidate list
3. AI health brief from current metrics
4. Active alert triage summary
5. Incident update draft
6. RCA evidence pack from metric windows
7. Daily support health report
8. Cron-based anomaly notifier
9. Runbook per dashboard/panel
10. Observability gap report

## First command checklist when token arrives

Replace values locally, do not commit token:

```bash
export GRAFANA_URL="https://your-grafana-domain"
export GRAFANA_TOKEN="paste-token-here"

curl -sS -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA_URL/api/health"
curl -sS -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA_URL/api/search?type=dash-db" | head
```

If both work, next step is dashboard UID selection.
