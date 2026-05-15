# Support AI RCA / Triage Automation Guardrails

Purpose: adapt useful n8n/support-engineering patterns without letting AI create unsafe ticket actions or misleading RCA reporting.

## Safe pattern to reuse

1. **Ingest** resolved support tickets or incoming requests from a read-only/export source first.
2. **Classify to a fixed schema**: category, priority, customer impact, suspected root cause, confidence, evidence snippets, human-review flag.
3. **Separate facts from model judgment**: keep raw ticket IDs/summaries linked, and label any RCA as `suspected` until reviewed.
4. **Human-in-the-loop queue** for low confidence, security/access issues, production incidents, VIP/customer-facing regressions, or any recommended external message.
5. **Report trends, not blame**: aggregate recurring causes, product areas, gaps in docs/runbooks, and prevention ideas.
6. **Write only to a sandbox first**: local CSV/Markdown/Coda draft/Google Sheet draft; no direct customer replies, ticket status changes, or escalation changes until approved.

## Minimum output schema

```yaml
ticket_id: string
category: enum
priority: enum
customer_impact: low|medium|high|unknown
suspected_root_cause: string
confidence: 0.0-1.0
evidence: [short quoted snippets or ticket fields]
recommended_action: string
needs_human_review: boolean
review_reason: string
```

## Safety checks before adoption

- No secrets or PII in prompts/logs; redact emails, tokens, account IDs where possible.
- Test against historical tickets and compare to known labels before enabling live use.
- Track false positives/false negatives weekly.
- Keep an audit trail: model, prompt version, workflow version, reviewer, approval outcome.
- Prefer deterministic code nodes for SLA/queue rules; use AI only for summarization/classification where ambiguity exists.

## Good first Nova/OpenClaw adaptation

Create a local `support_rca_draft.csv -> Markdown weekly RCA digest` workflow before connecting n8n. The digest should list: top recurring themes, example ticket IDs, confidence, owner/team suggestion, and docs/runbook improvement opportunities.

## Evaluation pattern learned from AI-SRE repos

Before trusting any AI RCA workflow, create a tiny benchmark set from historical incidents/tickets:

- 10-20 known cases with accepted root cause, impact, mitigation, and final owner.
- Include red herrings: noisy logs, downstream symptoms, duplicate reports, and incomplete tickets.
- Score outputs on: evidence citation, root-cause accuracy, impact accuracy, safe next action, and whether it correctly asks for human review.
- Require the workflow to say `insufficient evidence` instead of guessing when facts are missing.
- Keep remediation read-only by default; any action that changes infrastructure, customer comms, ticket status, or access needs explicit human approval.

Minimum pass gate before live use: no unsafe auto-action recommendations, and ≥80% evidence-backed classification accuracy on the benchmark set.
